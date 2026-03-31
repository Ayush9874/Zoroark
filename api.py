from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn
import subprocess
import sys
import os
import re
import time
import httpx
import ollama
from planner3 import plan_task_safe
from memory1 import save_node, recall

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pre-install guaranteed packages at startup ────────────────────────────────
# bs4 is used by virtually every scraper Llama generates.
# Install once at boot — never hit ModuleNotFoundError mid-demo.
def ensure_packages():
    for import_name, pip_name in [("bs4", "beautifulsoup4"), ("lxml", "lxml")]:
        try:
            __import__(import_name)
        except ImportError:
            print(f"[Startup] 📦 Installing {pip_name}...")
            subprocess.run(
                [sys.executable, "-m", "pip", "install", pip_name, "--quiet"],
                capture_output=True
            )
            print(f"[Startup] ✅ {pip_name} ready")

ensure_packages()

# ── Ollama health check ───────────────────────────────────────────────────────
def check_ollama_status() -> str:
    try:
        httpx.get("http://localhost:11434", timeout=3)
        models = ollama.list()
        model_names = [m.model for m in models.models]
        has_llama3 = any("llama3" in name for name in model_names)
        if not has_llama3:
            return f"llama3 not pulled. Run: ollama pull llama3. Available: {model_names}"
        print("✅ Ollama + llama3 ready!")
        return "OK"
    except Exception as e:
        return f"Ollama not reachable: {e}"

ollama_status = check_ollama_status()

# ── Strip ANSI escape codes ───────────────────────────────────────────────────
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub('', text)

# ── Auto-install missing packages ────────────────────────────────────────────
IMPORT_TO_PIP = {
    "bs4": "beautifulsoup4",
    "sklearn": "scikit-learn",
    "cv2": "opencv-python",
    "PIL": "Pillow",
    "dotenv": "python-dotenv",
    "yaml": "pyyaml",
    "dateutil": "python-dateutil",
    "lxml": "lxml",
}

def try_auto_install(error_text: str) -> Optional[str]:
    match = re.search(r"No module named '([^']+)'", error_text)
    if not match:
        return None
    import_name = match.group(1).split(".")[0]
    pip_name = IMPORT_TO_PIP.get(import_name, import_name)
    print(f"[API] 📦 Auto-installing: {pip_name}")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", pip_name, "--quiet"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"[API] ✅ Installed {pip_name}")
        return pip_name
    print(f"[API] ❌ Failed to install {pip_name}: {result.stderr[:200]}")
    return None

# ── Fix prompt ────────────────────────────────────────────────────────────────
FIX_PROMPT = """You are a Python debugger. Fix the broken script below.
Return ONLY the fixed Python code. No explanation, no markdown, no code fences.

RULES:
- Fix the exact error shown, keep the same goal
- All output files go to 'outputs/' folder
- Include ALL necessary imports
- Use ONLY single quotes for Python strings
- NEVER hardcode credentials — use os.environ.get() and skip gracefully if missing
- If a website blocks (403/429): print('SKIPPED: site blocked') then exit(0)
- If scraping returns 0 results: print('No results found') then exit(0)
- The variable `previous_output` is already defined — do NOT redefine it
"""

# ── Request models ────────────────────────────────────────────────────────────
class PromptRequest(BaseModel):
    prompt: str

class NodeExecutionRequest(BaseModel):
    node_id: str
    task_description: str
    node_label: str
    code: str
    previous_output: Optional[str] = ""

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": ollama_status}


@app.post("/api/plan")
async def get_plan(request: PromptRequest):
    if "OK" not in ollama_status:
        live_status = check_ollama_status()
        if "OK" not in live_status:
            raise HTTPException(status_code=503, detail=live_status)
    try:
        plan = plan_task_safe(request.prompt)
        return plan
    except Exception as e:
        print(f"[API] Planner error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/execute")
