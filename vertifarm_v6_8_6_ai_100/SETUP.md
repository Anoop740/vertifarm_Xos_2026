# VertiFarm OS — Complete Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | 24+ | https://docs.docker.com/get-docker/ |
| Docker Compose | v2+ | Included with Docker Desktop |
| Git | Any | https://git-scm.com |
| Node.js *(dev only)* | 20+ | https://nodejs.org |
| Python *(dev only)* | 3.11+ | https://python.org |

---

## ━━ OPTION A: One-Command Production Deploy ━━

The fastest way. Runs everything in Docker.

```bash
# 1 ─ Extract the zip
unzip vertifarm-os.zip
cd vertifarm

# 2 ─ Give deploy script permission
chmod +x deploy.sh

# 3 ─ Start everything (builds images, runs migrations, seeds data)
./deploy.sh

# ─── Done! Open in browser ───────────────────────────────────
# Dashboard  →  http://localhost
# API Docs   →  http://localhost:8000/docs
# Login      →  admin@vertifarm.io / Admin@123456
```

---

## ━━ OPTION B: Using Makefile (Recommended) ━━

```bash
unzip vertifarm-os.zip
cd vertifarm
chmod +x deploy.sh

# First-time setup (creates .env, checks deps)
make setup

# Start production
make prod

# Check everything is healthy
make health
```

---

## ━━ OPTION C: Local Development (Hot Reload) ━━

Backend and frontend run natively on your machine.
Only PostgreSQL and Redis run in Docker.

### Step 1 — Start infrastructure

```bash
# Start only DB + Redis
make infra-up

# OR manually:
docker compose up -d postgres redis
```

### Step 2 — Setup & run Backend

```bash
cd backend

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Mac/Linux
# .venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp ../.env.example ../.env
# Edit .env if needed (defaults work for local dev)

# Run database migrations
alembic upgrade head

# Seed demo data
python -c "
import asyncio
from app.db.init_db import init_db
from app.db.session import AsyncSessionLocal
asyncio.run(init_db(AsyncSessionLocal()))
"

# Start backend with hot reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend running at: **http://localhost:8000**
API Docs at: **http://localhost:8000/docs**

### Step 3 — Setup & run Frontend

```bash
# Open a new terminal
cd frontend

# Install npm packages
npm install

# Start dev server
npm run dev
```

Frontend running at: **http://localhost:5173**

---

## ━━ OPTION D: Full Docker Dev (with hot reload) ━━

```bash
# Builds everything in Docker but with live reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## ━━ PRODUCTION DEPLOYMENT (Cloud Server) ━━

### VPS / Bare Metal (Ubuntu/Debian)

```bash
# 1 ─ Install Docker on your server
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 2 ─ Upload and extract the project
scp vertifarm-os.zip user@your-server-ip:/opt/
ssh user@your-server-ip
cd /opt
unzip vertifarm-os.zip
cd vertifarm

# 3 ─ Configure production environment
cp .env.production.example .env
nano .env          # Edit ALL passwords and secrets!

# 4 ─ Deploy
chmod +x deploy.sh
./deploy.sh

# 5 ─ Check it's running
make health
# OR:
curl http://localhost/health
curl http://localhost:8000/health
```

### With a Domain + SSL (Let's Encrypt)

After deploying, set up Nginx + Certbot for HTTPS:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Update .env with your domain
VITE_API_URL=https://yourdomain.com
VITE_WS_URL=wss://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com

# Rebuild frontend with new URLs
docker compose up -d --build frontend
```

### AWS / GCP / Azure (Docker on VM)

Same as VPS above. Use the cloud provider's VM with Docker installed.

```bash
# AWS EC2 example
ssh -i key.pem ubuntu@your-ec2-ip
# Then follow the VPS steps above

# Open security group ports: 80, 443, 22
```

---

## ━━ ALL COMMANDS REFERENCE ━━

### Deploy Commands

```bash
./deploy.sh              # Production deploy
./deploy.sh dev          # Local dev (native, not Docker)
./deploy.sh stop         # Stop all services
./deploy.sh restart      # Restart all services
./deploy.sh reset        # ⚠ Wipe all data + fresh start
./deploy.sh logs         # Follow all logs
./deploy.sh status       # Container health status
```

### Makefile Commands

```bash
# ─ Setup ──────────────────────────────────────
make setup               # First-time setup wizard
make help                # Show all commands

# ─ Running ────────────────────────────────────
make prod                # Production (Docker)
make dev                 # Dev mode (native)
make dev-docker          # Dev mode (Docker, hot reload)
make infra-up            # Start DB + Redis only

