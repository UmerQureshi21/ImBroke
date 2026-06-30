import csv
import io
import json
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()  # must run before importing auth (which reads SECRET_KEY from env)

import anthropic  # noqa: E402
from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from .auth import (  # noqa: E402
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
)
from .database import get_conn, init_db  # noqa: E402

DEFAULT_CATEGORIES = [
    'Dining Out', 'Entertainment', 'Health & Wellness', 'Other',
    'Personal Care', 'Shopping', 'Tim Hortons', 'Transport',
]

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
MAX_UPLOADS = int(os.getenv("MAX_UPLOADS", "3"))
MAX_CSV_SIZE_MB = int(os.getenv("MAX_CSV_SIZE_MB", "5"))

app = FastAPI(title="Budgeter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
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

class RegisterIn(BaseModel):
    email: str
    password: str
    name: str


class LoginIn(BaseModel):
    email: str
    password: str


def _issue_tokens(user_id: int, name: str, response: Response) -> dict:
    """Create an access + refresh token pair, persist the refresh token, and set it as an HttpOnly cookie."""
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
                (user_id, refresh_token, expires_at),
            )
    secure = FRONTEND_URL.startswith("https://")
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="none" if secure else "lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "name": name,
    }


@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, response: Response):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Email already registered.")
            cur.execute(
                "INSERT INTO users (email, hashed_password, name) VALUES (%s, %s, %s) RETURNING id",
                (body.email, hash_password(body.password), body.name.strip()),
            )
            user_id = cur.fetchone()["id"]
            for cat in DEFAULT_CATEGORIES:
                cur.execute(
                    "INSERT INTO categories (user_id, name) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (user_id, cat),
                )
    return _issue_tokens(user_id, body.name.strip(), response)


@app.post("/login")
def login(body: LoginIn, response: Response):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, hashed_password, name FROM users WHERE email = %s", (body.email,))
            row = cur.fetchone()
    if not row or not verify_password(body.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return _issue_tokens(row["id"], row["name"], response)


@app.post("/refresh")
def refresh(request: Request):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token.")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM refresh_tokens WHERE expires_at < %s", (datetime.now(timezone.utc),))
            cur.execute(
                "SELECT user_id, expires_at FROM refresh_tokens WHERE token = %s",
                (refresh_token,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")
    if row["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token has expired.")
    return {"access_token": create_access_token(row["user_id"]), "token_type": "bearer"}


@app.post("/logout")
def logout(response: Response, user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM refresh_tokens WHERE user_id = %s", (user_id,))
    secure = FRONTEND_URL.startswith("https://")
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=secure,
        samesite="none" if secure else "lax",
        path="/",
    )
    return {"message": "Logged out."}


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
    # ── Rate limiting ─────────────────────────────────────────
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT upload_count FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if row and row["upload_count"] >= MAX_UPLOADS:
                raise HTTPException(
                    status_code=429,
                    detail=f"Upload limit reached ({MAX_UPLOADS}). Contact admin to increase.",
                )

    # ── File size check ───────────────────────────────────────
    raw = await file.read()
    if len(raw) > MAX_CSV_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_CSV_SIZE_MB} MB.",
        )
    content = raw.decode("utf-8-sig")

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
            # increment upload count
            cur.execute(
                "UPDATE users SET upload_count = upload_count + 1 WHERE id = %s RETURNING upload_count",
                (user_id,),
            )
            new_count = cur.fetchone()["upload_count"]

    parts = [f"Added {len(rows)} new transaction{'s' if len(rows) != 1 else ''}"]
    if skipped:
        parts.append(f"{skipped} already existed")

    return {
        "message": ", ".join(parts) + ".",
        "transactions": rows,
        "uploads_remaining": max(0, MAX_UPLOADS - new_count),
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


@app.delete("/budgets/{category}")
def delete_budget(category: str, user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM budgets WHERE user_id = %s AND category = %s", (user_id, category))
    return {"deleted": category}


# ── Categories ────────────────────────────────────────────

class CategoryIn(BaseModel):
    name: str


@app.get("/categories")
def get_categories(user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM categories WHERE user_id = %s ORDER BY name", (user_id,))
            rows = cur.fetchall()
    return [r["name"] for r in rows]


@app.post("/categories", status_code=status.HTTP_201_CREATED)
def add_category(cat: CategoryIn, user_id: int = Depends(get_current_user)):
    name = cat.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty.")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO categories (user_id, name) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (user_id, name),
            )
    return {"name": name}


@app.delete("/categories/{name}")
def delete_category(name: str, user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM categories WHERE user_id = %s AND name = %s", (user_id, name))
            cur.execute("DELETE FROM budgets WHERE user_id = %s AND category = %s", (user_id, name))
    return {"deleted": name}


class TransactionIn(BaseModel):
    date: str
    merchant: str
    amount: float
    category: str


class TransactionUpdate(BaseModel):
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


@app.patch("/transactions/{txn_id}")
def update_transaction(txn_id: int, body: TransactionUpdate, user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE transactions SET category = %s WHERE id = %s AND user_id = %s RETURNING id",
                (body.category, txn_id, user_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Transaction not found.")
    return {"id": txn_id, "category": body.category}


@app.delete("/transactions/{txn_id}")
def delete_transaction(txn_id: int, user_id: int = Depends(get_current_user)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM transactions WHERE id = %s AND user_id = %s RETURNING id",
                (txn_id, user_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Transaction not found.")
    return {"deleted": txn_id}


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
