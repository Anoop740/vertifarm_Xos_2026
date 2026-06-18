#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
# VertiFarm Dev Entrypoint
# Robust startup: waits for DB, runs schema bootstrap, seeds, starts uvicorn
# ─────────────────────────────────────────────────────────────────────────────

echo "▸ [1/5] Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def ping():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        await conn.execute(text('SELECT 1'))
    await engine.dispose()

asyncio.run(ping())
" 2>/dev/null && echo "  ✓ PostgreSQL ready (attempt $i)" && break \
  || { echo "  Attempt $i/30 — waiting..."; sleep 2; }
    if [ "$i" -eq 30 ]; then
        echo "  ✗ PostgreSQL not reachable after 30 attempts. Aborting."
        exit 1
    fi
done

echo "▸ [2/5] Creating / verifying database tables..."
python -c "
import asyncio
from app.db.init_db import create_tables
asyncio.run(create_tables())
print('  ✓ Tables OK')
"

echo "▸ [3/5] Checking Alembic migration state..."
python -c "
from subprocess import run
import sys

# Get current alembic head revision
r = run(['alembic', 'current'], capture_output=True, text=True)
current = r.stdout.strip()

if not current:
    # Fresh DB — stamp to 0004 so alembic only runs 0005+
    print('  No alembic version found — stamping baseline 0004...')
    run(['alembic', 'stamp', '0004'], check=True)
    print('  ✓ Stamped to 0004')
else:
    print(f'  ✓ Alembic already at: {current}')
"

echo "▸ [4/5] Running pending migrations..."
alembic upgrade head
echo "  ✓ Migrations up to date"

echo "▸ [5/5] Seeding base + demo data (idempotent — skipped if already seeded)..."
python /app/seed.py --all

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  VertiFarm XOS — Backend starting"
echo "  API:  http://localhost:8000"
echo "  Docs: http://localhost:8000/docs"
echo "══════════════════════════════════════════════════════════"
echo ""

exec uvicorn app.main:app \
    --reload \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info \
    --reload-dir /app/app
