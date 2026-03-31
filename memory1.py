import chromadb  # local vector database — stores and retrieves past node examples
import json
import os
from chromadb.utils import embedding_functions  # converts text to vectors for similarity search

# ── Setup ────────────────────────────────────────────────────────────────────
# PersistentClient saves the database to disk inside ./zoroark_memory/
# So memory survives between runs — the agent gets smarter over time
os.makedirs("zoroark_memory", exist_ok=True)

# SentenceTransformer runs locally, no API key needed
# all-MiniLM-L6-v2 is small, fast, and good enough for code similarity matching
embedder = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

client = chromadb.PersistentClient(path="./zoroark_memory")

# A "collection" is like a table in a normal database
# get_or_create means it won't crash if it already exists from a previous run
collection = client.get_or_create_collection(
    name="node_memory",
    embedding_function=embedder
)

# ── Save a successful node to memory ─────────────────────────────────────────
# Called after a node executes successfully in the sandbox (step 3.5)
# Stores the task, the label, the code that worked, and the output it produced
def save_node(task_description: str, node_label: str, code: str, output: str):
    # Build a unique ID from task + label (spaces replaced so ChromaDB is happy)
    doc_id = f"{task_description[:40]}_{node_label}".replace(" ", "_").replace("/", "_")

    # The document is what gets embedded and searched later
    # We pack all the useful info into one string
    document = f"Task: {task_description}\nNode: {node_label}\nCode:\n{code}\nOutput:\n{output}"

    collection.upsert(
        ids=[doc_id],          # unique identifier — upsert updates if already exists
        documents=[document],  # the text that gets converted to a vector
        metadatas=[{           # structured metadata — useful for filtering later
            "task": task_description,
            "label": node_label
        }]
    )
    print(f"[Memory] 💾 Saved node to memory: '{node_label}'")


# ── Recall similar past examples ─────────────────────────────────────────────
# Called inside planner.py before generating a new plan
# Finds the most similar past node executions and returns them as context
# The LLM uses these examples to write better code for the current task
def recall(task_description: str, n: int = 3) -> str:
    # Can't query more results than exist in the collection
    count = collection.count()
    if count == 0:
        print("[Memory] 📭 No past examples yet — starting fresh")
        return ""  # Return empty string, planner handles this gracefully

    results = collection.query(
        query_texts=[task_description],
        n_results=min(n, count)  # don't ask for more than we have
    )

    docs = results["documents"][0]
    if not docs:
        return ""

    # Format examples clearly so the LLM understands what it's looking at
    formatted = "\n\n---\n\n".join(docs)
    print(f"[Memory] 🔍 Found {len(docs)} similar past example(s)")
    return f"Here are similar tasks you have successfully completed before:\n\n{formatted}\n\nUse these as reference when writing code for the new task."


# ── Show everything in memory (debug utility) ────────────────────────────────
# Useful to call manually to see what's been stored so far
def show_all():
    count = collection.count()
    print(f"[Memory] 📚 Total nodes in memory: {count}")
    if count > 0:
        all_docs = collection.get()
        for i, doc in enumerate(all_docs["documents"]):
            print(f"\n[{i+1}] {all_docs['metadatas'][i]}")
            print(doc[:200] + "...")  # preview first 200 chars


# ── Entry point — smoke test ──────────────────────────────────────────────────
if __name__ == "__main__":
    print("[Test] Saving a fake node to memory...")
    save_node(
        task_description="Scrape top 5 GitHub trending repos and save to CSV",
        node_label="Scrape Trending Repos",
        code="import requests\nfrom bs4 import BeautifulSoup\nprint('scraped!')",
        output="scraped!"
    )

    print("\n[Test] Recalling similar task...")
    result = recall("scrape GitHub repositories and export to file")
    print(result)

    print("\n[Test] Showing all memory...")
    show_all()


