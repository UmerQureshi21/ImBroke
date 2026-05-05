import csv
import io
import json
from datetime import datetime

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .database import get_conn, init_db

load_dotenv()

app = FastAPI(title="Budgeter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Budgeter API is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def parse_td_csv(content: str) -> list[dict]:
    """Parse TD bank CSV: date, description, debit, credit, balance (no header row)."""
    transactions = []
    reader = csv.reader(io.StringIO(content))
    for row in reader:
        if len(row) < 4:
            continue
        date_str = row[0].strip()
        merchant = row[1].strip()
        debit_str = row[2].strip()

        # Skip credits/payments (no debit amount)
        if not debit_str:
            continue
        try:
            amount = float(debit_str)
        except ValueError:
            continue
        if amount <= 0:
            continue

        try:
            date = datetime.strptime(date_str, "%m/%d/%Y").date().isoformat()
        except ValueError:
            continue

        transactions.append({"date": date, "merchant": merchant, "amount": amount})

    return transactions


def categorize_with_claude(transactions: list[dict]) -> list[dict]:
    """Batch-categorize merchant names using Claude, returns transactions with category added."""
    if not transactions:
        return []

    client = anthropic.Anthropic()
    merchants = [t["merchant"] for t in transactions]

    prompt = f"""Categorize each bank transaction merchant name into exactly one of these categories:

- Transport: gas stations, transit cards (Presto), bus, subway, Uber, Lyft, parking
- Entertainment: streaming services, Claude.ai, ElevenLabs, YouTube, gaming, movies, sports events, clubs, subscriptions
- Shopping: groceries, retail stores, convenience stores, No Frills, Hasty Market, online shopping
- Health: pharmacy, medical, dental, gym, fitness
- Dining Out: restaurants, fast food (McDonald's, Popeyes, Dave's Hot Chicken), cafes, food courts, concessions
- Personal Care: haircuts, beauty salons, spa, personal hygiene
- Other: donations, religious institutions (Masjid), anything that doesn't fit above

Merchants:
{json.dumps(merchants, indent=2)}

Return ONLY a valid JSON array with one entry per merchant in the same order:
[{{"merchant": "MERCHANT NAME", "category": "Category"}}]"""

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()

    # Strip markdown code fences if Claude wrapped the JSON
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.split("```")[0].strip()

    results: list[dict] = json.loads(text)
    cat_map = {item["merchant"]: item["category"] for item in results}

    for t in transactions:
        t["category"] = cat_map.get(t["merchant"], "Other")

    return transactions


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    # utf-8-sig strips the BOM that Excel/TD sometimes adds
    content = (await file.read()).decode("utf-8-sig")

    transactions = parse_td_csv(content)
    if not transactions:
        raise HTTPException(
            status_code=400,
            detail="No expense transactions found. Make sure the file is a TD bank CSV.",
        )

    transactions = categorize_with_claude(transactions)

    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = []
            for t in transactions:
                cur.execute(
                    "INSERT INTO transactions (date, merchant, amount, category) VALUES (%s, %s, %s, %s) RETURNING id",
                    (t["date"], t["merchant"], t["amount"], t["category"]),
                )
                row_id = cur.fetchone()["id"]
                rows.append({"id": row_id, **t})

    return {
        "message": f"Uploaded and categorized {len(rows)} transactions",
        "transactions": rows,
    }


@app.get("/transactions")
def get_transactions():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, date, merchant, amount, category FROM transactions ORDER BY date DESC"
            )
            rows = cur.fetchall()
    return [dict(r) for r in rows]
