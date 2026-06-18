from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator, Field
from typing import List, Optional, Union
import secrets
import logging
import os

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # ─── App ──────────────────────────────────────────────────
    APP_NAME: str = "VertiFarm OS"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # ─── API ──────────────────────────────────────────────────
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "VertiFarm OS"

    # ─── Security ─────────────────────────────────────────────
    # IMPORTANT: Set SECRET_KEY in your .env file for production.
    # A missing or per-restart key invalidates all JWT sessions on restart.
    # Generate one with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    SECRET_KEY: str = Field(default="")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # ─── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://vertifarm:vertifarm_secret_2024@localhost:5432/vertifarm"

    # ─── Redis ────────────────────────────────────────────────
    REDIS_URL: str = "redis://:redis_secret_2024@localhost:6379/0"

    # ─── CORS ─────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost,http://localhost:3000,http://localhost:5173,http://localhost:80,http://127.0.0.1,http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:8000"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    # ─── Admin ────────────────────────────────────────────────
    FIRST_SUPERUSER_EMAIL: str = "admin@vertifarm.io"
    FIRST_SUPERUSER_PASSWORD: str = "Admin@123456"

    # ─── Email ────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: str = "noreply@vertifarm.io"


    # ─── Stripe ───────────────────────────────────────────────
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_STARTER_MONTHLY: Optional[str] = None
    STRIPE_PRICE_GROWTH_MONTHLY: Optional[str] = None
    STRIPE_PRICE_ENTERPRISE_MONTHLY: Optional[str] = None
    STRIPE_PRICE_STARTER_ANNUAL: Optional[str] = None
    STRIPE_PRICE_GROWTH_ANNUAL: Optional[str] = None
    STRIPE_PRICE_ENTERPRISE_ANNUAL: Optional[str] = None

    # ─── Email (Resend) ───────────────────────────────────────
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM_NAME: str = "VertiFarm XOS"
    EMAIL_FROM_ADDRESS: str = "noreply@vertifarm.io"
    FRONTEND_URL: str = "http://localhost:5173"

    # ─── Security tokens ──────────────────────────────────────
    INVITE_EXPIRE_HOURS: int = 72
    VERIFY_EMAIL_EXPIRE_HOURS: int = 24
    RESET_PASSWORD_EXPIRE_HOURS: int = 2

    # ─── Trial ────────────────────────────────────────────────
    TRIAL_DAYS: int = 14

    # ─── AI / LLM — FIX-3: Real AI Copilot ───────────────────
    # Set one of these in your .env to enable the real Copilot.
    # If neither is set, the backend returns an honest fallback.
    OPENAI_API_KEY: Optional[str] = None          # sk-...
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: Optional[str] = None       # sk-ant-...
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

    def __init__(self, **data):
        super().__init__(**data)
        # Resolve SECRET_KEY: use env value if set, else generate a per-process
        # fallback and emit a loud warning so devs know to fix their .env.
        if not self.SECRET_KEY:
            self.SECRET_KEY = secrets.token_urlsafe(32)
            if self.ENVIRONMENT != "development":
                logger.critical(
                    "SECRET_KEY is not set in .env — a fresh key was generated for this "
                    "process. ALL JWT sessions will be invalidated on the next restart. "
                    "Generate a stable key and add it to your .env file:\n"
                    "  python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
            else:
                logger.warning(
                    "SECRET_KEY not set in .env — using a generated key (fine for dev, "
                    "but sessions won't survive restarts). Add SECRET_KEY to your .env."
                )


settings = Settings()
