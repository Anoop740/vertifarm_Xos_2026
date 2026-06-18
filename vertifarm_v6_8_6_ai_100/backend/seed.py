"""
Database seeding entry point.

Usage:
  python seed.py           # init schema + basic seed + demo data (default)
  python seed.py --init    # schema + basic seed only (no demo data)
  python seed.py --demo    # demo data only (requires basic seed already done)
"""
import asyncio
import sys


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--all"

    from app.db.init_db import init_db, seed_demo_data
    from app.db.session import AsyncSessionLocal, engine

    try:
        async with AsyncSessionLocal() as session:
            if mode in ("--all", "--init"):
                await init_db(session)
                print("✓ Base seeding complete")

            if mode in ("--all", "--demo"):
                await seed_demo_data(session)
                print("✓ Demo data seeding complete")

    except Exception as e:
        print(f"Seeding error: {e}", file=sys.stderr)
        raise
    finally:
        await engine.dispose()


asyncio.run(main())
