"""
Audit Log Service
=================
Provides a single async helper ``emit_audit()`` that endpoints call after
every mutating action.  All writes are fire-and-forget (background tasks)
so they never slow down the main request path.

Event type naming convention:  ``{resource}.{verb}``
  e.g.  farm.create  |  zone.update  |  user.login  |  billing.plan_change
        api_key.revoke  |  compliance.certification_create  |  ai.chat

Categories: auth | farm | zone | crop | device | sensor | billing | team
            api_key | webhook | integration | compliance | franchise |
            reseller | marketplace | ai | sop | inventory | report | system
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditLog, User


# ─── Core writer ──────────────────────────────────────────────────────────────

async def emit_audit(
    db: AsyncSession,
    *,
    event_type: str,                        # e.g. "farm.create"
    event_category: str,                    # e.g. "farm"
    actor: Optional[User] = None,
    organization_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    before_state: Optional[Dict] = None,
    after_state: Optional[Dict] = None,
    delta: Optional[Dict] = None,
    meta: Optional[Dict] = None,
    status: str = "success",
    error_detail: Optional[str] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """
    Persist one audit event and return the AuditLog row.
    Caller must await db.commit() afterwards (or it's flushed as part of the
    main transaction — either way is fine).
    """
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None

    if request is not None:
        ip_address = _get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")[:500]
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())

    entry = AuditLog(
        id              = str(uuid.uuid4()),
        organization_id = organization_id or (actor.organization_id if actor else None),
        actor_id        = actor.id    if actor else None,
        actor_email     = actor.email if actor else None,
        actor_role      = actor.role  if actor else None,
        event_type      = event_type,
        event_category  = event_category,
        resource_type   = resource_type,
        resource_id     = resource_id,
        resource_name   = resource_name,
        before_state    = before_state,
        after_state     = after_state,
        delta           = delta,
        metadata_json   = meta or {},
        status          = status,
        error_detail    = error_detail,
        ip_address      = ip_address,
        user_agent      = user_agent,
        request_id      = request_id,
        created_at      = datetime.now(timezone.utc),
    )
    db.add(entry)
    # Flush so the row gets an ID before the caller commits
    await db.flush()
    return entry


# ─── Convenience shortcuts ────────────────────────────────────────────────────

async def audit_auth(
    db: AsyncSession,
    *,
    event: str,           # "login" | "logout" | "token_refresh" | "password_reset" …
    actor: Optional[User] = None,
    status: str = "success",
    meta: Optional[Dict] = None,
    request: Optional[Request] = None,
    error_detail: Optional[str] = None,
) -> AuditLog:
    return await emit_audit(
        db,
        event_type=f"auth.{event}",
        event_category="auth",
        actor=actor,
        status=status,
        meta=meta,
        request=request,
        error_detail=error_detail,
    )


async def audit_resource(
    db: AsyncSession,
    *,
    category: str,
    verb: str,            # "create" | "update" | "delete" | "read" …
    resource_type: str,
    resource_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    actor: Optional[User] = None,
    before: Optional[Dict] = None,
    after: Optional[Dict] = None,
    delta: Optional[Dict] = None,
    meta: Optional[Dict] = None,
    status: str = "success",
    request: Optional[Request] = None,
) -> AuditLog:
    return await emit_audit(
        db,
        event_type=f"{category}.{verb}",
        event_category=category,
        actor=actor,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
        before_state=before,
        after_state=after,
        delta=delta,
        meta=meta,
        status=status,
        request=request,
    )


# ─── IP extraction helper ─────────────────────────────────────────────────────

def _get_client_ip(request: Request) -> str:
    """Return the best-guess client IP, respecting common proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "unknown"
