import contextlib
import os

import psycopg2
import psycopg2.extras

# Schema for fresh installs — tables already existing are unaffected (IF NOT EXISTS).
_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    merchant TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT date_trunc('hour', CURRENT_TIMESTAMP),
    UNIQUE (user_id, date, merchant, amount)
);

CREATE TABLE IF NOT EXISTS budgets (
    user_id INTEGER NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    monthly_limit REAL NOT NULL,
    PRIMARY KEY (user_id, category)
);

CREATE TABLE IF NOT EXISTS categories (
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    PRIMARY KEY (user_id, name)
);
"""

# Each migration is idempotent — safe to re-run on every startup.
_MIGRATIONS = [
    # 0: deduplicate then add unique constraint on legacy schema (no user_id)
    """
    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'transactions_date_merchant_amount_key'
        ) THEN
            DELETE FROM transactions
            WHERE id NOT IN (
                SELECT MIN(id) FROM transactions GROUP BY date, merchant, amount
            );
            ALTER TABLE transactions ADD CONSTRAINT transactions_date_merchant_amount_key UNIQUE (date, merchant, amount);
        END IF;
    END $$;
    """,
    # 1: created_at hour precision
    "ALTER TABLE transactions ALTER COLUMN created_at SET DEFAULT date_trunc('hour', CURRENT_TIMESTAMP);",
    # 2: add user_id to transactions, assign existing rows to first user
    """
    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'transactions' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
            UPDATE transactions SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL;
            ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
        END IF;
    END $$;
    """,
    # 3: add user_id to budgets, assign existing rows to first user, fix primary key
    """
    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'budgets' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE budgets ADD COLUMN user_id INTEGER REFERENCES users(id);
            UPDATE budgets SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1) WHERE user_id IS NULL;
            ALTER TABLE budgets ALTER COLUMN user_id SET NOT NULL;
            ALTER TABLE budgets DROP CONSTRAINT budgets_pkey;
            ALTER TABLE budgets ADD PRIMARY KEY (user_id, category);
        END IF;
    END $$;
    """,
    # 4: replace old unique constraint with per-user one
    """
    DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_date_merchant_amount_key') THEN
            ALTER TABLE transactions DROP CONSTRAINT transactions_date_merchant_amount_key;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_user_date_merchant_amount_key') THEN
            ALTER TABLE transactions ADD CONSTRAINT transactions_user_date_merchant_amount_key UNIQUE (user_id, date, merchant, amount);
        END IF;
    END $$;
    """,
    # 5: seed default categories for existing users who have none yet
    """
    DO $$ DECLARE
        uid INTEGER;
        cats TEXT[] := ARRAY['Dining Out','Entertainment','Health & Wellness','Other','Personal Care','Shopping','Tim Hortons','Transport'];
        cat TEXT;
    BEGIN
        FOR uid IN SELECT id FROM users LOOP
            IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = uid) THEN
                FOREACH cat IN ARRAY cats LOOP
                    INSERT INTO categories (user_id, name) VALUES (uid, cat) ON CONFLICT DO NOTHING;
                END LOOP;
            END IF;
        END LOOP;
    END $$;
    """,
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
