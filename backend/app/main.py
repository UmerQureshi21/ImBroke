import csv
import io
import json
from datetime import datetime

import anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auth import create_token, get_current_user, hash_password, verify_password
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


# ── Auth ──────────────────────────────────────────────────────────────────────

class AuthIn(BaseModel):
    email: str
    password: str


@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: AuthIn):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Email already registered.")
            cur.execute(
                "INSERT INTO users (email, hashed_password) VALUES (%s, %s) RETURNING id",
                (body.email, hash_password(body.password)),
            )
            user_id = cur.fetchone()["id"]
    return {"access_token": create_token(user_id), "token_type": "bearer"}


@app.post("/login")
def login(body: AuthIn):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, hashed_password FROM users WHERE email = %s", (body.email,))
            row = cur.fetchone()
    if not row or not verify_password(body.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"access_token": create_token(row["id"]), "token_type": "bearer"}


# ── CSV parsing + categorization ──────────────────────────────────────────────

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
- Health & Wellness: pharmacy, medical, dental, gym, fitness
- Tim Hortons: Tim Hortons locations only
- Dining Out: restaurants, fast food (McDonald's, Popeyes, Dave's Hot Chicken, Osmow's), cafes, food courts, concessions, campus food (McMaster Hospitality Sale)
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


# ── Protected endpoints ───────────────────────────────────────────────────────

@app.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user),
):
    content = (await file.read()).decode("utf-8-sig")

    transactions = parse_td_csv(content)
    if not transactions:
        raise HTTPException(
            status_code=400,
            detail="No expense transactions found. Make sure the file is a TD bank CSV.",
        )

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT date, merchant, amount FROM transactions WHERE user_id = %s", (user_id,))
            existing = {(r["date"], r["merchant"], r["amount"]) for r in cur.fetchall()}

    new_transactions = [
        t for t in transactions
        if (t["date"], t["merchant"], t["amount"]) not in existing
    ]
    skipped = len(transactions) - len(new_transactions)

    if not new_transactions:
        return {
            "message": f"All {len(transactions)} transactions already exist, nothing added.",
            "transactions": [],
        }

    new_transactions = categorize_with_claude(new_transactions)

    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = []
            for t in new_transactions:
                cur.execute(
                    "INSERT INTO transactions (user_id, date, merchant, amount, category) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (user_id, date, merchant, amount) DO NOTHING RETURNING id",
                    (user_id, t["date"], t["merchant"], t["amount"], t["category"]),
                )
                result = cur.fetchone()
                if result:
                    rows.append({"id": result["id"], **t})

    parts = [f"Added {len(rows)} new transaction{'s' if len(rows) != 1 else ''}"]
    if skipped:
        parts.append(f"{skipped} already existed")

    return {
        "message": ", ".join(parts) + ".",
        "transactions": rows,
    }


class BudgetIn(BaseModel):
    category: str
    monthly_limit: float


@app.get("/budgets")
def get_budgets(user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT category, monthly_limit FROM budgets WHERE user_id = %s", (user_id,))
            rows = cur.fetchall()
    return {r["category"]: r["monthly_limit"] for r in rows}


@app.post("/budgets")
def upsert_budget(budget: BudgetIn, user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO budgets (user_id, category, monthly_limit) VALUES (%s, %s, %s)
                   ON CONFLICT (user_id, category) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit""",
                (user_id, budget.category, budget.monthly_limit),
            )
    return {"category": budget.category, "monthly_limit": budget.monthly_limit}


class TransactionIn(BaseModel):
    date: str
    merchant: str
    amount: float
    category: str


@app.post("/transactions")
def add_transaction(txn: TransactionIn, user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO transactions (user_id, date, merchant, amount, category) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (user_id, date, merchant, amount) DO NOTHING RETURNING id",
                (user_id, txn.date, txn.merchant, txn.amount, txn.category),
            )
            result = cur.fetchone()
    if not result:
        raise HTTPException(status_code=409, detail="A transaction with this date, merchant, and amount already exists.")
    return {"id": result["id"], "date": txn.date, "merchant": txn.merchant, "amount": txn.amount, "category": txn.category}


@app.get("/transactions")
def get_transactions(user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, date, merchant, amount, category FROM transactions WHERE user_id = %s ORDER BY date DESC",
                (user_id,),
            )
            rows = cur.fetchall()
    return [dict(r) for r in rows]
