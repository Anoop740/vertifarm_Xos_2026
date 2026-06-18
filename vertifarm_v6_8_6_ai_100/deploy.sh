#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  VertiFarm OS — One-Command Deploy Script
#  Usage:
#    ./deploy.sh           → Production deploy (Docker)
#    ./deploy.sh dev       → Local development (hot reload)
#    ./deploy.sh stop      → Stop all services
#    ./deploy.sh reset     → Wipe data and restart fresh
#    ./deploy.sh logs      → Tail all logs
#    ./deploy.sh status    → Show service status
# ════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

COMPOSE="docker compose"
ENV_FILE=".env"
MODE="${1:-prod}"

banner() {
  echo -e "${GREEN}"
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║      VertiFarm OS — Deployment           ║"
  echo "  ║      Smart Indoor Farming Platform       ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo -e "${NC}"
}

check_deps() {
  echo -e "${CYAN}▸ Checking dependencies...${NC}"
  for cmd in docker curl; do
    if ! command -v $cmd &>/dev/null; then
      echo -e "${RED}✗ $cmd is required but not installed.${NC}"
      exit 1
    fi
  done
  if ! docker compose version &>/dev/null; then
    echo -e "${RED}✗ Docker Compose v2 is required.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ All dependencies present${NC}"
}

setup_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}▸ No .env found — copying from .env.example${NC}"
    cp .env.example .env
    echo -e "${YELLOW}  ⚠ Please edit .env with your secrets before going to production!${NC}"
  fi
}

wait_for_health() {
  local service=$1
  local url=$2
  local max=30
  echo -ne "${CYAN}▸ Waiting for $service"
  for i in $(seq 1 $max); do
    if curl -sf "$url" &>/dev/null; then
      echo -e " ${GREEN}✓${NC}"
      return 0
    fi
    echo -n "."
    sleep 3
  done
  echo -e " ${RED}✗ timeout${NC}"
  return 1
}

deploy_prod() {
  banner
  check_deps
  setup_env
  echo -e "${BLUE}${BOLD}▸ Starting production deployment...${NC}"

  echo -e "${CYAN}▸ Pulling latest images...${NC}"
  $COMPOSE pull --ignore-pull-failures 2>/dev/null || true

  echo -e "${CYAN}▸ Building services...${NC}"
  $COMPOSE build --parallel

  echo -e "${CYAN}▸ Starting infrastructure (DB + Redis)...${NC}"
  $COMPOSE up -d postgres redis

  wait_for_health "PostgreSQL" "http://localhost:8000/health" || true
  sleep 5

  echo -e "${CYAN}▸ Starting backend...${NC}"
  $COMPOSE up -d backend

  wait_for_health "Backend API" "http://localhost:8000/health"

  echo -e "${CYAN}▸ Starting frontend + nginx...${NC}"
  $COMPOSE up -d frontend nginx

  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║  VertiFarm OS is LIVE!                       ║${NC}"
  echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║  Dashboard:   ${CYAN}http://localhost${GREEN}               ║${NC}"
  echo -e "${GREEN}║  API Docs:    ${CYAN}http://localhost:8000/docs${GREEN}     ║${NC}"
  echo -e "${GREEN}║  API:         ${CYAN}http://localhost:8000/api/v1${GREEN}   ║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║  Admin:       admin@vertifarm.io             ║${NC}"
  echo -e "${GREEN}║  Password:    Admin@123456 (change this!)    ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}  Run ${BOLD}./deploy.sh logs${NC}${YELLOW} to follow logs${NC}"
}

deploy_dev() {
  banner
  check_deps
  setup_env
  echo -e "${BLUE}${BOLD}▸ Starting development mode...${NC}"

  # Start infra only
  $COMPOSE up -d postgres redis
  sleep 5

  echo -e "${CYAN}▸ Installing backend dependencies...${NC}"
  cd backend
  python3 -m venv .venv 2>/dev/null || true
  source .venv/bin/activate
  pip install -r requirements.txt -q
  echo -e "${CYAN}▸ Running database migrations...${NC}"
  alembic upgrade head
  echo -e "${CYAN}▸ Starting backend with hot reload...${NC}"
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
  BACKEND_PID=$!
  cd ..

  echo -e "${CYAN}▸ Installing frontend dependencies...${NC}"
  cd frontend
  npm install -q
  echo -e "${CYAN}▸ Starting frontend dev server...${NC}"
  npm run dev &
  FRONTEND_PID=$!
  cd ..

  echo ""
  echo -e "${GREEN}${BOLD}Development servers running:${NC}"
  echo -e "  Frontend:  ${CYAN}http://localhost:5173${NC}"
  echo -e "  Backend:   ${CYAN}http://localhost:8000${NC}"
  echo -e "  API Docs:  ${CYAN}http://localhost:8000/docs${NC}"
  echo ""
  echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
  wait $BACKEND_PID $FRONTEND_PID
}

case "$MODE" in
  prod|production|"")
    deploy_prod ;;
  dev|development)
    deploy_dev ;;
  stop)
    echo -e "${YELLOW}▸ Stopping all services...${NC}"
    $COMPOSE down
    echo -e "${GREEN}✓ All services stopped${NC}" ;;
  reset)
    echo -e "${RED}▸ Resetting ALL data (this is irreversible!)...${NC}"
    read -p "Type 'yes' to confirm: " confirm
    [ "$confirm" = "yes" ] && $COMPOSE down -v && deploy_prod || echo "Aborted." ;;
  logs)
    $COMPOSE logs -f --tail=100 ;;
  status)
    $COMPOSE ps ;;
  *)
    echo "Usage: ./deploy.sh [prod|dev|stop|reset|logs|status]" ;;
esac
