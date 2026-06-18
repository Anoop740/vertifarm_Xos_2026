from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.api import router as api_router
from app.api.v1.endpoints.saas import router as saas_router
from app.api.v1.endpoints.phase2 import router as phase2_router
from app.api.v1.endpoints.phase3 import router as phase3_router
from app.api.v1.endpoints.phase4 import router as phase4_router
from app.api.v1.endpoints.marketplace import router as marketplace_router
from app.api.v1.endpoints.management import router as management_router
from app.api.v1.endpoints.ai_chat import router as ai_chat_router
from app.api.v1.endpoints.audit import router as audit_router
from app.middleware.rate_limit import APIKeyRateLimitMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Rate Limiter ──────────────────────────────────────────────────────────
# Global default: 300 req/min per IP.
# Sensitive endpoints (login, AI chat, sensor ingest) apply tighter limits
# via @limiter.limit("N/minute") on the individual route handlers.
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"▸ {settings.APP_NAME} v{settings.APP_VERSION} starting up...")
    yield
    logger.info("▸ Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Indoor Vertical Farming OS — AI + IoT + Automation Platform",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── Rate limiter state & 429 handler ─────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Middleware ────────────────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Per-API-key sliding-window rate limiter (plan-tier aware: 60/300/1000 RPM)
app.add_middleware(APIKeyRateLimitMiddleware)

# ─── Routers ──────────────────────────────────────────────────────────────
app.include_router(auth_router,        prefix=settings.API_V1_STR)
app.include_router(api_router,         prefix=settings.API_V1_STR)
app.include_router(saas_router,        prefix=settings.API_V1_STR)
app.include_router(phase2_router,      prefix=settings.API_V1_STR)
app.include_router(phase3_router,      prefix=settings.API_V1_STR)
app.include_router(phase4_router,      prefix=settings.API_V1_STR)
app.include_router(marketplace_router, prefix=settings.API_V1_STR)
app.include_router(management_router,  prefix=settings.API_V1_STR)
app.include_router(ai_chat_router,     prefix=settings.API_V1_STR)
app.include_router(audit_router,       prefix=settings.API_V1_STR)


# ─── Health Check ─────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "env": settings.ENVIRONMENT,
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "api": settings.API_V1_STR,
    }