async def execute_node(request: NodeExecutionRequest):
    os.makedirs("outputs", exist_ok=True)
    code = request.code
    fixed_code = None

    # Strip trailing whitespace from previous_output before injecting.
    # A trailing \n from print() causes blank rows in downstream CSV nodes.
    prev = request.previous_output.strip() if request.previous_output else ""
    if prev:
        injection = (
            f"# Output from previous node (stripped):\n"
            f"previous_output = {repr(prev)}\n\n"
        )
        code = injection + code

    MAX_RETRIES = 3
    EXEC_TIMEOUT = 60
    last_error = ""

    for attempt in range(MAX_RETRIES):
        try:
            result = subprocess.run(
                [sys.executable, "-c", code],
                capture_output=True,
                text=True,
                timeout=EXEC_TIMEOUT
            )

            stdout = result.stdout.strip()
            stderr = strip_ansi(result.stderr.strip())

            if result.returncode == 0:
                save_node(
                    task_description=request.task_description,
                    node_label=request.node_label,
                    code=code,
                    output=stdout
                )
                return {
                    "status": "success",
                    "output": stdout,
                    "error": None,
                    "fixed_code": fixed_code,
                    "attempts": attempt + 1
                }
            else:
                last_error = stderr
                print(f"[API] ❌ Attempt {attempt + 1} failed for '{request.node_label}': {last_error[:300]}")

                if attempt < MAX_RETRIES - 1:
                    # Ollama runner crash — wait and retry same code
                    if "runner process has terminated" in last_error or "status code: 500" in last_error:
                        print("[API] ⏳ Ollama crashed — waiting 3s...")
                        time.sleep(3)
                        continue

                    # Missing package — install and retry same code
                    if "No module named" in last_error:
                        installed = try_auto_install(last_error)
                        if installed:
                            print(f"[API] 🔁 Retrying after installing {installed}...")
                            continue

                    # Ask Llama to fix the code
                    print(f"[API] 🔧 Asking Llama 3 to fix...")
                    past_examples = recall(request.task_description)

                    fix_response = ollama.chat(
                        model="llama3",
                        messages=[
                            {"role": "system", "content": FIX_PROMPT},
                            {"role": "user", "content": (
                                f"{past_examples}\n\n"
                                f"Broken code:\n{code}\n\n"
                                f"Error:\n{last_error}\n\n"
                                f"Return ONLY raw Python code."
                            ).strip()}
                        ],
                        options={"temperature": 0.1}
                    )

                    fixed = fix_response["message"]["content"]
                    fixed = re.sub(r"```python|```", "", fixed).strip()
                    # Strip any prose preamble Llama adds before the code
                    lines = fixed.split("\n")
                    code_start = 0
                    for i, line in enumerate(lines):
                        s = line.strip()
                        if s.startswith(("import ", "from ", "def ", "class ", "#", "previous_output")):
                            code_start = i
                            break
                        if s and not s[0].isupper():
                            code_start = i
                            break
                    code = "\n".join(lines[code_start:]).strip()
                    fixed_code = code
                    print(f"[API] 🔁 Retrying with fixed code (attempt {attempt + 2})...")

        except subprocess.TimeoutExpired:
            last_error = f"Timed out after {EXEC_TIMEOUT}s"
            print(f"[API] ⏱ Timeout on '{request.node_label}'")
            break
        except Exception as e:
            last_error = str(e)
            print(f"[API] 💥 Unexpected error: {e}")
            break

    return {
        "status": "error",
        "output": None,
        "error": last_error,
        "fixed_code": None,
        "attempts": MAX_RETRIES
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False) 
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn
import subprocess
import sys
import os
import re
import time
import httpx
import ollama
from planner3 import plan_task_safe
from memory1 import save_node, recall

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pre-install packages at startup ──────────────────────────────────────────
def ensure_packages():
    for import_name, pip_name in [("bs4", "beautifulsoup4"), ("lxml", "lxml")]:
        try:
            __import__(import_name)
        except ImportError:
            print(f"[Startup] 📦 Installing {pip_name}...")
            subprocess.run([sys.executable, "-m", "pip", "install", pip_name, "--quiet"], capture_output=True)
            print(f"[Startup] ✅ {pip_name} ready")

ensure_packages()

# ── Ollama health check ───────────────────────────────────────────────────────
def check_ollama_status() -> str:
    try:
        httpx.get("http://localhost:11434", timeout=3)
        models = ollama.list()
        model_names = [m.model for m in models.models]
        if not any("llama3" in n for n in model_names):
            return f"llama3 not pulled. Run: ollama pull llama3. Available: {model_names}"
        print("✅ Ollama + llama3 ready!")
        return "OK"
    except Exception as e:
        return f"Ollama not reachable: {e}"

ollama_status = check_ollama_status()

# ── Helpers ───────────────────────────────────────────────────────────────────
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub('', text)

IMPORT_TO_PIP = {
    "bs4": "beautifulsoup4", "sklearn": "scikit-learn", "cv2": "opencv-python",
    "PIL": "Pillow", "dotenv": "python-dotenv", "yaml": "pyyaml",
    "dateutil": "python-dateutil", "lxml": "lxml",
}

def try_auto_install(error_text: str) -> Optional[str]:
    match = re.search(r"No module named '([^']+)'", error_text)
    if not match:
        return None
    import_name = match.group(1).split(".")[0]
    pip_name = IMPORT_TO_PIP.get(import_name, import_name)
    print(f"[API] 📦 Auto-installing: {pip_name}")
    r = subprocess.run([sys.executable, "-m", "pip", "install", pip_name, "--quiet"], capture_output=True, text=True)
    if r.returncode == 0:
        print(f"[API] ✅ Installed {pip_name}")
        return pip_name
    return None

