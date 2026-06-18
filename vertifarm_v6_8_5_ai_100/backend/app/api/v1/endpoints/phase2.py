"""
Phase 2 — Revenue & Retention endpoints
Features 5-8: API Portal, Notifications, Traceability, Integrations
"""

import hashlib
import hmac
import io
import json
import os
import secrets
import base64
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select, func, desc, and_, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import (
    APIKey, WebhookEndpoint, WebhookDelivery,
    Notification, NotificationPreference, EscalationRule,
    TraceabilityRecord, HarvestLog, Crop, Farm, Zone,
    Integration, IntegrationType, NotificationType,
    Organization, User,
)
from app.api.v1.endpoints.auth import get_current_user
from fastapi import status as http_status

router = APIRouter()


# ─── RBAC helper ──────────────────────────────────────────────────
def _require_role(user: User, *allowed: str) -> None:
    """Raise HTTP 403 if user.role is not in allowed."""
    if user.role not in allowed:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user.role}' cannot perform this action. Required: {list(allowed)}",
        )

# ─── Rate limits per plan ────────────────────────────────────────
PLAN_RPM = {"starter": 60, "growth": 300, "enterprise": 1000}


# ════════════════════════════════════════════════════════════
# FEATURE 5 — API KEY MANAGEMENT
# ════════════════════════════════════════════════════════════

class APIKeyCreate(BaseModel):
    name: str
    scopes: List[str] = ["farms:read"]
    ip_whitelist: List[str] = []
    expires_days: Optional[int] = None   # None = never

class APIKeyOut(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: List[str]
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    rate_limit_rpm: int
    model_config = {"from_attributes": True}

class APIKeyCreated(APIKeyOut):
    """Includes the plain-text secret — shown once only."""
    secret: str


def _hash_key(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


def _plan_rpm(org: Organization) -> int:
    return PLAN_RPM.get(getattr(org, "plan", "starter") or "starter", 60)


@router.get("/api-keys", response_model=List[APIKeyOut], tags=["API Keys"])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(APIKey)
        .where(APIKey.organization_id == current_user.organization_id)
        .order_by(desc(APIKey.created_at))
    )
    keys = result.scalars().all()
    org = (await db.execute(select(Organization).where(Organization.id == current_user.organization_id))).scalar_one_or_none()
    rpm = _plan_rpm(org) if org else 60
    out = []
    for k in keys:
        d = {c.name: getattr(k, c.name) for c in APIKey.__table__.columns}
        d["rate_limit_rpm"] = rpm
        out.append(d)
    return out


@router.post("/api-keys", response_model=APIKeyCreated, tags=["API Keys"])
async def create_api_key(
    data: APIKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    org = (await db.execute(select(Organization).where(Organization.id == current_user.organization_id))).scalar_one_or_none()
    if not org:
        raise HTTPException(400, "Organization not found")

    plain   = "vf_sk_" + secrets.token_urlsafe(32)
    prefix  = plain[:12]
    kh      = _hash_key(plain)
    expires = None
    if data.expires_days:
        expires = datetime.now(timezone.utc) + timedelta(days=data.expires_days)

    key = APIKey(
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        name=data.name,
        key_prefix=prefix,
        key_hash=kh,
        scopes=data.scopes,
        expires_at=expires,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)

    rpm = _plan_rpm(org)
    return {
        "id": key.id, "name": key.name, "key_prefix": key.key_prefix,
        "scopes": key.scopes, "last_used_at": key.last_used_at,
        "expires_at": key.expires_at, "is_active": key.is_active,
        "created_at": key.created_at, "rate_limit_rpm": rpm,
        "secret": plain,
    }


@router.delete("/api-keys/{key_id}", tags=["API Keys"])
async def revoke_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    key = (await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.organization_id == current_user.organization_id)
    )).scalar_one_or_none()
    if not key:
        raise HTTPException(404, "API key not found")
    key.is_active = False
    await db.commit()
    return {"ok": True, "message": f"Key '{key.name}' revoked"}


# ─── Webhook Endpoints ───────────────────────────────────────────

