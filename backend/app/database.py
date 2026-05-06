import contextlib
import os

import psycopg2
import psycopg2.extras

_SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    date TEXT NOT NULL,
    merchant TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT date_trunc('hour', CURRENT_TIMESTAMP),
    UNIQUE (date, merchant, amount)
);

CREATE TABLE IF NOT EXISTS budgets (
    category TEXT PRIMARY KEY,
    monthly_limit REAL NOT NULL
);
"""

_MIGRATIONS = [
    """
    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'transactions_date_merchant_amount_key'
        ) THEN
            ALTER TABLE transactions ADD CONSTRAINT transactions_date_merchant_amount_key UNIQUE (date, merchant, amount);
        END IF;
    END $$;
    """,
    "ALTER TABLE transactions ALTER COLUMN created_at SET DEFAULT date_trunc('hour', CURRENT_TIMESTAMP);",
]


def _dsn() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    return url


def init_db() -> None:
    conn = psycopg2.connect(_dsn())
    cur = conn.cursor()
    cur.execute(_SCHEMA)
    for migration in _MIGRATIONS:
        cur.execute(migration)
    conn.commit()
    cur.close()
    conn.close()


@contextlib.contextmanager
def get_conn():
    conn = psycopg2.connect(_dsn(), cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
