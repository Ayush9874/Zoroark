import ollama
import json
import re
import httpx
import os
from memory1 import recall

os.makedirs("outputs", exist_ok=True)
print("[Planner] Outputs folder ready")

try:
    httpx.get("http://localhost:11434", timeout=3)
    print("[Planner] Ollama running")
except httpx.ConnectError:
    print("[Planner] ERROR: Ollama not running")

# ─────────────────────────────────────────────────────────────────────────────
# HARDCODED VERIFIED SCRAPERS
# These bypass Llama entirely. They are tested and working.
# ─────────────────────────────────────────────────────────────────────────────

GITHUB_SCRAPER = r"""import requests
from bs4 import BeautifulSoup
import sys

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

try:
    response = requests.get('https://github.com/trending', headers=headers, timeout=20)
except Exception as e:
    print('SKIPPED: Could not connect to GitHub - ' + str(e))
    sys.exit(0)

if response.status_code != 200:
    print('SKIPPED: GitHub returned status ' + str(response.status_code))
    sys.exit(0)

soup = BeautifulSoup(response.text, 'html.parser')
articles = soup.select('article.Box-row')

if not articles:
    print('SKIPPED: GitHub page structure changed - no articles found')
    sys.exit(0)

print('Repo|URL|Stars|Language')
count = 0
for article in articles:
    if count >= LIMIT:
        break
    a = article.select_one('h2 a')
    if not a:
        continue
    href = a.get('href', '').strip()
    name = href.lstrip('/')
    url = 'https://github.com' + href
    stars = '0'
    for el in article.select('a.Link--muted'):
        t = el.get_text(strip=True).replace(',', '').replace(' ', '')
        if t and (t.isdigit() or (t[:-1].isdigit() and t[-1].lower() == 'k')):
            stars = t
            break
    lang_el = article.select_one('[itemprop=programmingLanguage]')
    lang = lang_el.get_text(strip=True) if lang_el else 'Unknown'
    print(name.replace('|', '-') + '|' + url + '|' + stars + '|' + lang)
    count += 1

if count == 0:
    print('SKIPPED: Parsed page but found no repos')
    sys.exit(0)
"""

HN_SCRAPER = r"""import requests
from bs4 import BeautifulSoup
import sys

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
try:
    response = requests.get('https://news.ycombinator.com', headers=headers, timeout=20)
except Exception as e:
    print('SKIPPED: Could not connect - ' + str(e))
    sys.exit(0)

if response.status_code != 200:
    print('SKIPPED: HN returned ' + str(response.status_code))
    sys.exit(0)

soup = BeautifulSoup(response.text, 'html.parser')
rows = soup.select('tr.athing')
print('Title|URL|Score|Comments')
count = 0
for row in rows:
    if count >= LIMIT:
        break
    title_el = row.select_one('span.titleline a')
    if not title_el:
        continue
    title = title_el.get_text(strip=True).replace('|', '-')
    url = title_el.get('href', '')
    if url.startswith('item?'):
        url = 'https://news.ycombinator.com/' + url
    subrow = row.find_next_sibling('tr')
    score, comments = '0', '0'
    if subrow:
        score_el = subrow.select_one('span.score')
        if score_el:
            score = score_el.get_text(strip=True).replace(' points','').replace(' point','')
        for link in subrow.select('a'):
            t = link.get_text(strip=True)
            if 'comment' in t or t == 'discuss':
                comments = t.replace(' comments','').replace(' comment','').replace('discuss','0')
                break
    print(title + '|' + url + '|' + score + '|' + comments)
    count += 1

if count == 0:
    print('SKIPPED: No HN stories found')
    sys.exit(0)
"""

