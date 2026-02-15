#!/bin/sh
set -e

: "${SEED_STRICT:=false}"
: "${RUN_SEED:=true}"

echo "==> Waiting for DB..."
python - <<'PY'
import os, time
import sqlalchemy as sa

url = os.environ["DATABASE_URL"]
for i in range(30):
    try:
        engine = sa.create_engine(url, pool_pre_ping=True)
        with engine.connect() as c:
            c.execute(sa.text("SELECT 1"))
        print("DB OK")
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
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
