"""
Audit Log API
=============
Read-only endpoints for querying the immutable audit trail.

GET  /audit-logs                 — paginated list with rich filters
GET  /audit-logs/{id}            — single event detail
GET  /audit-logs/stats           — aggregate counts by category/day
GET  /audit-logs/export          — CSV export (admin only)
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import AuditLog, User
from app.api.v1.endpoints.auth import get_current_user
from fastapi import status as http_status

router = APIRouter(prefix="/audit-logs", tags=["Audit Log"])


# ─── RBAC helper ─────────────────────────────────────────────────────────────

def _require_admin(user: User) -> None:
    if user.role not in ("superadmin", "org_admin"):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Audit log access requires org_admin or superadmin role.",
        )


def _require_superadmin(user: User) -> None:
    if user.role != "superadmin":
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This action requires superadmin role.",
        )


# ─── Response schemas ─────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: str
    organization_id: Optional[str]
    actor_id: Optional[str]
    actor_email: Optional[str]
    actor_role: Optional[str]
    event_type: str
    event_category: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    resource_name: Optional[str]
    before_state: Optional[Dict]
    after_state: Optional[Dict]
    delta: Optional[Dict]
    metadata_json: Optional[Dict]
    status: str
    error_detail: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    request_id: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: List[AuditLogOut]
    total: int
    page: int
    page_size: int
    has_next: bool


class AuditStatsBucket(BaseModel):
    date: str
    category: str
    count: int


class AuditStatsResponse(BaseModel):
    total_events: int
    events_last_24h: int
    events_last_7d: int
    top_actors: List[Dict]
    top_event_types: List[Dict]
    failure_rate_pct: float
    by_category: List[Dict]
    daily_buckets: List[AuditStatsBucket]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    category: Optional[str] = Query(None, description="Filter by event_category"),
    event_type: Optional[str] = Query(None, description="Filter by event_type (prefix match)"),
    actor_id: Optional[str] = Query(None),
    actor_email: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="success | failure | partial"),
    from_dt: Optional[datetime] = Query(None, description="ISO-8601 start datetime"),
    to_dt: Optional[datetime] = Query(None, description="ISO-8601 end datetime"),
    search: Optional[str] = Query(None, description="Full-text search in event_type + resource_name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List audit events for the current organisation with rich filtering.
    org_admin sees only their own org; superadmin may omit org filter.
    """
    _require_admin(current_user)

    q = select(AuditLog)

    # Org scoping — org_admin always scoped; superadmin sees all
    if current_user.role != "superadmin":
        q = q.where(AuditLog.organization_id == current_user.organization_id)

    if category:
        q = q.where(AuditLog.event_category == category)
    if event_type:
        q = q.where(AuditLog.event_type.like(f"{event_type}%"))
    if actor_id:
        q = q.where(AuditLog.actor_id == actor_id)
    if actor_email:
        q = q.where(AuditLog.actor_email.ilike(f"%{actor_email}%"))
    if resource_type:
        q = q.where(AuditLog.resource_type == resource_type)
    if resource_id:
        q = q.where(AuditLog.resource_id == resource_id)
    if status:
        q = q.where(AuditLog.status == status)
    if from_dt:
        q = q.where(AuditLog.created_at >= from_dt)
    if to_dt:
        q = q.where(AuditLog.created_at <= to_dt)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(
                AuditLog.event_type.ilike(pattern),
                AuditLog.resource_name.ilike(pattern),
                AuditLog.actor_email.ilike(pattern),
            )
        )

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    q = q.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size)
    rows = (await db.execute(q)).scalars().all()

    return AuditLogListResponse(
        items=rows,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


@router.get("/stats", response_model=AuditStatsResponse)
async def audit_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate stats for the audit dashboard widget."""
    _require_admin(current_user)

    org_filter = []
    if current_user.role != "superadmin":
        org_filter = [AuditLog.organization_id == current_user.organization_id]

    now = datetime.now(timezone.utc)
    since_days = now - timedelta(days=days)
    since_24h  = now - timedelta(hours=24)
    since_7d   = now - timedelta(days=7)

    # Total events in window
    total = (await db.execute(
        select(func.count(AuditLog.id)).where(
            *org_filter,
            AuditLog.created_at >= since_days,
        )
    )).scalar() or 0

    events_24h = (await db.execute(
        select(func.count(AuditLog.id)).where(
            *org_filter,
            AuditLog.created_at >= since_24h,
        )
    )).scalar() or 0

    events_7d = (await db.execute(
        select(func.count(AuditLog.id)).where(
            *org_filter,
            AuditLog.created_at >= since_7d,
        )
    )).scalar() or 0

    # Failure rate
    failures = (await db.execute(
        select(func.count(AuditLog.id)).where(
            *org_filter,
            AuditLog.created_at >= since_days,
            AuditLog.status == "failure",
        )
    )).scalar() or 0
    failure_rate = round((failures / total * 100) if total else 0.0, 2)

    # Top actors
    actor_rows = (await db.execute(
        select(AuditLog.actor_email, func.count(AuditLog.id).label("n"))
        .where(*org_filter, AuditLog.created_at >= since_days, AuditLog.actor_email.isnot(None))
        .group_by(AuditLog.actor_email)
        .order_by(desc("n"))
        .limit(10)
    )).all()
    top_actors = [{"email": r[0], "count": r[1]} for r in actor_rows]

    # Top event types
    etype_rows = (await db.execute(
        select(AuditLog.event_type, func.count(AuditLog.id).label("n"))
        .where(*org_filter, AuditLog.created_at >= since_days)
        .group_by(AuditLog.event_type)
        .order_by(desc("n"))
        .limit(15)
    )).all()
    top_event_types = [{"event_type": r[0], "count": r[1]} for r in etype_rows]

    # By category
    cat_rows = (await db.execute(
        select(AuditLog.event_category, func.count(AuditLog.id).label("n"))
        .where(*org_filter, AuditLog.created_at >= since_days)
        .group_by(AuditLog.event_category)
        .order_by(desc("n"))
    )).all()
    by_category = [{"category": r[0], "count": r[1]} for r in cat_rows]

    # Daily buckets (last 30 days by category) — simplified using Python aggregation
    bucket_rows = (await db.execute(
        select(
            func.date_trunc("day", AuditLog.created_at).label("day"),
            AuditLog.event_category,
            func.count(AuditLog.id).label("n"),
        )
        .where(*org_filter, AuditLog.created_at >= since_days)
        .group_by("day", AuditLog.event_category)
        .order_by("day")
    )).all()

    daily_buckets = [
        AuditStatsBucket(
            date=r[0].strftime("%Y-%m-%d"),
            category=r[1],
            count=r[2],
        )
        for r in bucket_rows
    ]

    return AuditStatsResponse(
        total_events=total,
        events_last_24h=events_24h,
        events_last_7d=events_7d,
        top_actors=top_actors,
        top_event_types=top_event_types,
        failure_rate_pct=failure_rate,
        by_category=by_category,
        daily_buckets=daily_buckets,
    )


@router.get("/{log_id}", response_model=AuditLogOut)
async def get_audit_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a single audit event by ID."""
    _require_admin(current_user)

    row = (await db.execute(
        select(AuditLog).where(AuditLog.id == log_id)
    )).scalar_one_or_none()

    if not row:
        raise HTTPException(404, "Audit log entry not found")

    # Org scoping
    if current_user.role != "superadmin":
        if row.organization_id != current_user.organization_id:
            raise HTTPException(404, "Audit log entry not found")

    return row


@router.get("/export/csv")
async def export_audit_csv(
    days: int = Query(30, ge=1, le=365),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export audit logs as CSV — org_admin sees their org only;
    superadmin may see all.
    """
    _require_admin(current_user)

    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = select(AuditLog).where(AuditLog.created_at >= since)

    if current_user.role != "superadmin":
        q = q.where(AuditLog.organization_id == current_user.organization_id)
    if category:
        q = q.where(AuditLog.event_category == category)

    q = q.order_by(desc(AuditLog.created_at)).limit(10_000)
    rows = (await db.execute(q)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "created_at", "actor_email", "actor_role",
        "event_type", "event_category", "resource_type",
        "resource_id", "resource_name", "status", "ip_address",
    ])
    for r in rows:
        writer.writerow([
            r.id, r.created_at.isoformat(), r.actor_email, r.actor_role,
            r.event_type, r.event_category, r.resource_type,
            r.resource_id, r.resource_name, r.status, r.ip_address,
        ])

    output.seek(0)
    filename = f"audit_log_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