QUOTES_SCRAPER = r"""import requests
from bs4 import BeautifulSoup
import sys

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
try:
    response = requests.get('http://quotes.toscrape.com', headers=headers, timeout=20)
except Exception as e:
    print('SKIPPED: Could not connect - ' + str(e))
    sys.exit(0)

if response.status_code != 200:
    print('SKIPPED: Site returned ' + str(response.status_code))
    sys.exit(0)

soup = BeautifulSoup(response.text, 'html.parser')
quote_divs = soup.select('div.quote')
print('Quote|Author|Tags')
count = 0
for q in quote_divs:
    if count >= LIMIT:
        break
    text_el = q.select_one('span.text')
    author_el = q.select_one('small.author')
    if not text_el or not author_el:
        continue
    text = text_el.get_text(strip=True).strip('"').strip('\u201c').strip('\u201d').replace('|','-')
    author = author_el.get_text(strip=True)
    tags = [t.get_text(strip=True) for t in q.select('a.tag')][:3]
    print(text + '|' + author + '|' + ' '.join(tags))
    count += 1

if count == 0:
    print('SKIPPED: No quotes found')
    sys.exit(0)
"""

BOOKS_SCRAPER = r"""import requests
from bs4 import BeautifulSoup
import sys

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
try:
    response = requests.get('http://books.toscrape.com', headers=headers, timeout=20)
except Exception as e:
    print('SKIPPED: Could not connect - ' + str(e))
    sys.exit(0)

if response.status_code != 200:
    print('SKIPPED: Site returned ' + str(response.status_code))
    sys.exit(0)

soup = BeautifulSoup(response.text, 'html.parser')
books = soup.select('article.product_pod')
RATING = {'One':'1','Two':'2','Three':'3','Four':'4','Five':'5'}
print('Title|Price|Rating|URL')
count = 0
for book in books:
    if count >= LIMIT:
        break
    title_el = book.select_one('h3 a')
    price_el = book.select_one('p.price_color')
    rating_el = book.select_one('p.star-rating')
    if not title_el or not price_el:
        continue
    title = title_el.get('title', title_el.get_text(strip=True)).replace('|','-')
    price = price_el.get_text(strip=True)
    rating = RATING.get(rating_el['class'][1], '?') if rating_el and len(rating_el.get('class',[])) > 1 else '?'
    href = title_el.get('href','').replace('../','')
    url = 'http://books.toscrape.com/catalogue/' + href
    print(title + '|' + price + '|' + rating + '|' + url)
    count += 1

if count == 0:
    print('SKIPPED: No books found')
    sys.exit(0)
"""

# ── Google News RSS scraper ───────────────────────────────────────────────────
# Uses Google News RSS feed — real Google search results, no API key needed.
# SEARCH_QUERY and LIMIT are replaced at build time.
GOOGLE_NEWS_SCRAPER = r"""import requests
import xml.etree.ElementTree as ET
import urllib.parse
import sys

QUERY = "SEARCH_QUERY"
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

url = 'https://news.google.com/rss/search?q=' + urllib.parse.quote(QUERY) + '&hl=en-IN&gl=IN&ceid=IN:en'

try:
    response = requests.get(url, headers=headers, timeout=20)
except Exception as e:
    print('SKIPPED: Could not connect to Google News - ' + str(e))
    sys.exit(0)

if response.status_code != 200:
    print('SKIPPED: Google News returned ' + str(response.status_code))
    sys.exit(0)

try:
    root = ET.fromstring(response.content)
except Exception as e:
    print('SKIPPED: Could not parse response - ' + str(e))
    sys.exit(0)

items = root.findall('.//item')
if not items:
    print('SKIPPED: No news found for: ' + QUERY)
    sys.exit(0)

print('Title|URL|Published|Source')
count = 0
for item in items:
    if count >= LIMIT:
        break
    title = (item.findtext('title') or '').replace('|', '-').strip()
    link = (item.findtext('link') or '').strip()
    pubdate = (item.findtext('pubDate') or '').strip()
    source_el = item.find('source')
    source = source_el.text.strip() if source_el is not None and source_el.text else ''
    if title and link:
        print(title + '|' + link + '|' + pubdate + '|' + source)
        count += 1

if count == 0:
    print('SKIPPED: No valid news items found')
    sys.exit(0)
"""

LINKEDIN_SKIP = """import sys
print('SKIPPED: LinkedIn requires login and blocks all automated scraping.')
print('Try: finance news, tech news, github repos, hacker news, quotes, books')
sys.exit(0)
"""


