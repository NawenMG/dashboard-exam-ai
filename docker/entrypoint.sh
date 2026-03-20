#!/bin/sh
set -e

: "${SEED_STRICT:=false}"
: "${RUN_SEED:=true}"

echo "==> Waiting for DB..."
python - <<'PY'
import os, time, asyncio
import asyncpg

# SQLAlchemy async URL: postgresql+asyncpg://user:pass@host:port/db
# asyncpg wants: postgresql://user:pass@host:port/db
url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://", 1)

async def check():
    conn = await asyncpg.connect(url)
    try:
        v = await conn.fetchval("SELECT 1")
        return v
    finally:
        await conn.close()

for i in range(30):
    try:
        v = asyncio.run(check())
        print("DB OK", v)
        break
    except Exception as e:
        print("DB not ready yet:", e)
        time.sleep(2)
else:
    raise SystemExit("DB not ready after retries")
PY

echo "==> Running Alembic migrations..."
alembic upgrade head

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Running seeds..."
  if [ "$SEED_STRICT" = "true" ]; then
    python -m app.seeds.seed
  else
    python -m app.seeds.seed || echo "!! Seed failed but SEED_STRICT=false -> continuing"
  fi
else
  echo "==> Skipping seeds (RUN_SEED=false)"
fi

echo "==> Starting FastAPI..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*"