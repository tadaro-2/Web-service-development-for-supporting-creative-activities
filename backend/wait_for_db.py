import os
import time

import psycopg


def main() -> None:
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    dbname = os.environ.get("POSTGRES_DB", "art_platform")
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "")

    timeout_s = float(os.environ.get("DB_WAIT_TIMEOUT_SEC", "60"))
    started = time.time()

    last_err: Exception | None = None
    while time.time() - started < timeout_s:
        try:
            with psycopg.connect(
                host=host,
                port=port,
                dbname=dbname,
                user=user,
                password=password,
                connect_timeout=3,
            ) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1;")
                    cur.fetchone()
            print("DB ready")
            return
        except Exception as e:
            last_err = e
            time.sleep(1.0)

    raise SystemExit(f"DB not ready after {timeout_s}s. Last error: {last_err!r}")


if __name__ == "__main__":
    main()

