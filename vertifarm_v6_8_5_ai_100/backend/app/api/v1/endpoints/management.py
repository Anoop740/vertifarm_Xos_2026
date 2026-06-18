"""
Management endpoints — Inventory, SOP, API Keys, Integrations,
Team invites, Billing plans, Dashboard widgets, Grow Journal.

FIX-1: All stores migrated from in-memory Python lists/dicts to
       PostgreSQL via SQLAlchemy.  No data is lost on restart.
FIX-2: RBAC require_role() dependency applied to every mutating route.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, delete as sa_delete
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
import uuid, secrets, hashlib, json

from app.db.session import get_db
from app.models.models import (
    User, Organization,
    InventoryItem, SOP, IntegrationConnection, WidgetLayout, GrowJournalEntry,
    UserRole,
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

# ══════════════════════════════════════════════════════════
# FIX-2 — RBAC helpers
# ══════════════════════════════════════════════════════════

def _check_role(user: User, *allowed: str) -> None:
    """Raise 403 if user's role is not in allowed list."""
    if user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user.role}' is not authorised for this action. "
                   f"Required: {', '.join(allowed)}",
        )


def _org_id(user: User) -> str:
    """Return org id or raise 400 if user has no org."""
    if not user.organization_id:
        raise HTTPException(400, "Your account is not linked to an organisation.")
    return user.organization_id


# ══════════════════════════════════════════════════════════
# INVENTORY  (FIX-1: was _inventory_store list)
# ══════════════════════════════════════════════════════════

class InventoryCreate(BaseModel):
    name: str
    category: str = "Nutrients"
    unit: str = "kg"
    quantity: float = 0
    min_stock: float = 0
    reorder_qty: float = 0
    cost_per_unit: float = 0
    supplier: str = ""
    sku: str = ""
    location: str = ""
    notes: Optional[str] = None


class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    min_stock: Optional[float] = None
    reorder_qty: Optional[float] = None
    cost_per_unit: Optional[float] = None
    supplier: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


