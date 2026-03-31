import subprocess
import json
import sys
import os
import ollama
import re
import httpx
from memory1 import save_node, recall

try:
    httpx.get("http://localhost:11434")
    print("✅ Ollama is awake and ready!")
except httpx.ConnectError:
    print("❌ ERROR: Ollama is not running.")

os.makedirs("outputs", exist_ok=True)

FIX_PROMPT = """You are a Python debugger. Fix the broken script below.
Return ONLY raw Python code. No explanation, no markdown, no code fences.

RULES:
- Fix the exact error shown, keep the same goal
- All file outputs go to 'outputs/' folder
- Include ALL necessary imports
- The variable `previous_output` is already defined above your code — do NOT redefine it
"""

def run_code(code: str, timeout: int = 60) -> tuple[bool, str, str]:
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True, text=True, timeout=timeout
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", f"Timeout after {timeout}s"
    except Exception as e:
        return False, "", str(e)


def fix_code(original_code: str, error: str, task_context: str) -> str:
    print("[Sandbox] 🔧 Asking Llama 3 to fix...")
    past = recall(task_context)
    response = ollama.chat(
        model="llama3",
        messages=[
            {"role": "system", "content": FIX_PROMPT},
            {"role": "user", "content": (
                f"{past}\n\nBroken code:\n{original_code}\n\n"
                f"Error:\n{error}\n\nReturn ONLY raw Python code."
            ).strip()}
        ],
        options={"temperature": 0.1}
    )
    fixed = re.sub(r"```python|```", "", response["message"]["content"]).strip()
    lines = fixed.split("\n")
    start = 0
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith(("import ", "from ", "def ", "class ", "#", "previous_output")):
            start = i; break
        if s and not s[0].isupper():
            start = i; break
    return "\n".join(lines[start:]).strip()


def execute_node(node: dict, task_description: str, max_retries: int = 3) -> dict:
    node_id    = node["id"]
    node_label = node["label"]
    code       = node["code"]

    print(f"\n[Sandbox] ▶ Running: '{node_label}' ({node_id})")

    for attempt in range(max_retries):
        print(f"[Sandbox] Attempt {attempt + 1}/{max_retries}...")
        success, stdout, stderr = run_code(code)

        if success:
            print(f"[Sandbox] ✅ '{node_label}' succeeded!")
            # Clean preview: show only first 2 meaningful lines, no row counts
            preview = [l for l in stdout.splitlines() if l.strip()][:2]
            if preview:
                print(f"[Sandbox] Preview: {preview[0][:120]}")

            save_node(task_description=task_description, node_label=node_label,
                      code=code, output=stdout)
            node["status"] = "done"
            node["output"] = stdout
            node["error"]  = None
            node["code"]   = code
            return node
        else:
            print(f"[Sandbox] ❌ Attempt {attempt + 1} failed: {stderr[:200]}")
            if attempt < max_retries - 1:
                code = fix_code(original_code=code, error=stderr, task_context=task_description)
                print("[Sandbox] 🔁 Retrying with fixed code...")
            else:
                print(f"[Sandbox] 💀 '{node_label}' failed after {max_retries} attempts")
                node["status"] = "error"
                node["output"] = None
                node["error"]  = stderr
                node["code"]   = code

    return node


def execute_plan(plan: dict, task_description: str) -> dict:
    nodes = {n["id"]: n for n in plan["nodes"]}
    edges = plan["edges"]

    # Build execution order from edges
    ordered_ids, seen = [], set()
    for edge in edges:
        if edge["source"] not in seen:
            ordered_ids.append(edge["source"]); seen.add(edge["source"])
    for edge in edges:
        if edge["target"] not in seen:
            ordered_ids.append(edge["target"]); seen.add(edge["target"])
    for nid in nodes:
        if nid not in seen:
            ordered_ids.append(nid)

    print(f"\n[Sandbox] 📋 Order: {' → '.join(ordered_ids)}")

    previous_output = ""

    for node_id in ordered_ids:
        node = nodes[node_id]

        if previous_output:
            safe = previous_output.strip()
            # ── CRITICAL FIX ─────────────────────────────────────────────────
            # repr() safely escapes ALL special characters including single quotes,
            # backslashes, newlines — triple-quotes break on any apostrophe in data.
            injection = f"previous_output = {repr(safe)}\n\n"
            node["code"] = injection + node["code"]
            print(f"[Sandbox] 💉 Injected {len(safe.splitlines())} lines → {node_id}")

        updated = execute_node(node, task_description)
        nodes[node_id] = updated

        if updated["status"] == "error":
            print(f"\n[Sandbox] 🛑 Stopped at '{node_id}'")
            break

        previous_output = updated["output"] or ""

    plan["nodes"] = list(nodes.values())
    return plan


def save_result(plan: dict, filename: str = "outputs/result.json"):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2)
    print(f"\n[Sandbox] 📄 Saved to {filename}")


if __name__ == "__main__":
    plan_path = "outputs/plan.json"
    if not os.path.exists(plan_path):
        print(f"❌ No plan at {plan_path}. Run planner3.py first.")
        exit()

    with open(plan_path, "r") as f:
        plan = json.load(f)

    print(f"[Sandbox] 📂 Loaded: {len(plan['nodes'])} nodes")
    task = plan.get("_task", "Scrape trending GitHub repos and save to CSV")

    final = execute_plan(plan, task)
    save_result(final)

    print("\n[Sandbox] 📊 Results:")
    for n in final["nodes"]:
        icon = "✅" if n["status"] == "done" else "❌"
        print(f"  {icon} {n['id']} — {n['label']}: {n['status']}")
    print("\n[Sandbox] 🏁 Done! Check outputs/")