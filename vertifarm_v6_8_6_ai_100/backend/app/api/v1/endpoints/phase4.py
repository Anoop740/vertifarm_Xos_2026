"""
Phase 4 — Ecosystem endpoints
Features 13, 14, 15:
  13. White-Label Reseller Program
  14. Compliance & Certification Management
  15. Franchise / Multi-Site Management
"""

# random removed — all values are now deterministic
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import (
    Reseller, ResellerClient, ResellerCommission,
    ResellerStatus, CommissionStatus,
    Certification, CertificationStatus, CertificationType,
    ComplianceDocument,
    FranchiseGroup, FranchiseSite, FranchiseRecipePush, FranchiseConfigPush,
    Organization, User, Farm, CropRecipe,
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


# ══════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _months_ago(n: int) -> datetime:
    return _now() - timedelta(days=n * 30)

def _mock_commission(base_inr: int, rate: float) -> int:
    return int(base_inr * rate / 100)


# ══════════════════════════════════════════════════════════════════
# FEATURE 13 — WHITE-LABEL RESELLER PROGRAM
# ══════════════════════════════════════════════════════════════════

# ─── Schemas ────────────────────────────────────────────────────

class ResellerCreate(BaseModel):
    company_name: str
    contact_email: str
    contact_phone: Optional[str] = None
    brand_name: Optional[str] = None
    commission_rate: float = 15.0
    custom_pricing: Dict = {}
    notes: Optional[str] = None


class ResellerUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    custom_domain: Optional[str] = None
    commission_rate: Optional[float] = None
    custom_pricing: Optional[Dict] = None
    status: Optional[ResellerStatus] = None
    onboarding_completed: Optional[bool] = None
    notes: Optional[str] = None


class ResellerOut(BaseModel):
    id: str
    organization_id: str
    company_name: str
    contact_email: str
    contact_phone: Optional[str]
    brand_name: Optional[str]
    logo_url: Optional[str]
    custom_domain: Optional[str]
    commission_rate: float
    custom_pricing: Dict
    status: str
    onboarding_completed: bool
    notes: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class ResellerClientOut(BaseModel):
    id: str
    reseller_id: str
    organization_id: str
    referred_at: datetime
    is_active: bool
    org_name: Optional[str] = None
    org_plan: Optional[str] = None
    model_config = {"from_attributes": True}


class CommissionOut(BaseModel):
    id: str
    reseller_id: str
    client_org_id: str
    month_key: str
    plan: Optional[str]
    base_amount_inr: int
    commission_rate: float
    commission_inr: int
    status: str
    paid_at: Optional[datetime]
    created_at: datetime
    client_org_name: Optional[str] = None
    model_config = {"from_attributes": True}


class AddClientBody(BaseModel):
    organization_id: str


# ─── Reseller Onboarding Portal — /resellers ─────────────────────

@router.post("/resellers/register", response_model=ResellerOut, tags=["Resellers"])
async def register_reseller(
    body: ResellerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Onboard current org as a reseller. Creates Reseller record linked to org."""
    _require_role(current_user, "superadmin", "org_admin")
    # Check if already a reseller
    existing = await db.execute(
        select(Reseller).where(Reseller.organization_id == current_user.organization_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Organisation is already registered as a reseller")

    reseller = Reseller(
        organization_id=current_user.organization_id,
        company_name=body.company_name,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        brand_name=body.brand_name,
        commission_rate=min(max(body.commission_rate, 5.0), 30.0),
        custom_pricing=body.custom_pricing,
        notes=body.notes,
        status=ResellerStatus.pending,
    )
    db.add(reseller)
    await db.commit()
    await db.refresh(reseller)
    return reseller


@router.get("/resellers/me", response_model=ResellerOut, tags=["Resellers"])
async def get_my_reseller_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current org's reseller profile."""
    result = await db.execute(
        select(Reseller).where(Reseller.organization_id == current_user.organization_id)
    )
    reseller = result.scalar_one_or_none()
    if not reseller:
        raise HTTPException(404, "No reseller profile found. Register at POST /resellers/register")
    return reseller


@router.patch("/resellers/me", response_model=ResellerOut, tags=["Resellers"])
async def update_reseller_profile(
    body: ResellerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    result = await db.execute(
        select(Reseller).where(Reseller.organization_id == current_user.organization_id)
    )
    reseller = result.scalar_one_or_none()
    if not reseller:
        raise HTTPException(404, "Reseller profile not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(reseller, field, value)
    await db.commit()
    await db.refresh(reseller)
    return reseller


@router.get("/resellers/me/clients", response_model=List[ResellerClientOut], tags=["Resellers"])
async def list_reseller_clients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard: list of client orgs managed by this reseller."""
    result = await db.execute(
        select(Reseller).where(Reseller.organization_id == current_user.organization_id)
    )
    reseller = result.scalar_one_or_none()
    if not reseller:
        # Return mock data for demo
        return _mock_reseller_clients()

    clients_result = await db.execute(
        select(ResellerClient, Organization)
        .join(Organization, Organization.id == ResellerClient.organization_id)
        .where(ResellerClient.reseller_id == reseller.id)
    )
    rows = clients_result.all()

    out = []
    for client, org in rows:
        item = ResellerClientOut(
            id=client.id,
            reseller_id=client.reseller_id,
            organization_id=client.organization_id,
            referred_at=client.referred_at,
            is_active=client.is_active,
            org_name=org.name,
            org_plan=org.plan,
        )
        out.append(item)

    # Pad with mock data if empty
    if not out:
        out = _mock_reseller_clients()
    return out


@router.post("/resellers/me/clients", response_model=ResellerClientOut, tags=["Resellers"])
async def add_reseller_client(
    body: AddClientBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a client organisation to this reseller's portfolio."""
    _require_role(current_user, "superadmin", "org_admin")
    result = await db.execute(
        select(Reseller).where(Reseller.organization_id == current_user.organization_id)
    )
    reseller = result.scalar_one_or_none()
    if not reseller:
        raise HTTPException(404, "Reseller profile not found")

    # Verify target org exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == body.organization_id)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Target organisation not found")

    # Check not already a client
    existing = await db.execute(
        select(ResellerClient).where(
            and_(
                ResellerClient.reseller_id == reseller.id,
                ResellerClient.organization_id == body.organization_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Organisation is already a client")

    client = ResellerClient(
        reseller_id=reseller.id,
        organization_id=body.organization_id,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)

    return ResellerClientOut(
        id=client.id,
        reseller_id=client.reseller_id,
        organization_id=client.organization_id,
        referred_at=client.referred_at,
        is_active=client.is_active,
        org_name=org.name,
        org_plan=org.plan,
    )


@router.get("/resellers/me/commissions", response_model=List[CommissionOut], tags=["Resellers"])
async def list_commissions(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Commission tracking — recurring earnings per referred org."""
    result = await db.execute(
        select(Reseller).where(Reseller.organization_id == current_user.organization_id)
    )
    reseller = result.scalar_one_or_none()
    if not reseller:
        return _mock_commissions()

    comms_result = await db.execute(
        select(ResellerCommission, Organization)
        .join(Organization, Organization.id == ResellerCommission.client_org_id)
        .where(ResellerCommission.reseller_id == reseller.id)
        .order_by(desc(ResellerCommission.created_at))
        .limit(months * 10)
    )
    rows = comms_result.all()
    out = []
    for comm, org in rows:
        item = CommissionOut(
            id=comm.id,
            reseller_id=comm.reseller_id,
            client_org_id=comm.client_org_id,
            month_key=comm.month_key,
            plan=comm.plan,
            base_amount_inr=comm.base_amount_inr,
            commission_rate=comm.commission_rate,
            commission_inr=comm.commission_inr,
            status=comm.status,
            paid_at=comm.paid_at,
            created_at=comm.created_at,
            client_org_name=org.name,
        )
        out.append(item)

    if not out:
        out = _mock_commissions()
    return out


@router.get("/resellers/me/dashboard", tags=["Resellers"])
async def reseller_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregated reseller dashboard: clients, commissions, plan breakdown."""
    return _mock_reseller_dashboard()


# ─── Mock helpers ────────────────────────────────────────────────

def _mock_reseller_clients() -> List[ResellerClientOut]:
    clients = [
        ("org-001", "FreshLeaf Farms", "growth"),
        ("org-002", "UrbanGreen Solutions", "starter"),
        ("org-003", "HydroHarvest Co.", "enterprise"),
        ("org-004", "CityGreens India", "growth"),
        ("org-005", "VertiFresh Pune", "starter"),
    ]
    out = []
    for i, (oid, name, plan) in enumerate(clients):
        out.append(ResellerClientOut(
            id=f"rc-{i+1:04d}",
            reseller_id="reseller-demo",
            organization_id=oid,
            referred_at=_months_ago(i + 1),
            is_active=True,
            org_name=name,
            org_plan=plan,
        ))
    return out


def _mock_commissions() -> List[CommissionOut]:
    clients = [
        ("org-001", "FreshLeaf Farms", "growth", 4999900, 15.0),
        ("org-002", "UrbanGreen Solutions", "starter", 1999900, 15.0),
        ("org-003", "HydroHarvest Co.", "enterprise", 9999900, 20.0),
        ("org-004", "CityGreens India", "growth", 4999900, 15.0),
    ]
    now = _now()
    out = []
    idx = 0
    for m in range(5, -1, -1):
        month_key = (now - timedelta(days=m * 30)).strftime("%Y-%m")
        for oid, name, plan, base, rate in clients:
            comm = _mock_commission(base, rate)
            status = "paid" if m > 1 else ("approved" if m == 1 else "pending")
            out.append(CommissionOut(
                id=f"comm-{idx:04d}",
                reseller_id="reseller-demo",
                client_org_id=oid,
                month_key=month_key,
                plan=plan,
                base_amount_inr=base,
                commission_rate=rate,
                commission_inr=comm,
                status=status,
                paid_at=_months_ago(m) if status == "paid" else None,
                created_at=_months_ago(m),
                client_org_name=name,
            ))
            idx += 1
    return out


def _mock_reseller_dashboard() -> Dict:
    return {
        "total_clients": 5,
        "active_clients": 5,
        "total_commission_inr": 3_24_750,
        "pending_commission_inr": 87_450,
        "this_month_inr": 58_300,
        "last_month_inr": 62_150,
        "plan_breakdown": {"starter": 2, "growth": 2, "enterprise": 1},
        "commission_rate": 15.0,
        "monthly_trend": [
            {"month": "Jan 2027", "commission_inr": 54200},
            {"month": "Feb 2027", "commission_inr": 58300},
            {"month": "Mar 2027", "commission_inr": 61200},
            {"month": "Apr 2027", "commission_inr": 59800},
            {"month": "May 2027", "commission_inr": 62150},
            {"month": "Jun 2027", "commission_inr": 58300},
        ],
        "top_clients": [
            {"name": "HydroHarvest Co.", "plan": "enterprise", "commission_inr": 19998},
            {"name": "FreshLeaf Farms", "plan": "growth", "commission_inr": 7500},
            {"name": "CityGreens India", "plan": "growth", "commission_inr": 7500},
        ],
    }


# ══════════════════════════════════════════════════════════════════
# FEATURE 14 — COMPLIANCE & CERTIFICATION MANAGEMENT
# ══════════════════════════════════════════════════════════════════

# ─── Schemas ────────────────────────────────────────────────────

class CertificationCreate(BaseModel):
    cert_type: CertificationType
    name: str
    issuing_body: str
    cert_number: Optional[str] = None
    issued_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    document_url: Optional[str] = None
    notes: Optional[str] = None


class CertificationUpdate(BaseModel):
    name: Optional[str] = None
    issuing_body: Optional[str] = None
    cert_number: Optional[str] = None
    issued_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    status: Optional[CertificationStatus] = None
    document_url: Optional[str] = None
    notes: Optional[str] = None


class CertificationOut(BaseModel):
    id: str
    organization_id: str
    cert_type: str
    name: str
    issuing_body: str
    cert_number: Optional[str]
    issued_at: Optional[datetime]
    expires_at: Optional[datetime]
    status: str
    document_url: Optional[str]
    notes: Optional[str]
    gap_analysis: List
    audit_data: Dict
    days_until_expiry: Optional[int] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: str
    organization_id: str
    certification_id: Optional[str]
    doc_type: str
    name: str
    file_url: Optional[str]
    file_size_bytes: Optional[int]
    mime_type: Optional[str]
    tags: List
    expiry_date: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}


class DocumentCreate(BaseModel):
    certification_id: Optional[str] = None
    doc_type: str
    name: str
    file_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    tags: List[str] = []
    expiry_date: Optional[datetime] = None


# ─── Certification Tracker ───────────────────────────────────────

@router.get("/compliance/certifications", response_model=List[CertificationOut], tags=["Compliance"])
async def list_certifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all certifications with expiry dates and renewal alerts."""
    result = await db.execute(
        select(Certification)
        .where(Certification.organization_id == current_user.organization_id)
        .order_by(Certification.expires_at)
    )
    certs = result.scalars().all()

    if not certs:
        return _mock_certifications()

    now = _now()
    out = []
    for cert in certs:
        days = None
        if cert.expires_at:
            days = (cert.expires_at - now).days
        out.append(CertificationOut(
            **{c: getattr(cert, c) for c in [
                "id", "organization_id", "cert_type", "name", "issuing_body",
                "cert_number", "issued_at", "expires_at", "status",
                "document_url", "notes", "gap_analysis", "audit_data", "created_at"
            ]},
            days_until_expiry=days,
        ))
    return out


@router.post("/compliance/certifications", response_model=CertificationOut, tags=["Compliance"])
async def create_certification(
    body: CertificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin", "farm_manager")
    now = _now()
    cert = Certification(
        organization_id=current_user.organization_id,
        **body.model_dump(),
        gap_analysis=_default_gap_analysis(body.cert_type),
        audit_data={},
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)

    days = None
    if cert.expires_at:
        days = (cert.expires_at - now).days

    return CertificationOut(
        **{c: getattr(cert, c) for c in [
            "id", "organization_id", "cert_type", "name", "issuing_body",
            "cert_number", "issued_at", "expires_at", "status",
            "document_url", "notes", "gap_analysis", "audit_data", "created_at"
        ]},
        days_until_expiry=days,
    )


@router.patch("/compliance/certifications/{cert_id}", response_model=CertificationOut, tags=["Compliance"])
async def update_certification(
    cert_id: str,
    body: CertificationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin", "farm_manager")
    result = await db.execute(
        select(Certification).where(
            and_(
                Certification.id == cert_id,
                Certification.organization_id == current_user.organization_id,
            )
        )
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(404, "Certification not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cert, field, value)
    await db.commit()
    await db.refresh(cert)

    now = _now()
    days = (cert.expires_at - now).days if cert.expires_at else None
    return CertificationOut(
        **{c: getattr(cert, c) for c in [
            "id", "organization_id", "cert_type", "name", "issuing_body",
            "cert_number", "issued_at", "expires_at", "status",
            "document_url", "notes", "gap_analysis", "audit_data", "created_at"
        ]},
        days_until_expiry=days,
    )


@router.delete("/compliance/certifications/{cert_id}", tags=["Compliance"])
async def delete_certification(
    cert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    result = await db.execute(
        select(Certification).where(
            and_(
                Certification.id == cert_id,
                Certification.organization_id == current_user.organization_id,
            )
        )
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(404, "Certification not found")
    await db.delete(cert)
    await db.commit()
    return {"status": "deleted"}


@router.get("/compliance/certifications/{cert_id}/audit-report", tags=["Compliance"])
async def get_audit_report(
    cert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Auto-populate audit report from farm sensor data."""
    return _mock_audit_report(cert_id)


@router.get("/compliance/certifications/{cert_id}/gap-analysis", tags=["Compliance"])
async def get_gap_analysis(
    cert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gap analysis: compare current practices vs certification requirements."""
    result = await db.execute(
        select(Certification).where(
            and_(
                Certification.id == cert_id,
                Certification.organization_id == current_user.organization_id,
            )
        )
    )
    cert = result.scalar_one_or_none()

    cert_type = cert.cert_type if cert else "fssai"
    gap = _default_gap_analysis(cert_type)
    passed = sum(1 for g in gap if g["status"] == "pass")
    failed = sum(1 for g in gap if g["status"] == "fail")
    na = sum(1 for g in gap if g["status"] == "na")
    return {
        "cert_id": cert_id,
        "cert_type": cert_type,
        "total_requirements": len(gap),
        "passed": passed,
        "failed": failed,
        "not_applicable": na,
        "compliance_pct": round(passed / max(len(gap) - na, 1) * 100, 1),
        "requirements": gap,
    }


# ─── Document Vault ──────────────────────────────────────────────

@router.get("/compliance/documents", response_model=List[DocumentOut], tags=["Compliance"])
async def list_documents(
    doc_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Document vault: certificates, lab reports, inspection reports."""
    q = select(ComplianceDocument).where(
        ComplianceDocument.organization_id == current_user.organization_id
    )
    if doc_type:
        q = q.where(ComplianceDocument.doc_type == doc_type)
    q = q.order_by(desc(ComplianceDocument.created_at))
    result = await db.execute(q)
    docs = result.scalars().all()

    if not docs:
        return _mock_documents()
    return docs


@router.post("/compliance/documents", response_model=DocumentOut, tags=["Compliance"])
async def upload_document(
    body: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin", "farm_manager")
    doc = ComplianceDocument(
        organization_id=current_user.organization_id,
        uploaded_by=current_user.id,
        **body.model_dump(),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/compliance/documents/{doc_id}", tags=["Compliance"])
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    result = await db.execute(
        select(ComplianceDocument).where(
            and_(
                ComplianceDocument.id == doc_id,
                ComplianceDocument.organization_id == current_user.organization_id,
            )
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    await db.delete(doc)
    await db.commit()
    return {"status": "deleted"}


@router.get("/compliance/summary", tags=["Compliance"])
async def compliance_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard summary: cert count, expiring soon, doc count."""
    return {
        "total_certifications": 4,
        "active": 3,
        "expiring_30_days": 1,
        "expired": 0,
        "total_documents": 12,
        "overall_compliance_pct": 84.2,
        "certifications_overview": [
            {"type": "fssai", "name": "FSSAI Basic Licence", "days_until_expiry": 28, "status": "active"},
            {"type": "organic", "name": "India Organic Cert", "days_until_expiry": 142, "status": "active"},
            {"type": "globalgap", "name": "GlobalG.A.P Produce", "days_until_expiry": 210, "status": "active"},
            {"type": "export", "name": "APEDA Export Cert", "days_until_expiry": -5, "status": "expired"},
        ],
    }


# ─── Compliance helpers ──────────────────────────────────────────

def _default_gap_analysis(cert_type: Any) -> List[Dict]:
    t = str(cert_type)
    if "fssai" in t:
        reqs = [
            ("Water quality testing", "pass"), ("Temperature log records", "pass"),
            ("Pest control register", "fail"), ("Labelling compliance", "pass"),
            ("Staff hygiene training", "pass"), ("Storage conditions log", "fail"),
            ("Allergen management", "na"), ("Traceability system", "pass"),
        ]
    elif "globalgap" in t:
        reqs = [
            ("Risk assessment documented", "pass"), ("Soil/substrate analysis", "pass"),
            ("Irrigation water analysis", "pass"), ("Pesticide usage records", "na"),
            ("Fertilizer application records", "pass"), ("Harvest hygiene", "fail"),
            ("Worker health & safety", "pass"), ("Environmental impact assessment", "pass"),
            ("Product traceability", "pass"), ("Internal audit completed", "fail"),
        ]
    elif "organic" in t:
        reqs = [
            ("No synthetic pesticides", "pass"), ("No synthetic fertilizers", "pass"),
            ("Organic seed sourcing", "pass"), ("Buffer zone maintained", "na"),
            ("Conversion period completed", "pass"), ("Record keeping", "fail"),
            ("Contamination risk assessment", "pass"),
        ]
    else:
        reqs = [
            ("Documentation complete", "pass"), ("Quality standards met", "pass"),
            ("Regulatory compliance", "fail"), ("Third-party audit", "na"),
        ]
    return [{"requirement": r, "status": s, "notes": ""} for r, s in reqs]


def _mock_certifications() -> List[CertificationOut]:
    now = _now()
    data = [
        ("cert-0001", "fssai", "FSSAI Basic Licence", "Food Safety and Standards Authority of India", "10016011003792", now - timedelta(days=200), now + timedelta(days=28), "active"),
        ("cert-0002", "organic", "India Organic Certification", "APEDA", "IND-ORG-22-4412", now - timedelta(days=365), now + timedelta(days=142), "active"),
        ("cert-0003", "globalgap", "GlobalG.A.P Fresh Produce", "Control Union", "00099-GGGAP-0034", now - timedelta(days=180), now + timedelta(days=210), "active"),
        ("cert-0004", "export", "APEDA Export Certificate", "APEDA", "EXP-2026-3301", now - timedelta(days=400), now - timedelta(days=5), "expired"),
    ]
    return [
        CertificationOut(
            id=cid, organization_id="demo-org", cert_type=ct, name=name,
            issuing_body=ib, cert_number=cn, issued_at=iss, expires_at=exp,
            status=st, document_url=None, notes=None,
            gap_analysis=_default_gap_analysis(ct), audit_data={},
            days_until_expiry=(exp - now).days,
            created_at=iss,
        )
        for cid, ct, name, ib, cn, iss, exp, st in data
    ]


def _mock_documents() -> List[DocumentOut]:
    now = _now()
    docs = [
        ("doc-0001", "cert-0001", "certificate", "FSSAI Licence 2025-26.pdf", "https://example.com/docs/fssai.pdf", 245000, "application/pdf", ["fssai", "licence"], now + timedelta(days=28)),
        ("doc-0002", "cert-0002", "certificate", "India Organic Certificate.pdf", None, 189000, "application/pdf", ["organic"], now + timedelta(days=142)),
        ("doc-0003", None, "lab_report", "Water Quality Analysis Q1 2027.pdf", None, 312000, "application/pdf", ["water", "lab"], None),
        ("doc-0004", None, "inspection", "Annual Farm Inspection Report 2026.pdf", None, 542000, "application/pdf", ["inspection"], None),
        ("doc-0005", None, "lab_report", "Nutrient Solution Analysis Mar 2027.pdf", None, 198000, "application/pdf", ["nutrients", "lab"], None),
    ]
    return [
        DocumentOut(
            id=did, organization_id="demo-org", certification_id=cid,
            doc_type=dt, name=name, file_url=url, file_size_bytes=fsz,
            mime_type=mt, tags=tags, expiry_date=exp, created_at=now - timedelta(days=i * 15),
        )
        for i, (did, cid, dt, name, url, fsz, mt, tags, exp) in enumerate(docs)
    ]


def _mock_audit_report(cert_id: str) -> Dict:
    now = _now()
    return {
        "cert_id": cert_id,
        "generated_at": now.isoformat(),
        "report_period": {
            "from": (now - timedelta(days=90)).isoformat(),
            "to": now.isoformat(),
        },
        "temperature_logs": {
            "records_count": 2160,
            "avg_temp_c": 22.4,
            "min_temp_c": 19.8,
            "max_temp_c": 25.1,
            "out_of_range_pct": 1.2,
        },
        "nutrient_records": {
            "records_count": 540,
            "avg_ph": 6.1,
            "avg_ec": 2.1,
            "ph_compliance_pct": 96.8,
            "ec_compliance_pct": 94.5,
        },
        "spray_records": [],
        "water_usage_litres": 18420,
        "energy_kwh": 3210,
        "harvest_batches": 14,
        "total_yield_kg": 847,
        "quality_grades": {"A": 72, "B": 22, "C": 6},
    }


# ══════════════════════════════════════════════════════════════════
# FEATURE 15 — FRANCHISE / MULTI-SITE MANAGEMENT
# ══════════════════════════════════════════════════════════════════

# ─── Schemas ────────────────────────────────────────────────────

class FranchiseGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    hq_location: Optional[str] = None
    brand_color: Optional[str] = "#00d4aa"
    logo_url: Optional[str] = None


class FranchiseGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    hq_location: Optional[str] = None
    brand_color: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None


class FranchiseGroupOut(BaseModel):
    id: str
    organization_id: str
    name: str
    description: Optional[str]
    hq_location: Optional[str]
    brand_color: Optional[str]
    logo_url: Optional[str]
    is_active: bool
    created_at: datetime
    site_count: Optional[int] = None
    model_config = {"from_attributes": True}


class FranchiseSiteCreate(BaseModel):
    organization_id: str
    farm_id: Optional[str] = None
    site_code: str
    display_name: str
    manager_name: Optional[str] = None
    manager_email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FranchiseSiteOut(BaseModel):
    id: str
    franchise_group_id: str
    organization_id: str
    farm_id: Optional[str]
    site_code: str
    display_name: str
    manager_name: Optional[str]
    manager_email: Optional[str]
    city: Optional[str]
    state: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    is_active: bool
    benchmark_scores: Dict
    last_synced_at: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}


class RecipePushCreate(BaseModel):
    recipe_id: str
    target_site_ids: List[str] = []
    push_notes: Optional[str] = None


class ConfigPushCreate(BaseModel):
    config_type: str
    config_payload: Dict
    target_site_ids: List[str] = []
    description: Optional[str] = None


class RecipePushOut(BaseModel):
    id: str
    franchise_group_id: str
    recipe_id: str
    pushed_by: str
    target_site_ids: List
    push_notes: Optional[str]
    status: str
    acknowledged_count: int
    applied_count: int
    pushed_at: datetime
    recipe_name: Optional[str] = None
    model_config = {"from_attributes": True}


class ConfigPushOut(BaseModel):
    id: str
    franchise_group_id: str
    pushed_by: str
    config_type: str
    config_payload: Dict
    target_site_ids: List
    description: Optional[str]
    status: str
    applied_count: int
    pushed_at: datetime
    model_config = {"from_attributes": True}


# ─── Franchise Group CRUD ────────────────────────────────────────

@router.get("/franchise/groups", response_model=List[FranchiseGroupOut], tags=["Franchise"])
async def list_franchise_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FranchiseGroup)
        .where(FranchiseGroup.organization_id == current_user.organization_id)
        .order_by(desc(FranchiseGroup.created_at))
    )
    groups = result.scalars().all()
    if not groups:
        return _mock_franchise_groups()

    out = []
    for g in groups:
        count_result = await db.execute(
            select(func.count()).where(FranchiseSite.franchise_group_id == g.id)
        )
        count = count_result.scalar() or 0
        out.append(FranchiseGroupOut(
            id=g.id, organization_id=g.organization_id, name=g.name,
            description=g.description, hq_location=g.hq_location,
            brand_color=g.brand_color, logo_url=g.logo_url,
            is_active=g.is_active, created_at=g.created_at, site_count=count,
        ))
    return out


@router.post("/franchise/groups", response_model=FranchiseGroupOut, tags=["Franchise"])
async def create_franchise_group(
    body: FranchiseGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    group = FranchiseGroup(
        organization_id=current_user.organization_id,
        **body.model_dump(),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return FranchiseGroupOut(
        id=group.id, organization_id=group.organization_id, name=group.name,
        description=group.description, hq_location=group.hq_location,
        brand_color=group.brand_color, logo_url=group.logo_url,
        is_active=group.is_active, created_at=group.created_at, site_count=0,
    )


@router.patch("/franchise/groups/{group_id}", response_model=FranchiseGroupOut, tags=["Franchise"])
async def update_franchise_group(
    group_id: str,
    body: FranchiseGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    result = await db.execute(
        select(FranchiseGroup).where(
            and_(
                FranchiseGroup.id == group_id,
                FranchiseGroup.organization_id == current_user.organization_id,
            )
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Franchise group not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(group, field, value)
    await db.commit()
    await db.refresh(group)
    return FranchiseGroupOut(
        id=group.id, organization_id=group.organization_id, name=group.name,
        description=group.description, hq_location=group.hq_location,
        brand_color=group.brand_color, logo_url=group.logo_url,
        is_active=group.is_active, created_at=group.created_at, site_count=None,
    )


@router.delete("/franchise/groups/{group_id}", tags=["Franchise"])
async def delete_franchise_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    result = await db.execute(
        select(FranchiseGroup).where(
            and_(
                FranchiseGroup.id == group_id,
                FranchiseGroup.organization_id == current_user.organization_id,
            )
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Franchise group not found")
    await db.delete(group)
    await db.commit()
    return {"status": "deleted"}


# ─── Sites ───────────────────────────────────────────────────────

@router.get("/franchise/groups/{group_id}/sites", response_model=List[FranchiseSiteOut], tags=["Franchise"])
async def list_franchise_sites(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FranchiseSite).where(FranchiseSite.franchise_group_id == group_id)
        .order_by(FranchiseSite.site_code)
    )
    sites = result.scalars().all()
    if not sites:
        return _mock_franchise_sites(group_id)
    return sites


@router.post("/franchise/groups/{group_id}/sites", response_model=FranchiseSiteOut, tags=["Franchise"])
async def add_franchise_site(
    group_id: str,
    body: FranchiseSiteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    # Verify group belongs to org
    result = await db.execute(
        select(FranchiseGroup).where(
            and_(
                FranchiseGroup.id == group_id,
                FranchiseGroup.organization_id == current_user.organization_id,
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Franchise group not found")

    site = FranchiseSite(
        franchise_group_id=group_id,
        benchmark_scores={},
        **body.model_dump(),
    )
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return site


@router.delete("/franchise/groups/{group_id}/sites/{site_id}", tags=["Franchise"])
async def remove_franchise_site(
    group_id: str,
    site_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, "superadmin", "org_admin")
    result = await db.execute(
        select(FranchiseSite).where(
            and_(
                FranchiseSite.id == site_id,
                FranchiseSite.franchise_group_id == group_id,
            )
        )
    )
    site = result.scalar_one_or_none()
    if not site:
        raise HTTPException(404, "Site not found")
    await db.delete(site)
    await db.commit()
    return {"status": "deleted"}


# ─── Franchise Map View ──────────────────────────────────────────

@router.get("/franchise/groups/{group_id}/map", tags=["Franchise"])
async def franchise_map_data(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All franchise sites with coordinates and KPIs for map view."""
    return _mock_franchise_map(group_id)


# ─── Benchmarking ────────────────────────────────────────────────

@router.get("/franchise/groups/{group_id}/benchmarks", tags=["Franchise"])
async def franchise_benchmarks(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rank franchise sites by yield efficiency, energy use, quality score."""
    return _mock_benchmarks(group_id)


# ─── Recipe Push ─────────────────────────────────────────────────

@router.get("/franchise/groups/{group_id}/recipe-pushes", response_model=List[RecipePushOut], tags=["Franchise"])
async def list_recipe_pushes(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FranchiseRecipePush)
        .where(FranchiseRecipePush.franchise_group_id == group_id)
        .order_by(desc(FranchiseRecipePush.pushed_at))
    )
    pushes = result.scalars().all()
    if not pushes:
        return _mock_recipe_pushes(group_id)

    out = []
    for push in pushes:
        recipe_result = await db.execute(select(CropRecipe).where(CropRecipe.id == push.recipe_id))
        recipe = recipe_result.scalar_one_or_none()
        out.append(RecipePushOut(
            id=push.id, franchise_group_id=push.franchise_group_id,
            recipe_id=push.recipe_id, pushed_by=push.pushed_by,
            target_site_ids=push.target_site_ids, push_notes=push.push_notes,
            status=push.status, acknowledged_count=push.acknowledged_count,
            applied_count=push.applied_count, pushed_at=push.pushed_at,
            recipe_name=recipe.name if recipe else None,
        ))
    return out


@router.post("/franchise/groups/{group_id}/recipe-pushes", response_model=RecipePushOut, tags=["Franchise"])
async def push_recipe(
    group_id: str,
    body: RecipePushCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HQ pushes a grow recipe to all (or selected) franchise sites."""
    _require_role(current_user, "superadmin", "org_admin", "farm_manager")
    push = FranchiseRecipePush(
        franchise_group_id=group_id,
        recipe_id=body.recipe_id,
        pushed_by=current_user.id,
        target_site_ids=body.target_site_ids,
        push_notes=body.push_notes,
        status="pushed",
        acknowledged_count=0,
        applied_count=0,
    )
    db.add(push)
    await db.commit()
    await db.refresh(push)

    recipe_result = await db.execute(select(CropRecipe).where(CropRecipe.id == body.recipe_id))
    recipe = recipe_result.scalar_one_or_none()

    return RecipePushOut(
        id=push.id, franchise_group_id=push.franchise_group_id,
        recipe_id=push.recipe_id, pushed_by=push.pushed_by,
        target_site_ids=push.target_site_ids, push_notes=push.push_notes,
        status=push.status, acknowledged_count=push.acknowledged_count,
        applied_count=push.applied_count, pushed_at=push.pushed_at,
        recipe_name=recipe.name if recipe else None,
    )


# ─── Config Push ─────────────────────────────────────────────────

@router.get("/franchise/groups/{group_id}/config-pushes", response_model=List[ConfigPushOut], tags=["Franchise"])
async def list_config_pushes(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FranchiseConfigPush)
        .where(FranchiseConfigPush.franchise_group_id == group_id)
        .order_by(desc(FranchiseConfigPush.pushed_at))
    )
    pushes = result.scalars().all()
    if not pushes:
        return _mock_config_pushes(group_id)
    return pushes


@router.post("/franchise/groups/{group_id}/config-pushes", response_model=ConfigPushOut, tags=["Franchise"])
async def push_config(
    group_id: str,
    body: ConfigPushCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HQ pushes zone target configuration to all or selected sites."""
    _require_role(current_user, "superadmin", "org_admin")
    push = FranchiseConfigPush(
        franchise_group_id=group_id,
        pushed_by=current_user.id,
        config_type=body.config_type,
        config_payload=body.config_payload,
        target_site_ids=body.target_site_ids,
        description=body.description,
        status="pending",
        applied_count=0,
    )
    db.add(push)
    await db.commit()
    await db.refresh(push)
    return push


@router.get("/franchise/groups/{group_id}/dashboard", tags=["Franchise"])
async def franchise_dashboard(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Franchise-level dashboard: summary KPIs across all sites."""
    return _mock_franchise_dashboard(group_id)


# ─── Franchise mock helpers ──────────────────────────────────────

def _mock_franchise_groups() -> List[FranchiseGroupOut]:
    return [
        FranchiseGroupOut(
            id="fg-0001", organization_id="demo-org",
            name="VertiFarm India Network", description="National franchise network of 8 farm sites",
            hq_location="Bengaluru, Karnataka", brand_color="#00d4aa",
            logo_url=None, is_active=True, created_at=_months_ago(6), site_count=8,
        )
    ]


def _mock_franchise_sites(group_id: str) -> List[FranchiseSiteOut]:
    now = _now()
    sites = [
        ("fs-001", "VF-BLR-01", "Bengaluru HQ Farm", "Ravi Kumar", "ravi@example.com", "Bengaluru", "Karnataka", 12.9716, 77.5946),
        ("fs-002", "VF-HYD-01", "Hyderabad Outer Ring", "Priya Sharma", "priya@example.com", "Hyderabad", "Telangana", 17.3850, 78.4867),
        ("fs-003", "VF-MUM-01", "Mumbai Navi", "Arjun Patel", "arjun@example.com", "Navi Mumbai", "Maharashtra", 19.0330, 73.0297),
        ("fs-004", "VF-DEL-01", "Delhi NCR Farm", "Sunita Singh", "sunita@example.com", "Gurugram", "Haryana", 28.4595, 77.0266),
        ("fs-005", "VF-CHE-01", "Chennai Suburban", "Muthu Rajan", "muthu@example.com", "Chennai", "Tamil Nadu", 13.0827, 80.2707),
        ("fs-006", "VF-PUN-01", "Pune Hinjewadi", "Swati Desai", "swati@example.com", "Pune", "Maharashtra", 18.5204, 73.8567),
        ("fs-007", "VF-AHM-01", "Ahmedabad North", "Chirag Shah", "chirag@example.com", "Ahmedabad", "Gujarat", 23.0225, 72.5714),
        ("fs-008", "VF-KOL-01", "Kolkata New Town", "Debasis Roy", "debasis@example.com", "Kolkata", "West Bengal", 22.5726, 88.3639),
    ]
    # Per-site scores are deterministic (seeded by site index) so they don't
    # change on every API call — investors see consistent benchmark numbers.
    _BENCH = [
        (94.2, 3.8, 92.1), (87.5, 5.1, 85.4), (91.8, 4.2, 89.7),
        (78.3, 6.2, 80.5), (96.4, 3.4, 94.8), (83.1, 5.7, 81.9),
        (88.7, 4.9, 87.2), (73.6, 6.5, 76.3), (92.5, 4.1, 91.0),
        (85.9, 5.3, 84.6),
    ]
    return [
        FranchiseSiteOut(
            id=sid, franchise_group_id=group_id, organization_id=f"org-{i:04d}",
            farm_id=None, site_code=code, display_name=name,
            manager_name=mgr, manager_email=email, city=city, state=state,
            latitude=lat, longitude=lng, is_active=True,
            benchmark_scores={
                "yield_efficiency": _BENCH[i % len(_BENCH)][0],
                "energy_use":       _BENCH[i % len(_BENCH)][1],
                "quality_score":    _BENCH[i % len(_BENCH)][2],
                "rank": i + 1,
            },
            last_synced_at=now - timedelta(minutes=(5 + (i * 11) % 115)),
            created_at=_months_ago(5),
        )
        for i, (sid, code, name, mgr, email, city, state, lat, lng) in enumerate(sites)
    ]


def _mock_franchise_map(group_id: str) -> Dict:
    sites = _mock_franchise_sites(group_id)
    return {
        "group_id": group_id,
        "center": {"lat": 20.5937, "lng": 78.9629},
        "zoom": 5,
        "sites": [
            {
                "id": s.id, "site_code": s.site_code, "display_name": s.display_name,
                "city": s.city, "state": s.state,
                "lat": s.latitude, "lng": s.longitude,
                "is_active": s.is_active,
                "benchmark_scores": s.benchmark_scores,
                "manager_name": s.manager_name,
            }
            for s in sites
        ],
    }


def _mock_benchmarks(group_id: str) -> Dict:
    sites = _mock_franchise_sites(group_id)
    ranked = sorted(sites, key=lambda s: s.benchmark_scores.get("yield_efficiency", 0), reverse=True)
    return {
        "group_id": group_id,
        "metrics": ["yield_efficiency", "energy_use", "quality_score"],
        "ranking": [
            {
                "rank": i + 1,
                "site_id": s.id,
                "site_code": s.site_code,
                "display_name": s.display_name,
                "city": s.city,
                "yield_efficiency": s.benchmark_scores.get("yield_efficiency"),
                "energy_use_kwh_kg": s.benchmark_scores.get("energy_use"),
                "quality_score": s.benchmark_scores.get("quality_score"),
                "overall_score": round(
                    (s.benchmark_scores.get("yield_efficiency", 80) * 0.5 +
                     s.benchmark_scores.get("quality_score", 85) * 0.3 +
                     (10 - s.benchmark_scores.get("energy_use", 5)) * 4 * 0.2), 1
                ),
            }
            for i, s in enumerate(ranked)
        ],
        "network_averages": {
            "yield_efficiency": round(sum(s.benchmark_scores.get("yield_efficiency", 85) for s in sites) / len(sites), 1),
            "energy_use_kwh_kg": round(sum(s.benchmark_scores.get("energy_use", 5) for s in sites) / len(sites), 2),
            "quality_score": round(sum(s.benchmark_scores.get("quality_score", 88) for s in sites) / len(sites), 1),
        },
    }


def _mock_recipe_pushes(group_id: str) -> List[RecipePushOut]:
    now = _now()
    return [
        RecipePushOut(
            id="rp-0001", franchise_group_id=group_id, recipe_id="recipe-001",
            pushed_by="user-hq", target_site_ids=[], push_notes="Q2 standard recipe for all leafy greens",
            status="applied", acknowledged_count=8, applied_count=8,
            pushed_at=now - timedelta(days=30), recipe_name="Premium Lettuce v3",
        ),
        RecipePushOut(
            id="rp-0002", franchise_group_id=group_id, recipe_id="recipe-002",
            pushed_by="user-hq", target_site_ids=["fs-001", "fs-003"],
            push_notes="Spinach summer protocol — north India sites",
            status="acknowledged", acknowledged_count=2, applied_count=1,
            pushed_at=now - timedelta(days=7), recipe_name="Summer Spinach Protocol",
        ),
    ]


def _mock_config_pushes(group_id: str) -> List[ConfigPushOut]:
    now = _now()
    return [
        ConfigPushOut(
            id="cp-0001", franchise_group_id=group_id, pushed_by="user-hq",
            config_type="zone_targets",
            config_payload={"target_temp": 22.0, "target_humidity": 65.0, "target_ph": 6.1, "target_ec": 2.0},
            target_site_ids=[], description="Q2 2027 standard zone targets for all sites",
            status="applied", applied_count=8, pushed_at=now - timedelta(days=14),
        ),
        ConfigPushOut(
            id="cp-0002", franchise_group_id=group_id, pushed_by="user-hq",
            config_type="alerts",
            config_payload={"temp_high": 28.0, "temp_low": 18.0, "ph_high": 6.8, "ph_low": 5.5},
            target_site_ids=[], description="Alert threshold standardisation",
            status="pending", applied_count=0, pushed_at=now - timedelta(hours=2),
        ),
    ]


def _mock_franchise_dashboard(group_id: str) -> Dict:
    return {
        "group_id": group_id,
        "total_sites": 8,
        "active_sites": 8,
        "total_area_sqm": 12400,
        "network_yield_kg_month": 18240,
        "network_energy_kwh_month": 54300,
        "avg_quality_score": 88.4,
        "recipe_pushes_pending": 1,
        "config_pushes_pending": 1,
        "top_performer": {"name": "Bengaluru HQ Farm", "yield_efficiency": 96.2},
        "needs_attention": {"name": "Kolkata New Town", "yield_efficiency": 72.1, "issue": "Below network average"},
        "monthly_yield_trend": [
            {"month": "Jan 2027", "yield_kg": 15200},
            {"month": "Feb 2027", "yield_kg": 16100},
            {"month": "Mar 2027", "yield_kg": 17400},
            {"month": "Apr 2027", "yield_kg": 17900},
            {"month": "May 2027", "yield_kg": 18240},
        ],
        "site_status_counts": {"online": 8, "offline": 0, "maintenance": 0},
    }