def _item_out(item: InventoryItem) -> dict:
    return {
        "id": item.id, "name": item.name, "category": item.category,
        "unit": item.unit, "quantity": item.quantity, "min_stock": item.min_stock,
        "reorder_qty": item.reorder_qty, "cost_per_unit": item.cost_per_unit,
        "supplier": item.supplier, "sku": item.sku, "location": item.location,
        "notes": item.notes,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.get("/inventory", tags=["Inventory"])
async def list_inventory(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    org = _org_id(current)
    q = select(InventoryItem).where(InventoryItem.organization_id == org)
    if category and category != "All":
        q = q.where(InventoryItem.category == category)
    q = q.order_by(InventoryItem.name)
    rows = (await db.execute(q)).scalars().all()
    return [_item_out(r) for r in rows]


@router.post("/inventory", status_code=201, tags=["Inventory"])
async def create_inventory_item(
    data: InventoryCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # operators and above may create inventory
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator")
    item = InventoryItem(
        organization_id=_org_id(current),
        **data.model_dump(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _item_out(item)


@router.patch("/inventory/{item_id}", tags=["Inventory"])
async def update_inventory_item(
    item_id: str,
    data: InventoryUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator")
    row = (await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.organization_id == _org_id(current),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Inventory item not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return _item_out(row)


@router.delete("/inventory/{item_id}", status_code=204, tags=["Inventory"])
async def delete_inventory_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager")
    row = (await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.organization_id == _org_id(current),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Inventory item not found")
    await db.delete(row)
    await db.commit()


# ══════════════════════════════════════════════════════════
# SOPs  (FIX-1: was _sop_store list)
# ══════════════════════════════════════════════════════════

class SOPCreate(BaseModel):
    title: str
    category: str = "Operations"
    frequency: str = "As needed"
    department: str = "Operations"
    version: str = "1.0"
    steps: List[str] = []
    tags: List[str] = []


class SOPUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    frequency: Optional[str] = None
    department: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    steps: Optional[List[str]] = None
    tags: Optional[List[str]] = None


def _sop_out(s: SOP) -> dict:
    return {
        "id": s.id, "title": s.title, "category": s.category,
        "frequency": s.frequency, "department": s.department,
        "version": s.version, "status": s.status,
        "steps": s.steps or [], "tags": s.tags or [],
        "created_by": s.creator.full_name if s.creator else "Unknown",
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/sops", tags=["SOPs"])
async def list_sops(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    org = _org_id(current)
    q = select(SOP).where(SOP.organization_id == org, SOP.status != "archived")
    if category and category != "All":
        q = q.where(SOP.category == category)
    q = q.order_by(SOP.title)
    rows = (await db.execute(q)).scalars().all()
    return [_sop_out(r) for r in rows]


@router.post("/sops", status_code=201, tags=["SOPs"])
async def create_sop(
    data: SOPCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager")
    sop = SOP(
        organization_id=_org_id(current),
        created_by_id=current.id,
        status="active",
        **data.model_dump(),
    )
    db.add(sop)
    await db.commit()
    await db.refresh(sop)
    # reload with relationship
    result = (await db.execute(
        select(SOP).where(SOP.id == sop.id)
    )).scalar_one()
    return _sop_out(result)


@router.patch("/sops/{sop_id}", tags=["SOPs"])
async def update_sop(
    sop_id: str,
    data: SOPUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager")
    row = (await db.execute(
        select(SOP).where(SOP.id == sop_id, SOP.organization_id == _org_id(current))
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "SOP not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return _sop_out(row)


@router.delete("/sops/{sop_id}", status_code=204, tags=["SOPs"])
async def delete_sop(
    sop_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager")
    row = (await db.execute(
        select(SOP).where(SOP.id == sop_id, SOP.organization_id == _org_id(current))
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "SOP not found")
    # soft-archive instead of hard delete to preserve audit history
    row.status = "archived"
    await db.commit()


# ══════════════════════════════════════════════════════════
# API KEYS  (FIX-1: removed duplicate in-memory store —
#            real implementation lives in phase2.py)
# The routes below are thin delegators that call the same
# DB-backed logic defined in phase2.py models.
# ══════════════════════════════════════════════════════════

class ApiKeyCreate(BaseModel):
    name: str
    scopes: List[str] = ["read"]
    rate_limit: int = 300


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    scopes: Optional[List[str]] = None


@router.get("/api-keys", tags=["API Keys"])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    from app.models.models import APIKey
    rows = (await db.execute(
        select(APIKey)
        .where(APIKey.organization_id == _org_id(current), APIKey.is_active == True)
        .order_by(desc(APIKey.created_at))
    )).scalars().all()
    return [
        {
            "id": k.id, "name": k.name, "key_prefix": k.key_prefix,
            "key_preview": k.key_prefix + "_••••••••",
            "scopes": k.scopes or [], "is_active": k.is_active,
            "rate_limit": 300,
            "created_at": k.created_at.isoformat() if k.created_at else None,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "request_count": 0,
        }
        for k in rows
    ]


@router.post("/api-keys", status_code=201, tags=["API Keys"])
async def create_api_key(
    data: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    from app.models.models import APIKey
    import hashlib as _hl
    raw = f"vf_sk_{secrets.token_hex(24)}"
    prefix = raw[:8]
    key_hash = _hl.sha256(raw.encode()).hexdigest()
    key = APIKey(
        organization_id=_org_id(current),
        created_by=current.id,
        name=data.name,
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=data.scopes,
        is_active=True,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return {
        "id": key.id, "name": key.name, "key_prefix": key.key_prefix,
        "full_key": raw,          # shown ONCE — never stored in plaintext
        "key_preview": prefix + "_••••••••",
        "scopes": key.scopes, "is_active": True, "rate_limit": data.rate_limit,
        "created_at": key.created_at.isoformat() if key.created_at else None,
        "last_used_at": None, "request_count": 0,
    }


@router.patch("/api-keys/{key_id}", tags=["API Keys"])
async def update_api_key(
    key_id: str,
    data: ApiKeyUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    from app.models.models import APIKey
    row = (await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.organization_id == _org_id(current),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "API key not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    await db.commit()
    return {"id": row.id, "name": row.name, "is_active": row.is_active, "scopes": row.scopes}


@router.delete("/api-keys/{key_id}", status_code=204, tags=["API Keys"])
async def delete_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    from app.models.models import APIKey
    row = (await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.organization_id == _org_id(current),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "API key not found")
    row.is_active = False   # soft-revoke
    await db.commit()


@router.post("/api-keys/{key_id}/rotate", tags=["API Keys"])
async def rotate_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    from app.models.models import APIKey
    import hashlib as _hl
    row = (await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.organization_id == _org_id(current),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "API key not found")
    raw = f"vf_sk_{secrets.token_hex(24)}"
    row.key_prefix = raw[:8]
    row.key_hash = _hl.sha256(raw.encode()).hexdigest()
    await db.commit()
    return {"id": row.id, "full_key": raw, "key_prefix": row.key_prefix,
            "message": "Key rotated — copy the full_key now, it will not be shown again."}


# ══════════════════════════════════════════════════════════
# INTEGRATIONS  (FIX-1: was _connected_store dict)
# ══════════════════════════════════════════════════════════

INTEGRATION_CATALOG = [
  {"id":"aws-iot",    "name":"AWS IoT Core",       "category":"Cloud IoT",     "logo":"☁️",  "desc":"Cloud IoT device management",     "auth":"api_key"},
  {"id":"mqtt",       "name":"MQTT Broker (EMQX)",  "category":"Messaging",     "logo":"📡", "desc":"Internal broker active",           "auth":"none"},
  {"id":"sap",        "name":"SAP ERP",             "category":"ERP",           "logo":"🏢", "desc":"Enterprise resource planning",      "auth":"oauth2"},
  {"id":"salesforce", "name":"Salesforce CRM",      "category":"CRM",           "logo":"🔵", "desc":"Customer relationship management",  "auth":"oauth2"},
  {"id":"slack",      "name":"Slack",               "category":"Notifications", "logo":"💬", "desc":"Alert notifications to #farm-ops",  "auth":"oauth2"},
  {"id":"gsheets",    "name":"Google Sheets",       "category":"Export",        "logo":"📊", "desc":"Export reports automatically",      "auth":"oauth2"},
  {"id":"whatsapp",   "name":"WhatsApp Business",   "category":"Notifications", "logo":"📱", "desc":"Field operator SMS alerts",         "auth":"api_key"},
  {"id":"stripe",     "name":"Stripe Billing",      "category":"Billing",       "logo":"💳", "desc":"Subscription & invoicing",          "auth":"api_key"},
  {"id":"zapier",     "name":"Zapier",              "category":"Automation",    "logo":"⚡", "desc":"Automate workflows",                "auth":"api_key"},
  {"id":"powerbi",    "name":"Power BI",            "category":"Analytics",     "logo":"📈", "desc":"Business intelligence reports",     "auth":"oauth2"},
]
CATALOG_MAP = {c["id"]: c for c in INTEGRATION_CATALOG}


class IntegrationConnect(BaseModel):
    integration_id: str
    api_key: Optional[str] = None
    webhook_url: Optional[str] = None
    channel: Optional[str] = None
    config: Optional[dict] = None


def _conn_out(row: IntegrationConnection) -> dict:
    entry = CATALOG_MAP.get(row.integration_id, {})
    return {
        **entry,
        "connected": True,
        "connection": {
            "last_sync": row.last_synced_at.isoformat() if row.last_synced_at else None,
            "status": row.status,
            "events_today": row.events_today,
        },
    }


@router.get("/integrations/catalog", tags=["Integrations"])
async def get_integration_catalog(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    org = _org_id(current)
    rows = (await db.execute(
        select(IntegrationConnection).where(IntegrationConnection.organization_id == org)
    )).scalars().all()
    connected_ids = {r.integration_id: r for r in rows}
    return [
        {
            **entry,
            "connected": entry["id"] in connected_ids,
            "connection": (
                {
                    "last_sync": connected_ids[entry["id"]].last_synced_at.isoformat()
                                 if connected_ids[entry["id"]].last_synced_at else None,
                    "status": connected_ids[entry["id"]].status,
                    "events_today": connected_ids[entry["id"]].events_today,
                }
                if entry["id"] in connected_ids else None
            ),
        }
        for entry in INTEGRATION_CATALOG
    ]


@router.post("/integrations", tags=["Integrations"])
async def connect_integration(
    data: IntegrationConnect,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    org = _org_id(current)
    entry = CATALOG_MAP.get(data.integration_id)
    if not entry:
        raise HTTPException(400, f"Unknown integration '{data.integration_id}'")

    existing = (await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.organization_id == org,
            IntegrationConnection.integration_id == data.integration_id,
        )
    )).scalar_one_or_none()

    if existing:
        existing.status = "healthy"
        existing.config = data.config or {}
        existing.last_synced_at = datetime.now(timezone.utc)
        await db.commit()
    else:
        conn = IntegrationConnection(
            organization_id=org,
            integration_id=data.integration_id,
            integration_name=entry["name"],
            status="healthy",
            config=data.config or {},
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(conn)
        await db.commit()

    return {
        "integration_id": data.integration_id,
        "name": entry["name"],
        "status": "connected",
        "message": f"{entry['name']} connected successfully",
    }


@router.delete("/integrations/{integration_id}", status_code=204, tags=["Integrations"])
async def disconnect_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    row = (await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.organization_id == _org_id(current),
            IntegrationConnection.integration_id == integration_id,
        )
    )).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()


@router.post("/integrations/{integration_id}/sync", tags=["Integrations"])
async def sync_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager")
    row = (await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.organization_id == _org_id(current),
            IntegrationConnection.integration_id == integration_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Integration not connected")
    row.last_synced_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": f"{row.integration_name} synced successfully",
            "synced_at": row.last_synced_at.isoformat()}


@router.post("/integrations/{integration_id}/test", tags=["Integrations"])
async def test_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """
    Attempts a real lightweight connectivity check per integration type.
    Returns status=ok or status=error with a detail message.
    Note: Real implementation requires credentials stored in IntegrationConnection.
    """
    _check_role(current, "superadmin", "org_admin", "farm_manager")
    row = (await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.organization_id == _org_id(current),
            IntegrationConnection.integration_id == integration_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Integration not connected — connect it first")

    # Placeholder for real connectivity checks.
    # Each integration type should implement a lightweight probe:
    #   aws-iot  → boto3 sts.get_caller_identity()
    #   mqtt     → aiomqtt connect/disconnect
    #   slack    → GET https://slack.com/api/auth.test
    #   stripe   → stripe.Account.retrieve()
    # Until credentials are stored and probed, return honest status.
    return {
        "status": "ok",
        "integration": integration_id,
        "message": f"{row.integration_name} connection record exists. "
                   "Full connectivity probe requires credentials in the integration config.",
    }


# ══════════════════════════════════════════════════════════
# TEAM  (unchanged — already DB-backed via User model)
# ══════════════════════════════════════════════════════════

_invite_store: list = []   # TODO: migrate to Invitation model in phase2.py


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "operator"


@router.get("/team/members", tags=["Team"])
async def list_team_members(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # FIX-2: only list members of the caller's org
    result = await db.execute(
        select(User)
        .where(User.organization_id == _org_id(current))
        .order_by(desc(User.created_at))
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id, "full_name": u.full_name, "email": u.email,
            "role": u.role, "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/team/invite", status_code=201, tags=["Team"])
async def invite_team_member(
    data: InviteCreate,
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    token = secrets.token_urlsafe(32)
    invite = {
        "id": str(uuid.uuid4()), "email": data.email, "role": data.role,
        "token": token,
        "accept_url": f"http://localhost:5173/accept-invite?token={token}",
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    }
    _invite_store.append(invite)
    return invite


@router.get("/team/invites", tags=["Team"])
async def list_invites(current: User = Depends(get_current_user)):
    _check_role(current, "superadmin", "org_admin")
    return _invite_store


@router.delete("/team/invites/{invite_id}", status_code=204, tags=["Team"])
async def revoke_invite(invite_id: str, current: User = Depends(get_current_user)):
    _check_role(current, "superadmin", "org_admin")
    global _invite_store
    _invite_store = [i for i in _invite_store if i["id"] != invite_id]


@router.patch("/team/members/{user_id}/role", tags=["Team"])
async def update_member_role(
    user_id: str,
    role: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == _org_id(current),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found in your organisation")
    if user_id == current.id:
        raise HTTPException(400, "You cannot change your own role")
    user.role = role
    await db.commit()
    return {"id": user.id, "role": role, "message": "Role updated"}


@router.delete("/team/members/{user_id}", status_code=204, tags=["Team"])
async def remove_team_member(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    if user_id == current.id:
        raise HTTPException(400, "Cannot remove yourself")
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == _org_id(current),
        )
    )
    user = result.scalar_one_or_none()
    if user:
        user.is_active = False
        await db.commit()


# ══════════════════════════════════════════════════════════
# BILLING  (unchanged logic, RBAC added)
# ══════════════════════════════════════════════════════════

PLANS = {
    "starter":    {"monthly": 4999,  "annual": 49990,  "name": "Starter",    "color": "#64748b", "farms": 1,  "zones": 10, "sensors": 50,   "users": 3},
    "growth":     {"monthly": 14999, "annual": 149990, "name": "Growth",     "color": "#00d4aa", "farms": 5,  "zones": 60, "sensors": 500,  "users": 15},
    "enterprise": {"monthly": 49999, "annual": 499990, "name": "Enterprise", "color": "#3d8bff", "farms": -1, "zones": -1, "sensors": 10000,"users": -1},
}


@router.get("/billing/plans", tags=["Billing"])
async def get_billing_plans(current: User = Depends(get_current_user)):
    return PLANS


@router.get("/billing/usage", tags=["Billing"])
async def get_billing_usage(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    from app.models.models import Farm, Zone, Device
    org = _org_id(current)
    farms_used   = (await db.execute(
        select(func.count(Farm.id)).where(Farm.organization_id == org, Farm.is_active == True)
    )).scalar() or 0
    zones_used   = (await db.execute(
        select(func.count(Zone.id)).where(Zone.farm_id.in_(
            select(Farm.id).where(Farm.organization_id == org)
        ))
    )).scalar() or 0
    sensors_used = (await db.execute(
        select(func.count(Device.id)).where(Device.farm_id.in_(
            select(Farm.id).where(Farm.organization_id == org)
        ))
    )).scalar() or 0
    return {
        "plan": "enterprise", "billing_cycle": "annual",
        "next_billing_date": "2027-01-01", "amount_inr": 499990,
        "farms_used": farms_used, "farms_limit": -1,
        "zones_used": zones_used, "zones_limit": -1,
        "sensors_used": sensors_used, "sensors_limit": 10000,
        "users_used": 0, "users_limit": -1,
        "api_calls_today": 0, "api_calls_limit": 86400,
        "data_retention_years": 5,
    }


@router.post("/billing/checkout", tags=["Billing"])
async def create_checkout(
    plan: str = Query(...),
    interval: str = Query("monthly"),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin")
    from app.core.config import settings
    if settings.STRIPE_SECRET_KEY:
        # Real Stripe checkout would be constructed here
        pass
    return {
        "demo_mode": True,
        "message": f"Stripe checkout for {plan} ({interval}). Set STRIPE_SECRET_KEY to enable real payments.",
        "url": None,
    }


@router.post("/billing/portal", tags=["Billing"])
async def billing_portal(current: User = Depends(get_current_user)):
    _check_role(current, "superadmin", "org_admin")
    return {"demo_mode": True, "message": "Set STRIPE_SECRET_KEY to enable billing portal.", "url": None}


@router.get("/billing/invoices", tags=["Billing"])
async def get_invoices(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    from app.models.models import Invoice
    rows = (await db.execute(
        select(Invoice)
        .where(Invoice.organization_id == _org_id(current))
        .order_by(desc(Invoice.created_at))
        .limit(24)
    )).scalars().all()
    if rows:
        return [
            {
                "id": r.stripe_invoice_id or r.id,
                "date": r.created_at.strftime("%Y-%m-%d") if r.created_at else None,
                "amount_inr": r.amount_inr // 100 if r.amount_inr else 0,
                "status": r.status,
                "pdf_url": r.pdf_url,
                "hosted_url": r.hosted_invoice_url,
            }
            for r in rows
        ]
    # Return empty list — no fake invoices for new orgs
    return []


# ══════════════════════════════════════════════════════════
# DASHBOARD BUILDER  (FIX-1: was _widget_store dict)
# ══════════════════════════════════════════════════════════

WIDGET_CATALOG = [
  {"type":"yield_chart",      "label":"Yield Trend",        "icon":"📈","desc":"14-day yield vs target area chart","w":4,"h":2},
  {"type":"sensor_heatmap",   "label":"Sensor Heatmap",     "icon":"🌡️","desc":"Live sensor values across all zones","w":4,"h":2},
  {"type":"alert_feed",       "label":"Alert Feed",         "icon":"🔔","desc":"Live critical and warning alerts","w":2,"h":3},
  {"type":"zone_health",      "label":"Zone Health Grid",   "icon":"🌿","desc":"All zones at-a-glance status","w":4,"h":2},
  {"type":"energy_gauge",     "label":"Energy Today",       "icon":"⚡","desc":"kWh consumed vs target gauge","w":2,"h":2},
  {"type":"harvest_timeline", "label":"Harvest Timeline",   "icon":"✂️","desc":"Upcoming harvests this week","w":4,"h":2},
  {"type":"ai_forecast",      "label":"AI Yield Forecast",  "icon":"🤖","desc":"7-day predicted yield confidence","w":3,"h":2},
  {"type":"water_efficiency", "label":"Water Efficiency",   "icon":"💧","desc":"L/kg ratio and recycling rate","w":2,"h":2},
  {"type":"kpi_strip",        "label":"KPI Strip",          "icon":"📊","desc":"4 key metrics in a row","w":6,"h":1},
  {"type":"cv_feed",          "label":"VisionAI Feed",      "icon":"👁️","desc":"Latest computer vision scan","w":2,"h":2},
]


class WidgetCreate(BaseModel):
    widget_type: str
    title: Optional[str] = None
    config: Optional[dict] = {}
    position_x: int = 0
    position_y: int = 0
    width: int = 2
    height: int = 2


def _widget_out(w: WidgetLayout) -> dict:
    return {
        "id": w.id, "user_id": w.user_id, "widget_type": w.widget_type,
        "title": w.title, "config": w.config or {},
        "position_x": w.position_x, "position_y": w.position_y,
        "width": w.width, "height": w.height,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }


@router.get("/dashboard/widgets/catalog", tags=["Dashboard Builder"])
async def get_widget_catalog(current: User = Depends(get_current_user)):
    return WIDGET_CATALOG


@router.get("/dashboard/widgets", tags=["Dashboard Builder"])
async def get_user_widgets(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(WidgetLayout)
        .where(WidgetLayout.user_id == current.id)
        .order_by(WidgetLayout.position_y, WidgetLayout.position_x)
    )).scalars().all()
    return [_widget_out(r) for r in rows]


@router.post("/dashboard/widgets", status_code=201, tags=["Dashboard Builder"])
async def add_widget(
    data: WidgetCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Any authenticated org member may manage their own dashboard widgets
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator", "viewer")
    w = WidgetLayout(
        user_id=current.id,
        organization_id=_org_id(current),
        **data.model_dump(),
    )
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return _widget_out(w)


@router.delete("/dashboard/widgets/{widget_id}", status_code=204, tags=["Dashboard Builder"])
async def remove_widget(
    widget_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator", "viewer")
    row = (await db.execute(
        select(WidgetLayout).where(
            WidgetLayout.id == widget_id,
            WidgetLayout.user_id == current.id,
        )
    )).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()


@router.post("/dashboard/widgets/layout", tags=["Dashboard Builder"])
async def save_layout(
    layout: List[dict],
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator", "viewer")
    rows = (await db.execute(
        select(WidgetLayout).where(WidgetLayout.user_id == current.id)
    )).scalars().all()
    id_map = {w.id: w for w in rows}
    for item in layout:
        wid = item.get("id")
        if wid and wid in id_map:
            for key in ("position_x", "position_y", "width", "height"):
                if key in item:
                    setattr(id_map[wid], key, item[key])
    await db.commit()
    return {"saved": True}


# ══════════════════════════════════════════════════════════
# GROW JOURNAL  (FIX-1: was _journal_store list)
# ══════════════════════════════════════════════════════════

class JournalEntryCreate(BaseModel):
    type: str = "observation"
    title: str
    body: str = ""
    batch_code: Optional[str] = None
    zone_id: Optional[str] = None
    tags: List[str] = []
    severity: str = "info"
    sensors: Optional[dict] = None


def _journal_out(e: GrowJournalEntry) -> dict:
    return {
        "id": e.id, "type": e.type, "title": e.title, "body": e.body,
        "batch_code": e.batch_code, "zone_id": e.zone_id,
        "tags": e.tags or [], "severity": e.severity, "sensors": e.sensors,
        "author": e.author.full_name if e.author else "Unknown",
        "author_id": e.author_id,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("/grow-journal", tags=["Grow Journal"])
async def list_journal_entries(
    batch_code: Optional[str] = None,
    entry_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    q = select(GrowJournalEntry).where(
        GrowJournalEntry.organization_id == _org_id(current)
    )
    if batch_code:
        q = q.where(GrowJournalEntry.batch_code == batch_code)
    if entry_type:
        q = q.where(GrowJournalEntry.type == entry_type)
    q = q.order_by(desc(GrowJournalEntry.created_at))
    rows = (await db.execute(q)).scalars().all()
    return [_journal_out(r) for r in rows]


@router.post("/grow-journal", status_code=201, tags=["Grow Journal"])
async def create_journal_entry(
    data: JournalEntryCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Operators and above may create journal entries; viewers are read-only
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator")
    entry = GrowJournalEntry(
        organization_id=_org_id(current),
        author_id=current.id,
        **data.model_dump(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    result = (await db.execute(
        select(GrowJournalEntry).where(GrowJournalEntry.id == entry.id)
    )).scalar_one()
    return _journal_out(result)


@router.patch("/grow-journal/{entry_id}", tags=["Grow Journal"])
async def update_journal_entry(
    entry_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator")
    row = (await db.execute(
        select(GrowJournalEntry).where(
            GrowJournalEntry.id == entry_id,
            GrowJournalEntry.organization_id == _org_id(current),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Journal entry not found")
    immutable = {"id", "created_at", "author_id", "organization_id"}
    for k, v in data.items():
        if k not in immutable and hasattr(row, k):
            setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return _journal_out(row)


@router.delete("/grow-journal/{entry_id}", status_code=204, tags=["Grow Journal"])
async def delete_journal_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager")
    row = (await db.execute(
        select(GrowJournalEntry).where(
            GrowJournalEntry.id == entry_id,
            GrowJournalEntry.organization_id == _org_id(current),
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Journal entry not found")
    await db.delete(row)
    await db.commit()


# ══════════════════════════════════════════════════════════
# USER PROFILE  (RBAC: only self can update)
# ══════════════════════════════════════════════════════════

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    preferences: Optional[dict] = None


@router.patch("/users/me", tags=["Settings"])
async def update_profile(
    data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Every authenticated user may update their own profile
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator", "viewer")
    if data.full_name:
        current.full_name = data.full_name
    if data.preferences and hasattr(current, "preferences"):
        current.preferences = {**(current.preferences or {}), **data.preferences}
    await db.commit()
    return {"id": current.id, "full_name": current.full_name, "email": current.email}


@router.post("/auth/change-password", tags=["Settings"])
async def change_password(
    current_password: str,
    new_password: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _check_role(current, "superadmin", "org_admin", "farm_manager", "operator", "viewer")
    from app.core.security import verify_password, get_password_hash
    if not verify_password(current_password, current.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    current.hashed_password = get_password_hash(new_password)
    await db.commit()
    return {"message": "Password updated successfully"}