def build_news_query(task: str) -> str:
    """Extract a clean search query from the task for Google News."""
    stop = {'scrape','scraping','get','fetch','find','save','to','csv','top','the',
            'a','an','and','for','from','of','in','on','by','with','all','list',
            'trending','give','me','show','about','regarding','latest','recent',
            'today','some','please','can','you','just','want','need'}
    words = re.findall(r'[a-zA-Z0-9]+', task.lower())
    meaningful = [w for w in words if w not in stop][:5]
    query = ' '.join(meaningful)
    # Make sure "news" is in the query if it makes sense
    if 'news' not in query and len(query) < 30:
        query = query + ' news'
    return query or task[:60]


def get_scraper_code(task: str, limit: int) -> str:
    t = task.lower()

    # GitHub / repos
    if any(w in t for w in ['github', 'repo', 'repository', 'trending repos']):
        print("[Planner] Using hardcoded GitHub scraper")
        return GITHUB_SCRAPER.replace('LIMIT', str(limit))

    # Hacker News — only when explicitly asked
    if any(w in t for w in ['hacker news', 'hackernews', 'ycombinator', 'y combinator']):
        print("[Planner] Using hardcoded HN scraper")
        return HN_SCRAPER.replace('LIMIT', str(limit))

    # Quotes
    if 'quote' in t:
        print("[Planner] Using hardcoded Quotes scraper")
        return QUOTES_SCRAPER.replace('LIMIT', str(limit))

    # Books
    if 'book' in t:
        print("[Planner] Using hardcoded Books scraper")
        return BOOKS_SCRAPER.replace('LIMIT', str(limit))

    # LinkedIn — always blocked
    if 'linkedin' in t:
        print("[Planner] LinkedIn blocked — returning skip message")
        return LINKEDIN_SKIP

    # ── News — ANY mention of news goes to Google News RSS ───────────────────
    # This catches: "finance news", "tech news", "crypto news",
    # "latest news", "business news India", "stock market news", etc.
    # No longer requires saying "hacker news" or "ycombinator".
    news_keywords = ['news', 'headline', 'article', 'market update', 'stock market',
                     'finance', 'financial', 'economy', 'economic', 'crypto',
                     'bitcoin', 'investment', 'startup', 'technology news',
                     'sports news', 'politics', 'breaking']
    if any(w in t for w in news_keywords):
        query = build_news_query(task)
        print(f"[Planner] Using Google News RSS scraper — query: '{query}'")
        return (GOOGLE_NEWS_SCRAPER
                .replace('SEARCH_QUERY', query)
                .replace('LIMIT', str(limit)))

    # ── Generic fallback: Google News search ─────────────────────────────────
    # For anything else we can't specifically handle, search Google News.
    # This gives real, current internet results without needing an API key.
    query = build_news_query(task)
    print(f"[Planner] Unknown target — falling back to Google News search: '{query}'")
    return (GOOGLE_NEWS_SCRAPER
            .replace('SEARCH_QUERY', query)
            .replace('LIMIT', str(limit)))


def infer_filename(task: str) -> str:
    t = task.lower()
    if any(w in t for w in ['github', 'repo']): return "github_repos"
    if any(w in t for w in ['hacker', 'ycombinator', 'y combinator']): return "hn_news"
    if 'quote' in t: return "quotes"
    if 'book' in t: return "books"
    if 'finance' in t or 'financial' in t: return "finance_news"
    if 'crypto' in t or 'bitcoin' in t: return "crypto_news"
    if 'tech' in t and 'news' in t: return "tech_news"
    if 'stock' in t: return "stock_news"
    if 'news' in t or 'headline' in t: return "news"
    if 'amazon' in t: return "amazon_products"
    if 'product' in t or 'price' in t: return "products"
    words = re.findall(r'[a-z]+', t)
    skip = {"scrape","get","fetch","find","save","to","csv","top","the","a","an",
            "and","for","from","of","in","on","by","with","all","list","trending"}
    return "_".join([w for w in words if w not in skip][:2]) or "results"


def extract_limit(task: str) -> int:
    m = re.search(r'\b(\d+)\b', task)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 100:
            return n
    return 10