def is_scraper_node(node_label: str) -> bool:
    """True if this node is node_1 (the scraper) — output must be pipe-separated data."""
    return node_label.lower() in ("scrape data", "scraper", "scrape") or "scrape" in node_label.lower()

def validate_scraper_output(stdout: str) -> str | None:
    """
    Returns None if stdout looks like valid pipe-separated scraper data.
    Returns an error string if it's a skip/error message or has no pipe chars.
    """
    if not stdout or not stdout.strip():
        return "Scraper produced no output"
    lines = [l for l in stdout.strip().split("\n") if l.strip()]
    if not lines:
        return "Scraper output was blank"
    # Skip/error messages — not real data
    skip_signals = ["skipped:", "no results", "blocked", "smtp", "email", "error:", "exception"]
    first_lower = lines[0].lower()
    if any(s in first_lower for s in skip_signals):
        return f"Scraper returned a skip/error message instead of data: {lines[0]}"
    # Must have at least one pipe — data rows are pipe-separated
    has_pipe = any("|" in line for line in lines)
    if not has_pipe:
        return f"Scraper output has no pipe-separated data (first line: {lines[0][:80]!r})"
    # Must have at least 2 lines (header + 1 data row)
    if len(lines) < 2:
        return f"Scraper only produced header row, no data rows"
    return None  # all good

# ── Fix prompt — scraper-specific ────────────────────────────────────────────
SCRAPER_FIX_PROMPT = """You are a Python web scraping expert. Fix the broken scraper below.
Return ONLY raw Python code. No explanation. No markdown. No backticks.

THE PROBLEM TO FIX: {error}

RULES:
- Keep the same URL and goal
- Use requests + BeautifulSoup (bs4)
- Set headers = {{'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}}
- Check response.status_code — if != 200: print('SKIPPED: HTTP ' + str(response.status_code)); exit(0)
- If results empty after parsing: print('No results found'); exit(0)
- First print() MUST be the pipe-separated header: print('Col1|Col2|Col3')
- Every data print() MUST be pipe-separated: print(val1 + '|' + val2 + '|' + val3)
- Use ONLY single quotes
- Do NOT include any email/SMTP/credential code — this is a scraper only
- Do NOT use selenium or playwright
- Limit to {limit} results
"""

GENERIC_FIX_PROMPT = """Fix the broken Python script below.
Return ONLY raw Python code. No explanation. No markdown. No backticks.

RULES:
- Fix the exact error shown, keep the same goal
- All output files go to 'outputs/' folder
- Include ALL necessary imports
- Use ONLY single quotes
- The variable `previous_output` is already injected — do NOT redefine it
"""

# ── Request models ────────────────────────────────────────────────────────────
class PromptRequest(BaseModel):
    prompt: str

class NodeExecutionRequest(BaseModel):
    node_id: str
    task_description: str
    node_label: str
    code: str
    previous_output: Optional[str] = ""

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": ollama_status}

@app.post("/api/plan")
async def get_plan(request: PromptRequest):
    if "OK" not in ollama_status:
        live = check_ollama_status()
        if "OK" not in live:
            raise HTTPException(status_code=503, detail=live)
    try:
        plan = plan_task_safe(request.prompt)
        return plan
    except Exception as e:
        print(f"[API] Planner error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute")