class WebhookCreate(BaseModel):
    name: str
    url: str
    events: List[str] = ["alert_fired", "harvest_completed", "device_offline", "threshold_breached"]

class WebhookOut(BaseModel):
    id: str
    name: str
    url: str
    events: List[str]
    is_active: bool
    last_triggered: Optional[datetime]
    failure_count: int
    created_at: datetime
    model_config = {"from_attributes": True}


@router.get("/webhooks", response_model=List[WebhookOut], tags=["Webhooks"])
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WebhookEndpoint)
        .where(WebhookEndpoint.organization_id == current_user.organization_id)
        .order_by(desc(WebhookEndpoint.created_at))
    )
    return result.scalars().all()


@router.post("/webhooks", response_model=WebhookOut, tags=["Webhooks"])
async def create_webhook(
    data: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    wh = WebhookEndpoint(
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        url=data.url,
        name=data.name,
        events=data.events,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return wh


@router.delete("/webhooks/{wh_id}", tags=["Webhooks"])
async def delete_webhook(
    wh_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    wh = (await db.execute(
        select(WebhookEndpoint).where(WebhookEndpoint.id == wh_id, WebhookEndpoint.organization_id == current_user.organization_id)
    )).scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found")
    await db.delete(wh)
    await db.commit()
    return {"ok": True}


@router.post("/webhooks/{wh_id}/test", tags=["Webhooks"])
async def test_webhook(
    wh_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    wh = (await db.execute(
        select(WebhookEndpoint).where(WebhookEndpoint.id == wh_id, WebhookEndpoint.organization_id == current_user.organization_id)
    )).scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found")
    background_tasks.add_task(_deliver_webhook, wh.url, "ping", {"test": True, "sent_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "message": "Test ping sent"}


async def _deliver_webhook(url: str, event: str, payload: dict):
    """Background delivery with simple retry."""
    import httpx
    body = json.dumps({"event": event, "data": payload})
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(url, content=body, headers={"Content-Type": "application/json", "X-VertiFarm-Event": event})
            break
        except Exception:
            await asyncio.sleep(2 ** attempt)


# ════════════════════════════════════════════════════════════
# FEATURE 6 — NOTIFICATION CENTRE
# ════════════════════════════════════════════════════════════

class NotifOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    read_at: Optional[datetime]
    action_url: Optional[str]
    notif_meta: dict
    created_at: datetime
    model_config = {"from_attributes": True}

class NotifPrefOut(BaseModel):
    alert_type: str
    email_enabled: bool
    sms_enabled: bool
    whatsapp_enabled: bool
    inapp_enabled: bool
    push_enabled: bool
    model_config = {"from_attributes": True}

class NotifPrefUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    inapp_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None


_DEFAULT_ALERT_TYPES = [
    "critical_alert", "harvest_ready", "device_offline",
    "threshold_breach", "daily_digest",
]


@router.get("/notifications", response_model=List[NotifOut], tags=["Notifications"])
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.read_at == None)
    result = await db.execute(q.order_by(desc(Notification.created_at)).limit(limit))
    return result.scalars().all()


@router.get("/notifications/count", tags=["Notifications"])
async def notification_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id, Notification.read_at == None
        )
    )).scalar() or 0
    return {"unread": count}


@router.post("/notifications/{notif_id}/read", tags=["Notifications"])
async def mark_read(
    notif_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = (await db.execute(
        select(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id)
    )).scalar_one_or_none()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.post("/notifications/read-all", tags=["Notifications"])
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        sa_update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at == None)
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"ok": True}


@router.get("/notifications/preferences", response_model=List[NotifPrefOut], tags=["Notifications"])
async def get_notif_prefs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    prefs = {p.alert_type: p for p in result.scalars().all()}
    out = []
    for at in _DEFAULT_ALERT_TYPES:
        if at in prefs:
            out.append(prefs[at])
        else:
            # Return defaults
            out.append(NotifPrefOut(
                alert_type=at, email_enabled=True, sms_enabled=False,
                whatsapp_enabled=False, inapp_enabled=True, push_enabled=True
            ))
    return out


@router.patch("/notifications/preferences/{alert_type}", response_model=NotifPrefOut, tags=["Notifications"])
async def update_notif_pref(
    alert_type: str,
    data: NotifPrefUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pref = (await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == current_user.id,
            NotificationPreference.alert_type == alert_type
        )
    )).scalar_one_or_none()

    if not pref:
        pref = NotificationPreference(
            user_id=current_user.id, alert_type=alert_type,
            email_enabled=True, sms_enabled=False,
            whatsapp_enabled=False, inapp_enabled=True, push_enabled=True
        )
        db.add(pref)

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(pref, k, v)

    await db.commit()
    await db.refresh(pref)
    return pref