def build_pipeline(task: str, scraper_code: str) -> dict:
    csv_name = infer_filename(task)
    csv_path = f"outputs/{csv_name}.csv"

    node2_code = (
        "import csv, os, sys\n"
        "os.makedirs('outputs', exist_ok=True)\n"
        "if 'previous_output' not in dir():\n"
        "    print('ERROR: No data from scraper')\n"
        "    sys.exit(1)\n"
        "lines = [l.strip() for l in previous_output.strip().split('\\n') if l.strip()]\n"
        "lines = [l for l in lines if not l.startswith('[')]\n"
        "if not lines:\n"
        "    print('ERROR: Scraper produced no output')\n"
        "    sys.exit(1)\n"
        "skip_words = ['skipped:', 'no results', 'error:', 'could not']\n"
        "if any(s in lines[0].lower() for s in skip_words):\n"
        "    print('Scraper reported: ' + lines[0])\n"
        "    sys.exit(1)\n"
        "header = [c.strip() for c in lines[0].split('|')]\n"
        "data_lines = lines[1:]\n"
        "if not data_lines:\n"
        "    print('ERROR: Header received but no data rows')\n"
        "    sys.exit(1)\n"
        f"with open('{csv_path}', 'w', newline='', encoding='utf-8') as f:\n"
        "    writer = csv.writer(f)\n"
        "    writer.writerow(header)\n"
        "    written = 0\n"
        "    for line in data_lines:\n"
        "        cols = [c.strip() for c in line.split('|')]\n"
        "        if any(c for c in cols):\n"
        "            writer.writerow(cols)\n"
        "            written += 1\n"
        f"print('Results saved to {csv_path}')\n"
        "if written == 0:\n"
        "    print('WARNING: No rows written — scraper output may be malformed')\n"
        "    sys.exit(1)\n"
    )

    node3_code = (
        f"import os\n"
        f"csv_path = '{csv_path}'\n"
        "if os.path.exists(csv_path):\n"
        "    with open(csv_path, 'r', encoding='utf-8') as f:\n"
        "        rows = f.readlines()\n"
        "    header = rows[0].strip() if rows else ''\n"
        "    data = rows[1:] if len(rows) > 1 else []\n"
        "    print('Pipeline complete — ' + csv_path)\n"
        "    print('Columns: ' + header)\n"
        "    print('Preview:')\n"
        "    for row in data[:3]:\n"
        "        print('  ' + row.strip())\n"
        "else:\n"
        "    print('WARNING: Output file not found at ' + csv_path)\n"
    )

    return {
        "_task": task,
        "nodes": [
            {"id": "node_1", "label": "Scrape Data", "type": "scraper",  "status": "pending", "code": scraper_code, "output": None, "error": None},
            {"id": "node_2", "label": "Save to CSV", "type": "executor", "status": "pending", "code": node2_code,   "output": None, "error": None},
            {"id": "node_3", "label": "Summary",     "type": "output",   "status": "pending", "code": node3_code,   "output": None, "error": None},
        ],
        "edges": [
            {"source": "node_1", "target": "node_2"},
            {"source": "node_2", "target": "node_3"},
        ],
    }


def plan_task_safe(user_prompt: str, retries: int = 3) -> dict:
    limit = extract_limit(user_prompt)
    last_error = None
    for attempt in range(retries):
        try:
            scraper_code = get_scraper_code(user_prompt, limit)
            if len(scraper_code.strip()) < 20:
                raise ValueError("Scraper code too short")
            plan = build_pipeline(user_prompt, scraper_code)
            print(f"[Planner] {len(plan['nodes'])}-node pipeline ready")
            return plan
        except Exception as e:
            last_error = e
            print(f"[Planner] Attempt {attempt+1} failed: {e}")
    raise RuntimeError(f"[Planner] Failed: {last_error}")


if __name__ == "__main__":
    import sys as _sys
    task = " ".join(_sys.argv[1:]) or "Scrape top 5 trending GitHub repos"
    result = plan_task_safe(task)
    os.makedirs("outputs", exist_ok=True)
    with open("outputs/plan.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"Plan saved: {len(result['nodes'])} nodes")
    for n in result['nodes']:
        print(f"  {n['id']}: {n['label']}")