async def execute_node(request: NodeExecutionRequest):
    os.makedirs("outputs", exist_ok=True)
    code = request.code
    fixed_code = None
    scraper = is_scraper_node(request.node_label)

    # Inject previous_output (stripped to avoid blank CSV rows)
    prev = request.previous_output.strip() if request.previous_output else ""
    if prev:
        code = f"previous_output = {repr(prev)}\n\n" + code

    MAX_RETRIES = 4  # extra retry for scrapers — selectors often need one fix
    EXEC_TIMEOUT = 60
    last_error = ""
    original_code = code  # keep original for re-ask if fix goes completely wrong

    for attempt in range(MAX_RETRIES):
        try:
            result = subprocess.run(
                [sys.executable, "-c", code],
                capture_output=True, text=True, timeout=EXEC_TIMEOUT
            )
            stdout = result.stdout.strip()
            stderr = strip_ansi(result.stderr.strip())

            if result.returncode == 0:
                # ── Extra validation for scraper nodes ──────────────────────
                # Success exit code is not enough — Llama's self-fix sometimes
                # replaces the scraper with SMTP/email code that exits cleanly
                # but produces no pipe-separated data. Catch that here.
                if scraper:
                    bad = validate_scraper_output(stdout)
                    if bad:
                        print(f"[API] ⚠️  Scraper succeeded but output is invalid: {bad}")
                        last_error = f"Bad scraper output: {bad}"
                        # Treat as failure — will ask Llama to fix
                        if attempt < MAX_RETRIES - 1:
                            print(f"[API] 🔧 Re-asking Llama for better scraper...")
                            fix_prompt = SCRAPER_FIX_PROMPT.format(
                                error=bad, limit=10
                            )
                            fix_response = ollama.chat(
                                model="llama3",
                                messages=[
                                    {"role": "system", "content": fix_prompt},
                                    {"role": "user", "content": (
                                        f"Original scraper code:\n{original_code}\n\n"
                                        f"Problem: {bad}\n\n"
                                        f"Write a fixed scraper. Return ONLY raw Python code."
                                    )}
                                ],
                                options={"temperature": 0.1}
                            )
                            fixed = re.sub(r"```python|```", "", fix_response["message"]["content"]).strip()
                            # Reject if Llama smuggled in SMTP again
                            if "smtp" in fixed.lower() or "smtplib" in fixed.lower():
                                print("[API] 🚫 Llama tried to inject SMTP into scraper fix — rejected")
                                continue
                            code = fixed
                            fixed_code = code
                            print(f"[API] 🔁 Retrying scraper (attempt {attempt + 2})...")
                            continue
                        # Ran out of retries — fail with clear message
                        return {
                            "status": "error",
                            "output": None,
                            "error": f"Scraper could not produce valid pipe-separated data after {MAX_RETRIES} attempts. Last output: {stdout[:200]}",
                            "fixed_code": None,
                            "attempts": MAX_RETRIES
                        }

                # ── Genuine success ──────────────────────────────────────────
                save_node(
                    task_description=request.task_description,
                    node_label=request.node_label,
                    code=code, output=stdout
                )
                return {
                    "status": "success",
                    "output": stdout,
                    "error": None,
                    "fixed_code": fixed_code,
                    "attempts": attempt + 1
                }

            else:
                last_error = stderr
                print(f"[API] ❌ Attempt {attempt + 1} failed for '{request.node_label}': {last_error[:300]}")

                if attempt >= MAX_RETRIES - 1:
                    break

                # Ollama OOM crash
                if "runner process has terminated" in last_error or "status code: 500" in last_error:
                    print("[API] ⏳ Ollama crashed — waiting 3s...")
                    time.sleep(3)
                    continue

                # Missing package
                if "No module named" in last_error:
                    installed = try_auto_install(last_error)
                    if installed:
                        print(f"[API] 🔁 Retrying after installing {installed}...")
                        continue

                # Ask Llama to fix — use scraper-specific prompt for node_1
                print(f"[API] 🔧 Asking Llama to fix '{request.node_label}'...")
                if scraper:
                    fix_sys = SCRAPER_FIX_PROMPT.format(error=last_error[:300], limit=10)
                    user_msg = (
                        f"Broken scraper:\n{code}\n\n"
                        f"Error:\n{last_error}\n\n"
                        f"Return ONLY the fixed Python scraper code."
                    )
                else:
                    fix_sys = GENERIC_FIX_PROMPT
                    past = recall(request.task_description)
                    user_msg = (
                        f"{past}\n\nBroken code:\n{code}\n\nError:\n{last_error}\n\nReturn ONLY raw Python code."
                    ).strip()

                fix_response = ollama.chat(
                    model="llama3",
                    messages=[
                        {"role": "system", "content": fix_sys},
                        {"role": "user", "content": user_msg}
                    ],
                    options={"temperature": 0.1}
                )
                fixed = re.sub(r"```python|```", "", fix_response["message"]["content"]).strip()

                # Hard reject: if Llama replaced the scraper with SMTP code, ignore and retry
                if scraper and ("smtp" in fixed.lower() or "smtplib" in fixed.lower()):
                    print("[API] 🚫 Llama injected SMTP into scraper fix — rejected, retrying original...")
                    code = original_code
                    continue

                # Strip prose preamble
                lines_f = fixed.split("\n")
                cs = 0
                for i, line in enumerate(lines_f):
                    s = line.strip()
                    if s.startswith(("import ", "from ", "def ", "class ", "#", "headers", "url ", "response", "previous_output")):
                        cs = i; break
                    if s and not s[0].isupper():
                        cs = i; break
                code = "\n".join(lines_f[cs:]).strip()
                fixed_code = code
                print(f"[API] 🔁 Retrying with fixed code (attempt {attempt + 2})...")

        except subprocess.TimeoutExpired:
            last_error = f"Timed out after {EXEC_TIMEOUT}s"
            print(f"[API] ⏱ Timeout on '{request.node_label}'")
            break
        except Exception as e:
            last_error = str(e)
            print(f"[API] 💥 Unexpected: {e}")
            break

    return {
        "status": "error",
        "output": None,
        "error": last_error,
        "fixed_code": None,
        "attempts": MAX_RETRIES
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)