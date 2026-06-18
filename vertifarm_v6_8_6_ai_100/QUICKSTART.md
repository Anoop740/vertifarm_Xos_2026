# VertiFarm XOS — Quick Start

## First Time / After Code Changes (always use `--build`)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Or using the Makefile shortcut:
```bash
make dev-build
```

**Why `--build`?** Without it, Docker reuses cached images. Any changes to Python files,
`requirements.txt`, or entrypoint scripts won't be picked up. Always use `--build` after
pulling new code or changing dependencies.

---

## Subsequent Starts (data already exists, no code changes)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

The stack will attach to existing containers. The backend will be silent after
`Attaching...` — this is normal. It means everything is already running.
Check it's live with:

```bash
curl http://localhost:8000/health
# → {"status": "ok", "app": "VertiFarm OS", ...}
```

---

## View Live Logs

```bash
# All services
docker compose logs -f

# Backend only  
docker compose logs -f backend

# Or: make logs-backend
```

---

## Full Reset (wipe database, start fresh)

```bash
docker compose down -v --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Or: make dev-fresh
```

---

## Default Credentials

| URL | Credentials |
|-----|-------------|
| Frontend: http://localhost:5173 | — |
| Backend API: http://localhost:8000 | — |
| Swagger docs: http://localhost:8000/docs | — |
| Admin login | `admin@vertifarm.io` / `Admin@123456` |

---

## Startup Sequence

The backend entrypoint (`entrypoint.dev.sh`) runs these steps in order:

1. **Wait for PostgreSQL** — polls up to 60s (30 × 2s attempts)
2. **Create tables** — `Base.metadata.create_all()` — idempotent, safe to rerun
3. **Check Alembic state** — stamps baseline `0004` if fresh DB
4. **Run migrations** — `alembic upgrade head` — applies `0005+`
5. **Seed data** — skipped automatically if admin user already exists
6. **Start uvicorn** — hot reload watching `/app/app`

If the backend exits immediately, run `docker compose logs backend` to see the error.

---

## Common Issues

| Symptom | Fix |
|---------|-----|
| Nothing happens after "Attaching..." | Normal on restart — stack is already running. Run `curl localhost:8000/health` to verify. |
| Backend crashes on startup | `docker compose logs backend` — usually a missing env var or DB not ready |
| Code changes not reflected | Use `--build` flag: `docker compose ... up --build` |
| `slowapi` / import errors | Rebuild the image: `make dev-build` |
| Database in bad state | `make dev-fresh` — wipes volumes and starts clean |
