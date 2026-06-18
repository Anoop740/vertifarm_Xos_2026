# ════════════════════════════════════════════════════════════════
#  VertiFarm OS — Makefile
#  All commands for local dev, production deploy, and maintenance
# ════════════════════════════════════════════════════════════════

.PHONY: help setup dev prod stop restart reset logs status \
        build test lint migrate seed db-shell redis-shell \
        backend-shell frontend-build clean

# ── Colors ────────────────────────────────────────────────────
GREEN  = \033[0;32m
YELLOW = \033[1;33m
CYAN   = \033[0;36m
NC     = \033[0m

help: ## Show all commands
	@echo ""
	@echo "  $(GREEN)VertiFarm OS — Command Reference$(NC)"
	@echo "  ──────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ── SETUP ─────────────────────────────────────────────────────
setup: ## First-time setup: copy .env, check deps
	@echo "$(CYAN)▸ Setting up VertiFarm OS...$(NC)"
	@[ -f .env ] || cp .env.example .env && echo "  ✓ .env created from template"
	@chmod +x deploy.sh
	@command -v docker >/dev/null 2>&1 || (echo "  ✗ Docker not found. Install: https://docs.docker.com/get-docker/" && exit 1)
	@docker compose version >/dev/null 2>&1 || (echo "  ✗ Docker Compose v2 not found." && exit 1)
	@echo "  $(GREEN)✓ Setup complete. Run: make prod$(NC)"

# ── PRODUCTION ────────────────────────────────────────────────
prod: ## Build + start all services in production mode
	@./deploy.sh prod

# ── DEVELOPMENT ───────────────────────────────────────────────
dev: ## Start local dev servers (hot reload, no Docker for app)
	@./deploy.sh dev

dev-docker: ## Start full stack in Docker with hot reload (reuses existing images)
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up

dev-build: ## ⚡ Rebuild images then start (run this after code/dependency changes)
	@echo "$(CYAN)▸ Rebuilding images and starting stack...$(NC)"
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev-fresh: ## 🔄 Full reset: stop, remove volumes, rebuild, start clean
	@echo "$(CYAN)▸ Stopping and removing all data...$(NC)"
	@docker compose down -v --remove-orphans
	@echo "$(CYAN)▸ Rebuilding images...$(NC)"
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# ── SERVICE CONTROL ───────────────────────────────────────────
stop: ## Stop all Docker services
	@docker compose down
	@echo "$(GREEN)✓ All services stopped$(NC)"

restart: ## Restart all services
	@docker compose restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

restart-backend: ## Restart only the backend
	@docker compose restart backend
	@echo "$(GREEN)✓ Backend restarted$(NC)"

restart-frontend: ## Restart only the frontend
	@docker compose restart frontend
	@echo "$(GREEN)✓ Frontend restarted$(NC)"

# ── LOGS ──────────────────────────────────────────────────────
logs: ## Tail logs for all services
	@docker compose logs -f --tail=100

logs-backend: ## Tail backend logs only
	@docker compose logs -f --tail=100 backend

logs-frontend: ## Tail frontend logs only
	@docker compose logs -f --tail=100 frontend

logs-db: ## Tail PostgreSQL logs
	@docker compose logs -f --tail=100 postgres

# ── STATUS ────────────────────────────────────────────────────
status: ## Show running containers and health
	@docker compose ps

health: ## Check all service health endpoints
	@echo "$(CYAN)▸ Checking health...$(NC)"
	@curl -sf http://localhost/health && echo " $(GREEN)✓ Nginx$(NC)" || echo " $(YELLOW)✗ Nginx$(NC)"
	@curl -sf http://localhost:8000/health && echo " $(GREEN)✓ Backend$(NC)" || echo " $(YELLOW)✗ Backend$(NC)"
	@docker compose exec postgres pg_isready -U vertifarm 2>/dev/null && echo " $(GREEN)✓ PostgreSQL$(NC)" || echo " $(YELLOW)✗ PostgreSQL$(NC)"
	@docker compose exec redis redis-cli -a $${REDIS_PASSWORD:-redis_secret_2024} ping 2>/dev/null && echo " $(GREEN)✓ Redis$(NC)" || echo " $(YELLOW)✗ Redis$(NC)"

# ── BUILD ─────────────────────────────────────────────────────
build: ## Build all Docker images
	@echo "$(CYAN)▸ Building images...$(NC)"
	@docker compose build --parallel

build-backend: ## Build backend image only
	@docker compose build backend

build-frontend: ## Build frontend image only
	@docker compose build frontend

push: ## Push images to registry (set REGISTRY env var)
	@docker compose push

# ── DATABASE ──────────────────────────────────────────────────
migrate: ## Run database migrations (alembic upgrade head)
	@docker compose exec backend alembic upgrade head
	@echo "$(GREEN)✓ Migrations applied$(NC)"

migrate-local: ## Run migrations locally (needs venv active)
	@cd backend && alembic upgrade head

rollback: ## Rollback last migration
	@docker compose exec backend alembic downgrade -1

seed: ## Re-seed demo data
	@docker compose exec backend python -c "import asyncio; from app.db.init_db import init_db; from app.db.session import AsyncSessionLocal; asyncio.run(init_db(AsyncSessionLocal()))"
	@echo "$(GREEN)✓ Seed data applied$(NC)"

db-shell: ## Open PostgreSQL shell
	@docker compose exec postgres psql -U vertifarm -d vertifarm

redis-shell: ## Open Redis CLI
	@docker compose exec redis redis-cli -a $${REDIS_PASSWORD:-redis_secret_2024}

backend-shell: ## Open Python shell inside backend container
	@docker compose exec backend python

# ── TESTING ───────────────────────────────────────────────────
test: ## Run backend tests
	@cd backend && python -m pytest tests/ -v

test-api: ## Quick API smoke test (needs running server)
	@echo "$(CYAN)▸ Testing API endpoints...$(NC)"
	@curl -sf http://localhost:8000/health | python3 -m json.tool
	@curl -sf -X POST http://localhost:8000/api/v1/auth/login \
	  -H "Content-Type: application/json" \
	  -d '{"email":"admin@vertifarm.io","password":"Admin@123456"}' | python3 -m json.tool

# ── FRONTEND ──────────────────────────────────────────────────
frontend-install: ## Install frontend npm dependencies
	@cd frontend && npm install

frontend-build: ## Build frontend for production
	@cd frontend && npm run build

frontend-dev: ## Start frontend dev server only
	@cd frontend && npm run dev

frontend-lint: ## Lint frontend code
	@cd frontend && npm run lint

# ── BACKEND LOCAL ─────────────────────────────────────────────
backend-install: ## Install backend Python dependencies
	@cd backend && pip install -r requirements.txt

backend-dev: ## Start backend dev server only (needs DB running)
	@cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# ── INFRASTRUCTURE ────────────────────────────────────────────
infra-up: ## Start only infrastructure (DB + Redis), no app
	@docker compose up -d postgres redis
	@echo "$(GREEN)✓ Database and Redis started$(NC)"

infra-down: ## Stop only infrastructure
	@docker compose stop postgres redis

# ── CLEANUP ───────────────────────────────────────────────────
clean: ## Remove containers, images, build artifacts
	@echo "$(YELLOW)▸ Cleaning containers and images...$(NC)"
	@docker compose down --rmi local
	@rm -rf frontend/dist frontend/node_modules backend/.venv
	@echo "$(GREEN)✓ Cleaned$(NC)"

reset: ## ⚠ DANGER: Wipe all data and restart fresh
	@./deploy.sh reset

prune: ## Remove unused Docker resources system-wide
	@docker system prune -f

# ── BACKUP ────────────────────────────────────────────────────
backup-db: ## Backup PostgreSQL to ./backups/
	@mkdir -p backups
	@docker compose exec postgres pg_dump -U vertifarm vertifarm > backups/vertifarm_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Database backed up to ./backups/$(NC)"

restore-db: ## Restore PostgreSQL from file: make restore-db FILE=backups/xxx.sql
	@docker compose exec -T postgres psql -U vertifarm -d vertifarm < $(FILE)
	@echo "$(GREEN)✓ Database restored$(NC)"