# ─ Service control ────────────────────────────
make stop                # Stop everything
make restart             # Restart everything
make restart-backend     # Restart backend only
make restart-frontend    # Restart frontend only

# ─ Logs ───────────────────────────────────────
make logs                # All service logs
make logs-backend        # Backend logs only
make logs-frontend       # Frontend logs only
make logs-db             # PostgreSQL logs

# ─ Status & Health ────────────────────────────
make status              # Container status table
make health              # Ping all health endpoints

# ─ Database ───────────────────────────────────
make migrate             # Run migrations (in Docker)
make migrate-local       # Run migrations (local venv)
make rollback            # Rollback last migration
make seed                # Re-seed demo data
make db-shell            # Open psql shell
make redis-shell         # Open Redis CLI
make backup-db           # Backup DB → ./backups/
make restore-db FILE=xxx # Restore DB from file

# ─ Build ──────────────────────────────────────
make build               # Build all Docker images
make build-backend       # Build backend image
make build-frontend      # Build frontend image

# ─ Frontend ───────────────────────────────────
make frontend-install    # npm install
make frontend-build      # npm run build
make frontend-dev        # Start Vite dev server
make frontend-lint       # Run ESLint

# ─ Backend ────────────────────────────────────
make backend-install     # pip install -r requirements.txt
make backend-dev         # Start uvicorn locally
make backend-shell       # Python shell in container

# ─ Testing ────────────────────────────────────
make test                # Run pytest
make test-api            # API smoke test (curl)

# ─ Cleanup ────────────────────────────────────
make clean               # Remove containers + build files
make reset               # ⚠ Wipe all data
make prune               # Docker system prune
```

### Docker Compose Commands (manual)

```bash
docker compose up -d                    # Start all (detached)
docker compose up -d --build            # Force rebuild + start
docker compose down                     # Stop + remove containers
docker compose down -v                  # Stop + remove containers + volumes
docker compose ps                       # List containers
docker compose logs -f backend          # Follow backend logs
docker compose exec backend bash        # Shell into backend
docker compose exec postgres psql -U vertifarm -d vertifarm
docker compose exec redis redis-cli -a YOUR_PASSWORD
docker compose restart backend          # Restart one service
docker compose pull                     # Pull latest base images
```

---

## ━━ ENVIRONMENT VARIABLES ━━

Copy `.env.example` → `.env` for local, or `.env.production.example` → `.env` for production.

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | `development` or `production` |
| `SECRET_KEY` | auto | JWT signing key — **change in prod!** |
| `POSTGRES_PASSWORD` | `vertifarm_secret_2024` | DB password |
| `REDIS_PASSWORD` | `redis_secret_2024` | Redis password |
| `FIRST_SUPERUSER_EMAIL` | `admin@vertifarm.io` | Initial admin email |
| `FIRST_SUPERUSER_PASSWORD` | `Admin@123456` | Initial admin password |
| `VITE_API_URL` | `http://localhost:8000` | Backend URL for frontend |
| `ALLOWED_ORIGINS` | `http://localhost,...` | CORS allowed origins |

---

## ━━ PORT REFERENCE ━━

| Service | Port | Notes |
|---------|------|-------|
| **Dashboard** | `80` | Main app (via Nginx) |
| **Backend API** | `8000` | FastAPI direct access |
| **Frontend Dev** | `5173` | Vite dev server |
| **PostgreSQL** | `5432` | DB (exposed in dev) |
| **Redis** | `6379` | Cache (exposed in dev) |
| **API Docs** | `8000/docs` | Swagger UI |

---

## ━━ DEFAULT LOGIN ━━

| Field | Value |
|-------|-------|
| Email | `admin@vertifarm.io` |
| Password | `Admin@123456` |

**⚠ Change both in `.env` before going to production!**

---

## ━━ TROUBLESHOOTING ━━

### Port already in use
```bash
# Find what's using port 80
sudo lsof -i :80
sudo lsof -i :8000
# Kill it or change the port in docker-compose.yml
```

### Database connection failed
```bash
# Check postgres is healthy
docker compose ps postgres
docker compose logs postgres
# Restart it
docker compose restart postgres
```

### Frontend can't reach backend
```bash
# Check VITE_API_URL in .env matches your server
# Rebuild frontend after changing URLs
docker compose up -d --build frontend
```

### Migration errors
```bash
# Reset migrations (destructive!)
docker compose exec backend alembic downgrade base
docker compose exec backend alembic upgrade head
```

### Fresh start
```bash
# ⚠ Deletes all data
./deploy.sh reset
# OR
docker compose down -v && ./deploy.sh
```

---

*VertiFarm OS v1.0 — Smart Indoor Farming Platform* 🌿
