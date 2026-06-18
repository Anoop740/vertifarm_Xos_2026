"""
API Key Rate-Limit Middleware
==============================
Enforces per-API-key request-per-minute limits stored on the APIKey model.
Uses Redis with a sliding-window counter (INCR + EXPIRE).

How it works
------------
1. Requests that carry an ``Authorization: ApiKey vf_sk_...`` header are
   intercepted before they reach any route handler.
2. The SHA-256 hash of the key is looked up in the DB.
3. The org's plan-tier RPM (60 / 300 / 1000) is fetched once per key and
   cached in Redis for 5 minutes (avoids a DB hit on every request).
4. A Redis counter key ``ratelimit:apikey:<hash>:<minute_bucket>`` is
   incremented atomically.  If it exceeds the limit a ``429 Too Many
   Requests`` JSON response is returned immediately.
5. Standard JWT Bearer traffic is NOT affected — SlowAPI covers that path.

Deployment note
---------------
Set ``REDIS_URL`` in your ``.env``.  If Redis is unreachable the middleware
logs a warning and allows the request through (fail-open) so a Redis outage
doesn't take down the API.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from sqlalchemy import select

logger = logging.getLogger(__name__)

# Plan tier → requests-per-minute ceiling
PLAN_RPM: dict[str, int] = {
    "starter":    60,
    "growth":     300,
    "enterprise": 1000,
}
DEFAULT_RPM = 60
CACHE_TTL   = 300   # seconds to cache plan-rpm in Redis


def _hash_key(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


def _minute_bucket() -> int:
    """Current UTC minute as an integer — resets the counter every 60 s."""
    return int(time.time() // 60)


class APIKeyRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Starlette middleware that rate-limits requests authenticated via
    ``Authorization: ApiKey <key>`` headers.
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._redis: Optional[object] = None   # lazy-loaded

    async def _get_redis(self):
        """Lazy-initialise the Redis async client."""
        if self._redis is not None:
            return self._redis
        try:
            import redis.asyncio as aioredis
            from app.core.config import settings
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            await self._redis.ping()
            logger.info("APIKeyRateLimitMiddleware: Redis connected")
        except Exception as exc:
            logger.warning("APIKeyRateLimitMiddleware: Redis unavailable — %s", exc)
            self._redis = None
        return self._redis

    async def dispatch(self, request: Request, call_next):
        auth_header: str = request.headers.get("authorization", "")

        # Only intercept ApiKey auth — leave Bearer / unauthenticated alone
        if not auth_header.lower().startswith("apikey "):
            return await call_next(request)

        plain_key = auth_header[7:].strip()
        if not plain_key:
            return JSONResponse({"detail": "Empty API key"}, status_code=401)

        key_hash = _hash_key(plain_key)
        redis = await self._get_redis()

        # ── Fetch RPM limit (Redis cache → DB fallback) ──────────────────────
        rpm_limit = await self._get_rpm(key_hash, redis, request)
        if rpm_limit is None:
            # Key not found in DB
            return JSONResponse({"detail": "Invalid API key"}, status_code=401)

        # ── Sliding-window counter ────────────────────────────────────────────
        if redis is not None:
            counter_key = f"ratelimit:apikey:{key_hash}:{_minute_bucket()}"
            try:
                current = await redis.incr(counter_key)
                if current == 1:
                    await redis.expire(counter_key, 61)   # auto-expire after the minute

                if current > rpm_limit:
                    return JSONResponse(
                        {
                            "detail": "API key rate limit exceeded",
                            "limit": rpm_limit,
                            "reset_in_seconds": 60 - (int(time.time()) % 60),
                        },
                        status_code=429,
                        headers={
                            "X-RateLimit-Limit":     str(rpm_limit),
                            "X-RateLimit-Remaining": "0",
                            "Retry-After":           str(60 - (int(time.time()) % 60)),
                        },
                    )

                response = await call_next(request)
                remaining = max(0, rpm_limit - current)
                response.headers["X-RateLimit-Limit"]     = str(rpm_limit)
                response.headers["X-RateLimit-Remaining"] = str(remaining)
                return response

            except Exception as exc:
                logger.warning("APIKeyRateLimitMiddleware: Redis error during check — %s; allowing request", exc)

        # Fail-open: Redis unavailable — let request through
        return await call_next(request)

    async def _get_rpm(
        self,
        key_hash: str,
        redis,
        request: Request,
    ) -> Optional[int]:
        """
        Return the RPM limit for this API key, or None if the key is invalid.
        Uses a 5-minute Redis cache to avoid a DB round-trip on every request.
        """
        cache_key = f"apikey:rpm:{key_hash}"

        if redis is not None:
            try:
                cached = await redis.get(cache_key)
                if cached is not None:
                    val = json.loads(cached)
                    return val if val != -1 else None
            except Exception:
                pass

        # DB lookup
        try:
            from app.db.session import async_session_factory
            from app.models.models import APIKey, Organization

            async with async_session_factory() as db:
                row = (await db.execute(
                    select(APIKey).where(
                        APIKey.key_hash == key_hash,
                        APIKey.is_active.is_(True),
                    )
                )).scalar_one_or_none()

                if row is None:
                    if redis is not None:
                        try:
                            await redis.setex(cache_key, CACHE_TTL, json.dumps(-1))
                        except Exception:
                            pass
                    return None

                org = (await db.execute(
                    select(Organization).where(Organization.id == row.organization_id)
                )).scalar_one_or_none()

                plan = getattr(org, "plan", "starter") or "starter"
                rpm = PLAN_RPM.get(plan, DEFAULT_RPM)

                if redis is not None:
                    try:
                        await redis.setex(cache_key, CACHE_TTL, json.dumps(rpm))
                    except Exception:
                        pass

                return rpm

        except Exception as exc:
            logger.warning("APIKeyRateLimitMiddleware: DB lookup failed — %s; defaulting to %d RPM", exc, DEFAULT_RPM)
            return DEFAULT_RPM
