#!/bin/bash
set -e

echo "▸ Waiting for database to be ready..."
python -c "
import asyncio, time
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text as sqla_text
from app.core.config import settings

async def wait():
    for attempt in range(30):
        try:
            engine = create_async_engine(settings.DATABASE_URL)
            async with engine.connect() as conn:
                await conn.execute(sqla_text('SELECT 1'))
            await engine.dispose()
            print(f'  Database ready (attempt {attempt+1})')
            return
        except Exception as e:
            print(f'  Attempt {attempt+1}/30: {e}')
            time.sleep(2)
    raise RuntimeError('Database not reachable after 30 attempts')
asyncio.run(wait())
"

echo "▸ Creating/verifying database tables (create_all)..."
python -c "
import asyncio
from app.db.init_db import create_tables
asyncio.run(create_tables())
"

echo "▸ Stamping Alembic baseline if not tracked..."
python -c "
from subprocess import run, PIPE
r = run(['alembic', 'current'], capture_output=True, text=True)
out = r.stdout.strip()
if not out or 'No version' in r.stderr:
    print('  No alembic version found — stamping 0004 baseline...')
    run(['alembic', 'stamp', '0004'], check=True)
else:
    print(f'  Alembic already at: {out}')
"

echo "▸ Running incremental migrations (0005+)..."
alembic upgrade head

echo "▸ Seeding initial data..."
python /app/seed.py --all

echo "▸ Starting VertiFarm API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --log-level info
