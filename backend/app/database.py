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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
    category TEXT PRIMARY KEY,
    monthly_limit REAL NOT NULL
);
"""


def _dsn() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    return url


def init_db() -> None:
    conn = psycopg2.connect(_dsn())
    cur = conn.cursor()
    cur.execute(_SCHEMA)
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