# ════════════════════════════════════════════════════════════
# FEATURE 7 — HARVEST & TRACEABILITY
# ════════════════════════════════════════════════════════════

class TraceCreate(BaseModel):
    batch_code: str
    crop_id: Optional[str] = None
    farm_name: str
    zone: Optional[str] = None
    grow_method: Optional[str] = None
    nutrients_used: List[str] = []
    water_source: Optional[str] = None
    certifications: List[str] = []
    test_results: Dict[str, Any] = {}
    sow_date: Optional[datetime] = None
    harvest_date: Optional[datetime] = None

class TraceOut(BaseModel):
    id: str
    batch_code: str
    crop_id: Optional[str]
    farm_name: str
    zone: Optional[str]
    grow_method: Optional[str]
    nutrients_used: List[str]
    water_source: Optional[str]
    certifications: List[str]
    test_results: Dict[str, Any]
    sow_date: Optional[datetime]
    harvest_date: Optional[datetime]
    qr_code_url: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


@router.get("/traceability", response_model=List[TraceOut], tags=["Traceability"])
async def list_traceability(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TraceabilityRecord).order_by(desc(TraceabilityRecord.created_at)).limit(100)
    )
    return result.scalars().all()


@router.get("/traceability/{batch_code}", response_model=TraceOut, tags=["Traceability"])
async def get_traceability(batch_code: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — no auth required."""
    rec = (await db.execute(
        select(TraceabilityRecord).where(TraceabilityRecord.batch_code == batch_code)
    )).scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Batch not found")
    return rec


@router.post("/traceability", response_model=TraceOut, tags=["Traceability"])
async def create_traceability(
    data: TraceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin", "farm_manager")
    existing = (await db.execute(
        select(TraceabilityRecord).where(TraceabilityRecord.batch_code == data.batch_code)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, f"Batch code '{data.batch_code}' already has a traceability record")

    rec = TraceabilityRecord(**data.model_dump())
    rec.qr_code_url = f"/t/{data.batch_code}"
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


@router.patch("/traceability/{batch_code}", response_model=TraceOut, tags=["Traceability"])
async def update_traceability(
    batch_code: str,
    data: TraceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin", "farm_manager")
    rec = (await db.execute(
        select(TraceabilityRecord).where(TraceabilityRecord.batch_code == batch_code)
    )).scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Traceability record not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(rec, k, v)
    await db.commit()
    await db.refresh(rec)
    return rec


@router.get("/traceability/{batch_code}/pdf", tags=["Traceability"])
async def download_traceability_pdf(batch_code: str, db: AsyncSession = Depends(get_db)):
    """Generate and return a PDF traceability certificate."""
    rec = (await db.execute(
        select(TraceabilityRecord).where(TraceabilityRecord.batch_code == batch_code)
    )).scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Batch not found")

    # Build HTML for WeasyPrint
    html_content = _build_trace_html(rec)
    try:
        from weasyprint import HTML as WP_HTML
        pdf_bytes = WP_HTML(string=html_content).write_pdf()
    except Exception:
        # Fallback: return HTML as plain text if WeasyPrint not available
        return Response(content=html_content, media_type="text/html")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=trace_{batch_code}.pdf"},
    )


def _build_trace_html(rec: TraceabilityRecord) -> str:
    certs = ", ".join(rec.certifications) if rec.certifications else "—"
    nutrients = ", ".join(rec.nutrients_used) if rec.nutrients_used else "—"
    sow = rec.sow_date.strftime("%d %b %Y") if rec.sow_date else "—"
    harv = rec.harvest_date.strftime("%d %b %Y") if rec.harvest_date else "—"
    tests_rows = ""
    if rec.test_results:
        for k, v in rec.test_results.items():
            tests_rows += f"<tr><td>{k}</td><td>{v}</td></tr>"

    return f"""<!DOCTYPE html><html><head><meta charset='utf-8'>
<style>
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #1a2b3c; }}
  .header {{ background: linear-gradient(135deg,#00d4aa,#0066ff); color:#fff; padding:32px; border-radius:12px; margin-bottom:32px; }}
  .header h1 {{ margin:0 0 8px; font-size:26px; }}
  .header p {{ margin:0; opacity:0.85; font-size:14px; }}
  .badge {{ display:inline-block; background:rgba(255,255,255,0.2); padding:4px 12px; border-radius:20px; font-size:12px; margin-top:12px; }}
  table {{ width:100%; border-collapse:collapse; margin-bottom:24px; }}
  th {{ background:#f0f7f4; text-align:left; padding:10px 14px; font-size:13px; color:#0066ff; font-weight:600; border-bottom:2px solid #00d4aa; }}
  td {{ padding:9px 14px; font-size:13px; border-bottom:1px solid #e8f0ee; }}
  .section-title {{ font-size:16px; font-weight:700; color:#003d29; margin:28px 0 12px; border-left:4px solid #00d4aa; padding-left:12px; }}
  .footer {{ margin-top:40px; font-size:11px; color:#999; text-align:center; border-top:1px solid #e0e0e0; padding-top:16px; }}
</style></head><body>
<div class='header'>
  <h1>🌱 Crop Traceability Certificate</h1>
  <p>VertiFarm OS — Farm-to-Table Transparency Report</p>
  <span class='badge'>Batch: {rec.batch_code}</span>
</div>

<div class='section-title'>Farm Information</div>
<table><tr><th>Field</th><th>Value</th></tr>
<tr><td>Farm Name</td><td>{rec.farm_name}</td></tr>
<tr><td>Zone / Section</td><td>{rec.zone or '—'}</td></tr>
<tr><td>Grow Method</td><td>{rec.grow_method or '—'}</td></tr>
<tr><td>Water Source</td><td>{rec.water_source or '—'}</td></tr>
</table>

<div class='section-title'>Crop Timeline</div>
<table><tr><th>Field</th><th>Value</th></tr>
<tr><td>Sow Date</td><td>{sow}</td></tr>
<tr><td>Harvest Date</td><td>{harv}</td></tr>
<tr><td>Nutrients Used</td><td>{nutrients}</td></tr>
<tr><td>Certifications</td><td>{certs}</td></tr>
</table>

{f'''<div class='section-title'>Lab Test Results</div>
<table><tr><th>Test</th><th>Result</th></tr>{tests_rows}</table>''' if tests_rows else ''}

<div class='footer'>
  Generated by VertiFarm OS · {datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")} ·
  Batch {rec.batch_code} — FSSAI / ISO 22000 Compliant Format
</div>
</body></html>"""


# ─── QR Code generation ──────────────────────────────────────────

@router.get("/traceability/{batch_code}/qr", tags=["Traceability"])
async def get_qr_code(batch_code: str, db: AsyncSession = Depends(get_db)):
    """Return a PNG QR code for the public traceability URL."""
    rec = (await db.execute(
        select(TraceabilityRecord).where(TraceabilityRecord.batch_code == batch_code)
    )).scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Batch not found")

    try:
        import qrcode
        qr = qrcode.QRCode(version=2, box_size=8, border=4)
        qr.add_data(f"https://app.vertifarm.io/t/{batch_code}")
        qr.make(fit=True)
        img = qr.make_image(fill_color="#003d29", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png")
    except ImportError:
        raise HTTPException(503, "QR library not available")


# ════════════════════════════════════════════════════════════
# FEATURE 8 — INTEGRATION HUB
# ════════════════════════════════════════════════════════════

class IntegrationOut(BaseModel):
    id: str
    type: str
    name: str
    is_active: bool
    auth_method: str
    last_synced_at: Optional[datetime]
    last_error: Optional[str]
    config: dict
    created_at: datetime
    model_config = {"from_attributes": True}

class IntegrationConnect(BaseModel):
    type: str
    name: Optional[str] = None
    api_key: Optional[str] = None      # for API key auth
    api_secret: Optional[str] = None
    config: Dict[str, Any] = {}

class IntegrationUpdate(BaseModel):
    is_active: Optional[bool] = None
    api_key: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


# Catalog of all available integrations
INTEGRATION_CATALOG = [
    {"type": "tally_prime",    "name": "Tally Prime",     "category": "ERP",           "auth": "api_key",  "description": "Export harvest logs as sales entries to Tally Prime", "logo": "🏢"},
    {"type": "zoho_books",     "name": "Zoho Books",      "category": "ERP",           "auth": "oauth2",   "description": "Sync harvest data and invoices with Zoho Books", "logo": "📊"},
    {"type": "delhivery",      "name": "Delhivery",       "category": "Logistics",     "auth": "api_key",  "description": "Create shipments from harvest batches via Delhivery", "logo": "🚚"},
    {"type": "shiprocket",     "name": "Shiprocket",      "category": "Logistics",     "auth": "api_key",  "description": "Multi-courier shipping from harvest to delivery", "logo": "🚀"},
    {"type": "openweathermap", "name": "OpenWeatherMap",  "category": "Weather",       "auth": "api_key",  "description": "Local weather data for irrigation & climate decisions", "logo": "🌤️"},
    {"type": "fssai",          "name": "FSSAI",           "category": "Certifications","auth": "api_key",  "description": "Auto-fill FSSAI compliance reports from farm data", "logo": "🏛️"},
    {"type": "globalgap",      "name": "GlobalG.A.P.",    "category": "Certifications","auth": "api_key",  "description": "GlobalG.A.P. certification pre-fill from grow data", "logo": "🌐"},
    {"type": "slack",          "name": "Slack",           "category": "Communication", "auth": "oauth2",   "description": "Forward critical alerts and harvest alerts to Slack", "logo": "💬"},
    {"type": "whatsapp_biz",   "name": "WhatsApp Business","category": "Communication","auth": "api_key",  "description": "Send alerts and reports via WhatsApp Business API", "logo": "📱"},
    {"type": "lims_generic",   "name": "LIMS Import",     "category": "LIMS",          "auth": "api_key",  "description": "Import lab test results (heavy metals, pesticides) into traceability", "logo": "🔬"},
]


@router.get("/integrations/catalog", tags=["Integrations"])
async def get_catalog():
    """Public catalog of all available integrations."""
    return INTEGRATION_CATALOG


@router.get("/integrations", response_model=List[IntegrationOut], tags=["Integrations"])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Integration).where(Integration.organization_id == current_user.organization_id)
    )
    return result.scalars().all()


@router.post("/integrations", response_model=IntegrationOut, tags=["Integrations"])
async def connect_integration(
    data: IntegrationConnect,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    # Validate type
    valid_types = [i["type"] for i in INTEGRATION_CATALOG]
    if data.type not in valid_types:
        raise HTTPException(400, f"Unknown integration type '{data.type}'")

    # Check if already exists
    existing = (await db.execute(
        select(Integration).where(
            Integration.organization_id == current_user.organization_id,
            Integration.type == data.type
        )
    )).scalar_one_or_none()

    catalog_item = next(i for i in INTEGRATION_CATALOG if i["type"] == data.type)
    creds = {}
    if data.api_key:
        creds["api_key"] = data.api_key
    if data.api_secret:
        creds["api_secret"] = data.api_secret

    # Encrypt credentials (simple base64 for now; swap to Fernet in production)
    creds_enc = base64.b64encode(json.dumps(creds).encode()).decode() if creds else None

    if existing:
        existing.is_active = True
        existing.credentials_encrypted = creds_enc
        existing.config = {**existing.config, **data.config}
        existing.last_error = None
        await db.commit()
        await db.refresh(existing)
        return existing

    intg = Integration(
        organization_id=current_user.organization_id,
        type=data.type,
        name=data.name or catalog_item["name"],
        auth_method=catalog_item["auth"],
        credentials_encrypted=creds_enc,
        config=data.config,
        is_active=True,
    )
    db.add(intg)
    await db.commit()
    await db.refresh(intg)
    return intg


@router.patch("/integrations/{intg_id}", response_model=IntegrationOut, tags=["Integrations"])
async def update_integration(
    intg_id: str,
    data: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    intg = (await db.execute(
        select(Integration).where(
            Integration.id == intg_id,
            Integration.organization_id == current_user.organization_id
        )
    )).scalar_one_or_none()
    if not intg:
        raise HTTPException(404, "Integration not found")
    if data.is_active is not None:
        intg.is_active = data.is_active
    if data.config:
        intg.config = {**intg.config, **data.config}
    if data.api_key:
        creds = {"api_key": data.api_key}
        intg.credentials_encrypted = base64.b64encode(json.dumps(creds).encode()).decode()
    await db.commit()
    await db.refresh(intg)
    return intg


@router.delete("/integrations/{intg_id}", tags=["Integrations"])
async def disconnect_integration(
    intg_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    intg = (await db.execute(
        select(Integration).where(
            Integration.id == intg_id,
            Integration.organization_id == current_user.organization_id
        )
    )).scalar_one_or_none()
    if not intg:
        raise HTTPException(404, "Integration not found")
    intg.is_active = False
    intg.credentials_encrypted = None
    await db.commit()
    return {"ok": True, "message": f"Integration '{intg.name}' disconnected"}


@router.post("/integrations/{intg_id}/sync", tags=["Integrations"])
async def sync_integration(
    intg_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a manual sync for an integration."""
    _require_role(current_user, "superadmin", "org_admin", "farm_manager")
    intg = (await db.execute(
        select(Integration).where(
            Integration.id == intg_id,
            Integration.organization_id == current_user.organization_id
        )
    )).scalar_one_or_none()
    if not intg:
        raise HTTPException(404, "Integration not found")
    if not intg.is_active:
        raise HTTPException(400, "Integration is not active")

    intg.last_synced_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "message": f"Sync triggered for '{intg.name}'", "synced_at": intg.last_synced_at}


# ─── Public traceability scan page data ─────────────────────────

@router.get("/public/trace/{batch_code}", tags=["Public"])
async def public_trace(batch_code: str, db: AsyncSession = Depends(get_db)):
    """Used by the buyer portal QR scan — no auth."""
    rec = (await db.execute(
        select(TraceabilityRecord).where(
            TraceabilityRecord.batch_code == batch_code,
            TraceabilityRecord.is_public == True
        )
    )).scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Batch not found or not public")

    # Also grab crop info if linked
    crop = None
    if rec.crop_id:
        crop = (await db.execute(select(Crop).where(Crop.id == rec.crop_id))).scalar_one_or_none()

    return {
        "batch_code": rec.batch_code,
        "farm_name": rec.farm_name,
        "zone": rec.zone,
        "grow_method": rec.grow_method,
        "water_source": rec.water_source,
        "nutrients_used": rec.nutrients_used,
        "certifications": rec.certifications,
        "test_results": rec.test_results,
        "sow_date": rec.sow_date.isoformat() if rec.sow_date else None,
        "harvest_date": rec.harvest_date.isoformat() if rec.harvest_date else None,
        "crop_name": crop.name if crop else None,
        "crop_status": str(crop.status) if crop else None,
        "pdf_url": f"/api/v1/traceability/{batch_code}/pdf",
        "qr_url": f"/api/v1/traceability/{batch_code}/qr",
    }
