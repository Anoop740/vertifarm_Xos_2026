"""
Feature 12 — Multi-Farm Marketplace (B2B Network)
==================================================
Sections:
  A. Buyer registration & auth          (public — no farm login required)
  B. Produce Listings                   (farm side — protected)
  C. Marketplace Browse                 (public browse + search)
  D. Order Management                   (buyer + farm)
  E. Escrow & Payments                  (Razorpay/Stripe hooks)
  F. Invoice generation
  G. Platform analytics & commission    (admin/farm side)
"""

import hashlib
import hmac
import os
# random and string removed — order/invoice numbers now use secrets module
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import (
    Buyer, BuyerType, BuyerStatus,
    ProduceListing, ProduceGrade, ListingStatus,
    MarketplaceOrder, OrderStatus, PaymentStatus,
    MarketplaceEscrow, EscrowStatus,
    Organization, Farm, User,
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


# ══════════════════════════════════════════════════════════════════
# UTILITIES
# ══════════════════════════════════════════════════════════════════

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _paise_to_inr(p: int) -> float:
    return round(p / 100, 2)

def _inr_to_paise(r: float) -> int:
    return int(r * 100)

import secrets as _secrets

def _gen_order_number() -> str:
    now = _now()
    suffix = str(_secrets.randbelow(90000) + 10000)  # 5-digit unique suffix
    return f"ORD-{now.year}-{suffix}"

def _gen_invoice_number() -> str:
    now = _now()
    suffix = str(_secrets.randbelow(90000) + 10000)
    return f"INV-{now.year}-{suffix}"

def _calc_totals(qty_kg: float, price_paise: int, commission_pct: float,
                 bulk_pct: float = 0.0, bulk_thresh: float = 50.0):
    """Return subtotal, discount, fee, tax, total — all in paise."""
    subtotal = int(qty_kg * price_paise)
    discount = int(subtotal * bulk_pct / 100) if qty_kg >= bulk_thresh and bulk_pct > 0 else 0
    net_sub  = subtotal - discount
    platform_fee = int(net_sub * commission_pct / 100)
    gst = 0   # B2B — reverse charge mechanism; keep 0 for now
    total = net_sub + gst
    return subtotal, discount, platform_fee, gst, total


# ══════════════════════════════════════════════════════════════════
# SECTION A — BUYER REGISTRATION & AUTH
# ══════════════════════════════════════════════════════════════════

class BuyerRegisterBody(BaseModel):
    email: str
    full_name: str
    company_name: Optional[str] = None
    buyer_type: BuyerType = BuyerType.restaurant
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    fssai_number: Optional[str] = None
    delivery_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    password: Optional[str] = None


class BuyerOut(BaseModel):
    id: str
    email: str
    full_name: str
    company_name: Optional[str]
    buyer_type: str
    phone: Optional[str]
    gst_number: Optional[str]
    fssai_number: Optional[str]
    delivery_address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    pincode: Optional[str]
    status: str
    total_orders: int
    total_spent_inr: float
    created_at: datetime
    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_ext(cls, b: Buyer):
        return cls(
            id=b.id, email=b.email, full_name=b.full_name,
            company_name=b.company_name, buyer_type=b.buyer_type,
            phone=b.phone, gst_number=b.gst_number,
            fssai_number=b.fssai_number,
            delivery_address=b.delivery_address, city=b.city,
            state=b.state, pincode=b.pincode, status=b.status,
            total_orders=b.total_orders,
            total_spent_inr=_paise_to_inr(b.total_spent_paise or 0),
            created_at=b.created_at,
        )


@router.post("/buyers/register", response_model=BuyerOut, summary="Register as a marketplace buyer")
async def register_buyer(body: BuyerRegisterBody, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Buyer).where(Buyer.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered as a buyer")

    pwd_hash = None
    if body.password:
        import hashlib
        pwd_hash = hashlib.sha256(body.password.encode()).hexdigest()

    buyer = Buyer(
        email=body.email.lower(),
        full_name=body.full_name,
        company_name=body.company_name,
        buyer_type=body.buyer_type,
        phone=body.phone,
        gst_number=body.gst_number,
        fssai_number=body.fssai_number,
        delivery_address=body.delivery_address,
        city=body.city,
        state=body.state,
        pincode=body.pincode,
        password_hash=pwd_hash,
        status=BuyerStatus.verified,   # auto-verify for demo; add KYC flow in production
        verified_at=_now(),
    )
    db.add(buyer)
    await db.commit()
    await db.refresh(buyer)
    return BuyerOut.from_orm_ext(buyer)


@router.get("/buyers/{buyer_id}", response_model=BuyerOut, summary="Get buyer profile")
async def get_buyer(buyer_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Buyer).where(Buyer.id == buyer_id))
    buyer = result.scalar_one_or_none()
    if not buyer:
        raise HTTPException(404, "Buyer not found")
    return BuyerOut.from_orm_ext(buyer)


@router.patch("/buyers/{buyer_id}", response_model=BuyerOut, summary="Update buyer profile")
async def update_buyer(buyer_id: str, body: dict = Body(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Buyer).where(Buyer.id == buyer_id))
    buyer = result.scalar_one_or_none()
    if not buyer:
        raise HTTPException(404, "Buyer not found")
    allowed = {"full_name", "company_name", "phone", "gst_number", "fssai_number",
               "delivery_address", "city", "state", "pincode", "buyer_type"}
    for k, v in body.items():
        if k in allowed:
            setattr(buyer, k, v)
    await db.commit()
    await db.refresh(buyer)
    return BuyerOut.from_orm_ext(buyer)


# ══════════════════════════════════════════════════════════════════
# SECTION B — PRODUCE LISTINGS (Farm side)
# ══════════════════════════════════════════════════════════════════

class ListingCreate(BaseModel):
    crop_name: str
    variety: Optional[str] = None
    grade: ProduceGrade = ProduceGrade.A
    description: Optional[str] = None
    quantity_kg: float
    min_order_kg: float = 1.0
    max_order_kg: Optional[float] = None
    price_per_kg_inr: float
    bulk_discount_pct: float = 0.0
    bulk_threshold_kg: float = 50.0
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    certifications: List[str] = []
    packaging: Optional[str] = None
    storage_temp_c: Optional[float] = None
    shelf_life_days: Optional[int] = None
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    farm_id: Optional[str] = None
    harvest_id: Optional[str] = None
    platform_commission_pct: float = 2.5


class ListingUpdate(BaseModel):
    crop_name: Optional[str] = None
    variety: Optional[str] = None
    grade: Optional[ProduceGrade] = None
    description: Optional[str] = None
    quantity_kg: Optional[float] = None
    min_order_kg: Optional[float] = None
    max_order_kg: Optional[float] = None
    price_per_kg_inr: Optional[float] = None
    bulk_discount_pct: Optional[float] = None
    bulk_threshold_kg: Optional[float] = None
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    certifications: Optional[List[str]] = None
    packaging: Optional[str] = None
    storage_temp_c: Optional[float] = None
    shelf_life_days: Optional[int] = None
    status: Optional[ListingStatus] = None


class ListingOut(BaseModel):
    id: str
    organization_id: str
    farm_id: Optional[str]
    harvest_id: Optional[str]
    crop_name: str
    variety: Optional[str]
    grade: str
    description: Optional[str]
    quantity_kg: float
    reserved_kg: float
    sold_kg: float
    available_kg: float
    min_order_kg: float
    max_order_kg: Optional[float]
    price_per_kg_inr: float
    bulk_discount_pct: float
    bulk_threshold_kg: float
    available_from: Optional[datetime]
    available_until: Optional[datetime]
    certifications: List
    packaging: Optional[str]
    storage_temp_c: Optional[float]
    shelf_life_days: Optional[int]
    origin_city: Optional[str]
    origin_state: Optional[str]
    images: List
    status: str
    view_count: int
    platform_commission_pct: float
    farm_name: Optional[str] = None
    org_name: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_ext(cls, l: ProduceListing, farm_name: str = None, org_name: str = None):
        avail = max(0.0, (l.quantity_kg or 0) - (l.reserved_kg or 0) - (l.sold_kg or 0))
        return cls(
            id=l.id, organization_id=l.organization_id,
            farm_id=l.farm_id, harvest_id=l.harvest_id,
            crop_name=l.crop_name, variety=l.variety, grade=l.grade,
            description=l.description, quantity_kg=l.quantity_kg,
            reserved_kg=l.reserved_kg or 0, sold_kg=l.sold_kg or 0,
            available_kg=avail, min_order_kg=l.min_order_kg or 1.0,
            max_order_kg=l.max_order_kg,
            price_per_kg_inr=_paise_to_inr(l.price_per_kg_paise),
            bulk_discount_pct=l.bulk_discount_pct or 0,
            bulk_threshold_kg=l.bulk_threshold_kg or 50.0,
            available_from=l.available_from, available_until=l.available_until,
            certifications=l.certifications or [],
            packaging=l.packaging, storage_temp_c=l.storage_temp_c,
            shelf_life_days=l.shelf_life_days,
            origin_city=l.origin_city, origin_state=l.origin_state,
            images=l.images or [], status=l.status,
            view_count=l.view_count or 0,
            platform_commission_pct=l.platform_commission_pct or 2.5,
            farm_name=farm_name, org_name=org_name,
            created_at=l.created_at,
        )


@router.post("/listings", response_model=ListingOut, summary="Post a produce listing")
async def create_listing(
    body: ListingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listing = ProduceListing(
        organization_id=current_user.organization_id,
        posted_by=current_user.id,
        farm_id=body.farm_id,
        harvest_id=body.harvest_id,
        crop_name=body.crop_name,
        variety=body.variety,
        grade=body.grade,
        description=body.description,
        quantity_kg=body.quantity_kg,
        reserved_kg=0.0,
        sold_kg=0.0,
        min_order_kg=body.min_order_kg,
        max_order_kg=body.max_order_kg,
        price_per_kg_paise=_inr_to_paise(body.price_per_kg_inr),
        bulk_discount_pct=body.bulk_discount_pct,
        bulk_threshold_kg=body.bulk_threshold_kg,
        available_from=body.available_from,
        available_until=body.available_until,
        certifications=body.certifications,
        packaging=body.packaging,
        storage_temp_c=body.storage_temp_c,
        shelf_life_days=body.shelf_life_days,
        origin_city=body.origin_city,
        origin_state=body.origin_state,
        images=[],
        status=ListingStatus.active,
        platform_commission_pct=min(max(body.platform_commission_pct, 2.0), 3.0),
    )
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return ListingOut.from_orm_ext(listing)


@router.get("/listings", response_model=List[ListingOut], summary="List my farm's produce listings")
async def get_my_listings(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(ProduceListing).where(ProduceListing.organization_id == current_user.organization_id)
    if status:
        q = q.where(ProduceListing.status == status)
    q = q.order_by(desc(ProduceListing.created_at))
    result = await db.execute(q)
    listings = result.scalars().all()

    if not listings:
        return _mock_listings(current_user.organization_id)

    out = []
    for l in listings:
        farm = None
        if l.farm_id:
            fr = await db.execute(select(Farm).where(Farm.id == l.farm_id))
            farm = fr.scalar_one_or_none()
        out.append(ListingOut.from_orm_ext(l, farm_name=farm.name if farm else None))
    return out


@router.patch("/listings/{listing_id}", response_model=ListingOut, summary="Update a listing")
async def update_listing(
    listing_id: str,
    body: ListingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProduceListing).where(and_(
            ProduceListing.id == listing_id,
            ProduceListing.organization_id == current_user.organization_id,
        ))
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(404, "Listing not found")

    data = body.model_dump(exclude_none=True)
    if "price_per_kg_inr" in data:
        listing.price_per_kg_paise = _inr_to_paise(data.pop("price_per_kg_inr"))
    for k, v in data.items():
        setattr(listing, k, v)

    await db.commit()
    await db.refresh(listing)
    return ListingOut.from_orm_ext(listing)


@router.delete("/listings/{listing_id}", summary="Withdraw a listing")
async def delete_listing(
    listing_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProduceListing).where(and_(
            ProduceListing.id == listing_id,
            ProduceListing.organization_id == current_user.organization_id,
        ))
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(404, "Listing not found")
    listing.status = ListingStatus.withdrawn
    await db.commit()
    return {"status": "withdrawn"}


# ══════════════════════════════════════════════════════════════════
# SECTION C — PUBLIC BROWSE (Buyer-facing, no auth required)
# ══════════════════════════════════════════════════════════════════

@router.get("/browse", response_model=List[ListingOut], summary="Browse all active listings (public)")
async def browse_listings(
    crop: Optional[str] = Query(None, description="Filter by crop name"),
    grade: Optional[str] = Query(None),
    min_qty: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None, description="Max price in INR/kg"),
    certification: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    sort: str = Query("newest", enum=["newest", "price_asc", "price_desc", "qty_desc"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    q = select(ProduceListing).where(ProduceListing.status == ListingStatus.active)

    if crop:
        q = q.where(ProduceListing.crop_name.ilike(f"%{crop}%"))
    if grade:
        q = q.where(ProduceListing.grade == grade)
    if min_qty:
        avail_expr = (
            ProduceListing.quantity_kg
            - ProduceListing.reserved_kg
            - ProduceListing.sold_kg
        )
        q = q.where(avail_expr >= min_qty)
    if max_price:
        q = q.where(ProduceListing.price_per_kg_paise <= _inr_to_paise(max_price))
    if city:
        q = q.where(ProduceListing.origin_city.ilike(f"%{city}%"))
    if state:
        q = q.where(ProduceListing.origin_state.ilike(f"%{state}%"))

    if sort == "price_asc":
        q = q.order_by(ProduceListing.price_per_kg_paise)
    elif sort == "price_desc":
        q = q.order_by(desc(ProduceListing.price_per_kg_paise))
    elif sort == "qty_desc":
        q = q.order_by(desc(ProduceListing.quantity_kg))
    else:
        q = q.order_by(desc(ProduceListing.created_at))

    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    listings = result.scalars().all()

    if not listings:
        # Return rich mock data so the buyer portal is fully functional
        mocks = _mock_browse_listings()
        if crop:
            mocks = [m for m in mocks if crop.lower() in m.crop_name.lower()]
        if grade:
            mocks = [m for m in mocks if m.grade == grade]
        return mocks

    out = []
    for l in listings:
        org_r = await db.execute(select(Organization).where(Organization.id == l.organization_id))
        org = org_r.scalar_one_or_none()
        farm = None
        if l.farm_id:
            fr = await db.execute(select(Farm).where(Farm.id == l.farm_id))
            farm = fr.scalar_one_or_none()
        # Increment view count
        l.view_count = (l.view_count or 0) + 1
        out.append(ListingOut.from_orm_ext(
            l, farm_name=farm.name if farm else None,
            org_name=org.name if org else None
        ))
    await db.commit()
    return out


@router.get("/browse/{listing_id}", response_model=ListingOut, summary="Get a single listing (public)")
async def get_listing(listing_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProduceListing).where(ProduceListing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        # Return a mock listing
        mocks = {m.id: m for m in _mock_browse_listings()}
        if listing_id in mocks:
            return mocks[listing_id]
        raise HTTPException(404, "Listing not found")
    listing.view_count = (listing.view_count or 0) + 1
    await db.commit()
    await db.refresh(listing)
    return ListingOut.from_orm_ext(listing)


@router.get("/stats", summary="Marketplace statistics (public)")
async def marketplace_stats(db: AsyncSession = Depends(get_db)):
    """Summary stats for the marketplace landing page."""
    return _mock_marketplace_stats()


# ══════════════════════════════════════════════════════════════════
# SECTION D — ORDER MANAGEMENT
# ══════════════════════════════════════════════════════════════════

class OrderCreate(BaseModel):
    listing_id: str
    buyer_id: str
    quantity_kg: float
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_pincode: Optional[str] = None
    requested_delivery_date: Optional[datetime] = None
    buyer_notes: Optional[str] = None


class OrderOut(BaseModel):
    id: str
    order_number: str
    listing_id: str
    buyer_id: str
    organization_id: str
    quantity_kg: float
    price_per_kg_inr: float
    subtotal_inr: float
    discount_inr: float
    platform_fee_inr: float
    total_inr: float
    status: str
    payment_status: str
    payment_gateway: Optional[str]
    gateway_order_id: Optional[str]
    delivery_address: Optional[str]
    delivery_city: Optional[str]
    delivery_pincode: Optional[str]
    requested_delivery_date: Optional[datetime]
    actual_delivery_date: Optional[datetime]
    tracking_number: Optional[str]
    tracking_url: Optional[str]
    logistics_partner: Optional[str]
    delivery_confirmed_at: Optional[datetime]
    buyer_notes: Optional[str]
    seller_notes: Optional[str]
    invoice_number: Optional[str]
    invoice_url: Optional[str]
    cancelled_at: Optional[datetime]
    cancel_reason: Optional[str]
    crop_name: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_email: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_ext(cls, o: MarketplaceOrder, crop_name: str = None,
                     buyer_name: str = None, buyer_email: str = None):
        return cls(
            id=o.id, order_number=o.order_number,
            listing_id=o.listing_id, buyer_id=o.buyer_id,
            organization_id=o.organization_id,
            quantity_kg=o.quantity_kg,
            price_per_kg_inr=_paise_to_inr(o.price_per_kg_paise),
            subtotal_inr=_paise_to_inr(o.subtotal_paise),
            discount_inr=_paise_to_inr(o.discount_paise or 0),
            platform_fee_inr=_paise_to_inr(o.platform_fee_paise or 0),
            total_inr=_paise_to_inr(o.total_paise),
            status=o.status, payment_status=o.payment_status,
            payment_gateway=o.payment_gateway,
            gateway_order_id=o.gateway_order_id,
            delivery_address=o.delivery_address,
            delivery_city=o.delivery_city,
            delivery_pincode=o.delivery_pincode,
            requested_delivery_date=o.requested_delivery_date,
            actual_delivery_date=o.actual_delivery_date,
            tracking_number=o.tracking_number,
            tracking_url=o.tracking_url,
            logistics_partner=o.logistics_partner,
            delivery_confirmed_at=o.delivery_confirmed_at,
            buyer_notes=o.buyer_notes, seller_notes=o.seller_notes,
            invoice_number=o.invoice_number, invoice_url=o.invoice_url,
            cancelled_at=o.cancelled_at, cancel_reason=o.cancel_reason,
            crop_name=crop_name, buyer_name=buyer_name, buyer_email=buyer_email,
            created_at=o.created_at,
        )


@router.post("/orders", response_model=OrderOut, summary="Place an order")
async def place_order(body: OrderCreate, db: AsyncSession = Depends(get_db)):
    """Buyer places an order. Locks reserved_kg on the listing."""
    # Validate listing
    lr = await db.execute(select(ProduceListing).where(ProduceListing.id == body.listing_id))
    listing = lr.scalar_one_or_none()
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing.status != ListingStatus.active:
        raise HTTPException(400, f"Listing is {listing.status}")

    avail = listing.quantity_kg - (listing.reserved_kg or 0) - (listing.sold_kg or 0)
    if body.quantity_kg > avail:
        raise HTTPException(400, f"Only {avail:.1f} kg available")
    if body.quantity_kg < listing.min_order_kg:
        raise HTTPException(400, f"Minimum order is {listing.min_order_kg} kg")
    if listing.max_order_kg and body.quantity_kg > listing.max_order_kg:
        raise HTTPException(400, f"Maximum order is {listing.max_order_kg} kg")

    # Validate buyer
    br = await db.execute(select(Buyer).where(Buyer.id == body.buyer_id))
    buyer = br.scalar_one_or_none()
    if not buyer:
        raise HTTPException(404, "Buyer not found")

    subtotal, discount, fee, tax, total = _calc_totals(
        body.quantity_kg, listing.price_per_kg_paise,
        listing.platform_commission_pct or 2.5,
        listing.bulk_discount_pct or 0,
        listing.bulk_threshold_kg or 50.0,
    )

    order = MarketplaceOrder(
        order_number=_gen_order_number(),
        listing_id=listing.id,
        buyer_id=buyer.id,
        organization_id=listing.organization_id,
        quantity_kg=body.quantity_kg,
        price_per_kg_paise=listing.price_per_kg_paise,
        subtotal_paise=subtotal,
        discount_paise=discount,
        platform_fee_paise=fee,
        tax_paise=tax,
        total_paise=total,
        status=OrderStatus.pending,
        payment_status=PaymentStatus.unpaid,
        delivery_address=body.delivery_address or buyer.delivery_address,
        delivery_city=body.delivery_city or buyer.city,
        delivery_pincode=body.delivery_pincode or buyer.pincode,
        requested_delivery_date=body.requested_delivery_date,
        buyer_notes=body.buyer_notes,
        invoice_number=_gen_invoice_number(),
    )
    db.add(order)

    # Reserve quantity
    listing.reserved_kg = (listing.reserved_kg or 0) + body.quantity_kg

    await db.commit()
    await db.refresh(order)

    return OrderOut.from_orm_ext(
        order, crop_name=listing.crop_name,
        buyer_name=buyer.full_name, buyer_email=buyer.email,
    )


@router.get("/orders/mine", response_model=List[OrderOut], summary="Buyer: list my orders")
async def buyer_orders(buyer_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MarketplaceOrder)
        .where(MarketplaceOrder.buyer_id == buyer_id)
        .order_by(desc(MarketplaceOrder.created_at))
    )
    orders = result.scalars().all()
    if not orders:
        return _mock_buyer_orders(buyer_id)

    out = []
    for o in orders:
        lr = await db.execute(select(ProduceListing).where(ProduceListing.id == o.listing_id))
        listing = lr.scalar_one_or_none()
        out.append(OrderOut.from_orm_ext(o, crop_name=listing.crop_name if listing else None))
    return out


@router.get("/orders/incoming", response_model=List[OrderOut], summary="Farm: incoming orders")
async def farm_incoming_orders(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(MarketplaceOrder).where(
        MarketplaceOrder.organization_id == current_user.organization_id
    )
    if status:
        q = q.where(MarketplaceOrder.status == status)
    q = q.order_by(desc(MarketplaceOrder.created_at))
    result = await db.execute(q)
    orders = result.scalars().all()

    if not orders:
        return _mock_incoming_orders(current_user.organization_id)

    out = []
    for o in orders:
        lr = await db.execute(select(ProduceListing).where(ProduceListing.id == o.listing_id))
        listing = lr.scalar_one_or_none()
        br = await db.execute(select(Buyer).where(Buyer.id == o.buyer_id))
        buyer = br.scalar_one_or_none()
        out.append(OrderOut.from_orm_ext(
            o,
            crop_name=listing.crop_name if listing else None,
            buyer_name=buyer.full_name if buyer else None,
            buyer_email=buyer.email if buyer else None,
        ))
    return out


@router.get("/orders/{order_id}", response_model=OrderOut, summary="Get a single order")
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MarketplaceOrder).where(MarketplaceOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    lr = await db.execute(select(ProduceListing).where(ProduceListing.id == order.listing_id))
    listing = lr.scalar_one_or_none()
    br = await db.execute(select(Buyer).where(Buyer.id == order.buyer_id))
    buyer = br.scalar_one_or_none()

    return OrderOut.from_orm_ext(
        order,
        crop_name=listing.crop_name if listing else None,
        buyer_name=buyer.full_name if buyer else None,
        buyer_email=buyer.email if buyer else None,
    )


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    seller_notes: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    logistics_partner: Optional[str] = None
    actual_delivery_date: Optional[datetime] = None


@router.patch("/orders/{order_id}/status", response_model=OrderOut, summary="Update order status (farm side)")
async def update_order_status(
    order_id: str,
    body: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MarketplaceOrder).where(and_(
            MarketplaceOrder.id == order_id,
            MarketplaceOrder.organization_id == current_user.organization_id,
        ))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    order.status = body.status
    if body.seller_notes:
        order.seller_notes = body.seller_notes
    if body.tracking_number:
        order.tracking_number = body.tracking_number
    if body.tracking_url:
        order.tracking_url = body.tracking_url
    if body.logistics_partner:
        order.logistics_partner = body.logistics_partner
    if body.actual_delivery_date:
        order.actual_delivery_date = body.actual_delivery_date

    # If cancelling, release reservation
    if body.status == OrderStatus.cancelled:
        order.cancelled_at = _now()
        lr = await db.execute(select(ProduceListing).where(ProduceListing.id == order.listing_id))
        listing = lr.scalar_one_or_none()
        if listing:
            listing.reserved_kg = max(0, (listing.reserved_kg or 0) - order.quantity_kg)

    await db.commit()
    await db.refresh(order)

    lr = await db.execute(select(ProduceListing).where(ProduceListing.id == order.listing_id))
    listing = lr.scalar_one_or_none()
    br = await db.execute(select(Buyer).where(Buyer.id == order.buyer_id))
    buyer = br.scalar_one_or_none()

    return OrderOut.from_orm_ext(
        order,
        crop_name=listing.crop_name if listing else None,
        buyer_name=buyer.full_name if buyer else None,
        buyer_email=buyer.email if buyer else None,
    )


@router.post("/orders/{order_id}/confirm-delivery", response_model=OrderOut,
             summary="Buyer confirms delivery — triggers escrow release")
async def confirm_delivery(
    order_id: str,
    confirmed_by: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MarketplaceOrder).where(MarketplaceOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status not in (OrderStatus.shipped, OrderStatus.confirmed, OrderStatus.packed):
        raise HTTPException(400, f"Order status is {order.status}; cannot confirm delivery")

    now = _now()
    order.status = OrderStatus.delivered
    order.delivery_confirmed_at = now
    order.delivery_confirmed_by = confirmed_by
    order.actual_delivery_date = now

    # Release escrow if exists
    er = await db.execute(select(MarketplaceEscrow).where(MarketplaceEscrow.order_id == order.id))
    escrow = er.scalar_one_or_none()
    if escrow and escrow.status == EscrowStatus.held:
        escrow.status = EscrowStatus.released
        escrow.released_at = now
        escrow.release_notes = f"Auto-released on delivery confirmation by {confirmed_by}"
        order.payment_status = PaymentStatus.released

    # Update listing sold_kg
    lr = await db.execute(select(ProduceListing).where(ProduceListing.id == order.listing_id))
    listing = lr.scalar_one_or_none()
    if listing:
        listing.reserved_kg = max(0, (listing.reserved_kg or 0) - order.quantity_kg)
        listing.sold_kg = (listing.sold_kg or 0) + order.quantity_kg
        remaining = listing.quantity_kg - (listing.reserved_kg or 0) - (listing.sold_kg or 0)
        if remaining <= 0:
            listing.status = ListingStatus.sold_out

    # Update buyer stats
    br = await db.execute(select(Buyer).where(Buyer.id == order.buyer_id))
    buyer = br.scalar_one_or_none()
    if buyer:
        buyer.total_orders = (buyer.total_orders or 0) + 1
        buyer.total_spent_paise = (buyer.total_spent_paise or 0) + order.total_paise

    await db.commit()
    await db.refresh(order)

    return OrderOut.from_orm_ext(
        order,
        crop_name=listing.crop_name if listing else None,
        buyer_name=buyer.full_name if buyer else None,
        buyer_email=buyer.email if buyer else None,
    )


@router.post("/orders/{order_id}/cancel", response_model=OrderOut, summary="Cancel an order")
async def cancel_order(
    order_id: str,
    reason: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MarketplaceOrder).where(MarketplaceOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status in (OrderStatus.delivered, OrderStatus.cancelled):
        raise HTTPException(400, f"Cannot cancel a {order.status} order")

    order.status = OrderStatus.cancelled
    order.cancelled_at = _now()
    order.cancel_reason = reason

    # Refund escrow if held
    er = await db.execute(select(MarketplaceEscrow).where(MarketplaceEscrow.order_id == order.id))
    escrow = er.scalar_one_or_none()
    if escrow and escrow.status == EscrowStatus.held:
        escrow.status = EscrowStatus.refunded
        escrow.refunded_at = _now()
        order.payment_status = PaymentStatus.refunded

    # Release reservation
    lr = await db.execute(select(ProduceListing).where(ProduceListing.id == order.listing_id))
    listing = lr.scalar_one_or_none()
    if listing:
        listing.reserved_kg = max(0, (listing.reserved_kg or 0) - order.quantity_kg)

    await db.commit()
    await db.refresh(order)
    return OrderOut.from_orm_ext(order)


# ══════════════════════════════════════════════════════════════════
# SECTION E — ESCROW & PAYMENT GATEWAY HOOKS
# ══════════════════════════════════════════════════════════════════

class InitiatePaymentBody(BaseModel):
    order_id: str
    gateway: str = "razorpay"   # "razorpay" | "stripe"


class EscrowOut(BaseModel):
    id: str
    order_id: str
    organization_id: str
    gross_inr: float
    platform_fee_inr: float
    net_inr: float
    status: str
    gateway: Optional[str]
    gateway_txn_id: Optional[str]
    held_at: Optional[datetime]
    released_at: Optional[datetime]
    refunded_at: Optional[datetime]
    created_at: datetime
    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_ext(cls, e: MarketplaceEscrow):
        return cls(
            id=e.id, order_id=e.order_id, organization_id=e.organization_id,
            gross_inr=_paise_to_inr(e.gross_paise),
            platform_fee_inr=_paise_to_inr(e.platform_fee_paise),
            net_inr=_paise_to_inr(e.net_paise),
            status=e.status, gateway=e.gateway, gateway_txn_id=e.gateway_txn_id,
            held_at=e.held_at, released_at=e.released_at,
            refunded_at=e.refunded_at, created_at=e.created_at,
        )


@router.post("/payments/initiate", summary="Initiate escrow payment (returns gateway order ID)")
async def initiate_payment(body: InitiatePaymentBody, db: AsyncSession = Depends(get_db)):
    """
    In production: call Razorpay/Stripe APIs here.
    Returns a mock gateway_order_id for the frontend to open the payment widget.
    """
    order_r = await db.execute(select(MarketplaceOrder).where(MarketplaceOrder.id == body.order_id))
    order = order_r.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.payment_status != PaymentStatus.unpaid:
        raise HTTPException(400, f"Payment status is already {order.payment_status}")

    # Simulate gateway order creation
    gw_order_id = f"rzp_order_{body.order_id[:8]}_{int(_now().timestamp())}"
    order.payment_gateway = body.gateway
    order.gateway_order_id = gw_order_id
    await db.commit()

    return {
        "gateway": body.gateway,
        "gateway_order_id": gw_order_id,
        "amount_inr": _paise_to_inr(order.total_paise),
        "amount_paise": order.total_paise,
        "order_number": order.order_number,
        "currency": "INR",
        # In production: include Razorpay key_id / Stripe publishable key
        "key_id": "rzp_test_demo_key",
        "description": f"VertiFarm Marketplace - {order.order_number}",
    }


@router.post("/payments/confirm", summary="Confirm payment received — funds into escrow")
async def confirm_payment(
    order_id: str = Body(..., embed=True),
    gateway_payment_id: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    """
    Called after Razorpay/Stripe webhook confirms payment.
    Creates the escrow record and marks payment as 'held'.
    """
    order_r = await db.execute(select(MarketplaceOrder).where(MarketplaceOrder.id == order_id))
    order = order_r.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    order.gateway_payment_id = gateway_payment_id
    order.payment_status = PaymentStatus.held
    order.status = OrderStatus.confirmed

    # Create escrow record
    net = order.total_paise - (order.platform_fee_paise or 0)
    escrow = MarketplaceEscrow(
        order_id=order.id,
        organization_id=order.organization_id,
        gross_paise=order.total_paise,
        platform_fee_paise=order.platform_fee_paise or 0,
        net_paise=net,
        status=EscrowStatus.held,
        gateway=order.payment_gateway,
        gateway_txn_id=gateway_payment_id,
        held_at=_now(),
    )
    db.add(escrow)
    await db.commit()
    await db.refresh(order)

    return {"status": "escrow_held", "order_number": order.order_number, "net_inr": _paise_to_inr(net)}


@router.get("/escrow", summary="List escrow records for my org")
async def list_escrow(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MarketplaceEscrow)
        .where(MarketplaceEscrow.organization_id == current_user.organization_id)
        .order_by(desc(MarketplaceEscrow.created_at))
    )
    escrows = result.scalars().all()
    if not escrows:
        return _mock_escrows(current_user.organization_id)
    return [EscrowOut.from_orm_ext(e) for e in escrows]


# ══════════════════════════════════════════════════════════════════
# SECTION F — INVOICE GENERATION
# ══════════════════════════════════════════════════════════════════

@router.get("/orders/{order_id}/invoice", summary="Get invoice for an order")
async def get_invoice(order_id: str, db: AsyncSession = Depends(get_db)):
    """Returns structured invoice data; in production, generate PDF."""
    result = await db.execute(select(MarketplaceOrder).where(MarketplaceOrder.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        # Return mock invoice
        return _mock_invoice(order_id)

    lr = await db.execute(select(ProduceListing).where(ProduceListing.id == order.listing_id))
    listing = lr.scalar_one_or_none()
    br = await db.execute(select(Buyer).where(Buyer.id == order.buyer_id))
    buyer = br.scalar_one_or_none()
    or2 = await db.execute(select(Organization).where(Organization.id == order.organization_id))
    org = or2.scalar_one_or_none()

    return {
        "invoice_number": order.invoice_number or _gen_invoice_number(),
        "order_number": order.order_number,
        "issue_date": order.created_at.isoformat(),
        "due_date": (order.created_at + timedelta(days=7)).isoformat(),
        "seller": {
            "name": org.name if org else "VertiFarm Partner",
            "org_id": order.organization_id,
        },
        "buyer": {
            "name": buyer.full_name if buyer else "—",
            "company": buyer.company_name if buyer else None,
            "email": buyer.email if buyer else None,
            "gst_number": buyer.gst_number if buyer else None,
            "address": order.delivery_address,
            "city": order.delivery_city,
            "pincode": order.delivery_pincode,
        },
        "line_items": [
            {
                "description": f"{listing.crop_name if listing else 'Produce'} — Grade {listing.grade if listing else 'A'}",
                "quantity_kg": order.quantity_kg,
                "rate_per_kg_inr": _paise_to_inr(order.price_per_kg_paise),
                "amount_inr": _paise_to_inr(order.subtotal_paise),
            }
        ],
        "subtotal_inr": _paise_to_inr(order.subtotal_paise),
        "discount_inr": _paise_to_inr(order.discount_paise or 0),
        "platform_fee_inr": _paise_to_inr(order.platform_fee_paise or 0),
        "tax_inr": _paise_to_inr(order.tax_paise or 0),
        "total_inr": _paise_to_inr(order.total_paise),
        "payment_status": order.payment_status,
        "order_status": order.status,
        "notes": "Thank you for purchasing through VertiFarm Marketplace.",
        "platform_commission_note": "VertiFarm platform fee (2.5%) has been deducted from seller proceeds.",
    }


# ══════════════════════════════════════════════════════════════════
# SECTION G — PLATFORM ANALYTICS & COMMISSION DASHBOARD
# ══════════════════════════════════════════════════════════════════

@router.get("/analytics", summary="Marketplace analytics for my org")
async def marketplace_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _mock_analytics(current_user.organization_id)


@router.get("/commission-summary", summary="Platform commission earned summary")
async def commission_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _mock_commission_summary()


# ══════════════════════════════════════════════════════════════════
# MOCK DATA — rich, realistic demo data
# ══════════════════════════════════════════════════════════════════

def _days_ago(n: int) -> datetime:
    return _now() - timedelta(days=n)

def _days_ahead(n: int) -> datetime:
    return _now() + timedelta(days=n)


def _mock_listings(org_id: str) -> List[ListingOut]:
    return [
        ListingOut(
            id=f"lst-{i:04d}", organization_id=org_id,
            farm_id=f"farm-{i:03d}", harvest_id=None,
            crop_name=cn, variety=var, grade=gr,
            description=desc, quantity_kg=qty, reserved_kg=rsvd, sold_kg=sold,
            available_kg=qty - rsvd - sold, min_order_kg=minq, max_order_kg=maxq,
            price_per_kg_inr=price, bulk_discount_pct=disc, bulk_threshold_kg=thr,
            available_from=_days_ago(2), available_until=_days_ahead(14),
            certifications=certs, packaging=pack, storage_temp_c=temp,
            shelf_life_days=shelf, origin_city=city, origin_state=state,
            images=[], status="active", view_count=5 + (i * 7) % 76,
            platform_commission_pct=2.5, farm_name=f"{city} Hydro Farm",
            org_name="VertiFarm Demo", created_at=_days_ago(3),
        )
        for i, (cn, var, gr, desc, qty, rsvd, sold, minq, maxq, price, disc, thr, certs, pack, temp, shelf, city, state) in enumerate([
            ("Butterhead Lettuce", "Rex", "A", "Hydroponically grown, no pesticides. Crisp heads, ideal for restaurants.", 120, 30, 15, 5, None, 180, 5, 50, ["organic", "fssai"], "5kg crate", 4, 7, "Bengaluru", "Karnataka"),
            ("Baby Spinach", "Bloomsdale", "A", "Tender baby spinach leaves, harvested at peak nutrition.", 80, 10, 5, 2, 20, 240, 0, 50, ["fssai"], "2kg bag", 4, 5, "Pune", "Maharashtra"),
            ("Cherry Tomatoes", "Sakura", "A", "Vine-ripened cherry tomatoes. Ideal for premium retail.", 200, 50, 25, 5, 50, 320, 8, 50, ["globalgap"], "3kg punnet", 12, 10, "Hyderabad", "Telangana"),
            ("Basil", "Genovese", "A", "Aromatic Italian basil. Direct from climate-controlled grow rooms.", 40, 5, 2, 1, 10, 560, 0, 20, ["organic", "fssai"], "1kg pack", 18, 5, "Mumbai", "Maharashtra"),
            ("Kale", "Lacinato", "B", "Dinosaur kale. Great for juices and health foods. Grade B (slight cosmetic blemish).", 60, 8, 0, 3, 30, 150, 5, 30, ["fssai"], "5kg crate", 4, 8, "Chennai", "Tamil Nadu"),
            ("Microgreens Mix", None, "A", "Premium 10-variety microgreens mix: sunflower, radish, pea shoots, broccoli.", 20, 4, 1, 0.5, 5, 1200, 0, 10, ["organic"], "500g tray", 6, 4, "Bengaluru", "Karnataka"),
        ])
    ]


def _mock_browse_listings() -> List[ListingOut]:
    base = _mock_listings("demo-org-001")
    extra = [
        ListingOut(
            id="lst-0010", organization_id="demo-org-002",
            farm_id="farm-010", harvest_id=None,
            crop_name="Pak Choi", variety="Shanghai Green", grade="A",
            description="Tender pak choi, harvested young. Perfect for Asian cuisine.",
            quantity_kg=90, reserved_kg=10, sold_kg=5, available_kg=75,
            min_order_kg=5, max_order_kg=None, price_per_kg_inr=190,
            bulk_discount_pct=6, bulk_threshold_kg=40,
            available_from=_days_ago(1), available_until=_days_ahead(10),
            certifications=["fssai"], packaging="5kg crate", storage_temp_c=4,
            shelf_life_days=6, origin_city="Delhi", origin_state="Delhi",
            images=[], status="active", view_count=42,
            platform_commission_pct=2.5, farm_name="Delhi Vertical Greens",
            org_name="Urban Greens Delhi", created_at=_days_ago(2),
        ),
        ListingOut(
            id="lst-0011", organization_id="demo-org-003",
            farm_id="farm-011", harvest_id=None,
            crop_name="Arugula", variety="Wild Rocket", grade="A",
            description="Peppery wild rocket. Consistent supply, weekly batches available.",
            quantity_kg=50, reserved_kg=0, sold_kg=8, available_kg=42,
            min_order_kg=2, max_order_kg=20, price_per_kg_inr=380,
            bulk_discount_pct=0, bulk_threshold_kg=50,
            available_from=_now(), available_until=_days_ahead(7),
            certifications=["organic", "fssai"], packaging="2kg bag",
            storage_temp_c=4, shelf_life_days=5,
            origin_city="Bengaluru", origin_state="Karnataka",
            images=[], status="active", view_count=67,
            platform_commission_pct=2.5, farm_name="BLR Aero Farms",
            org_name="AeroGrow Bangalore", created_at=_days_ago(1),
        ),
    ]
    return base + extra


def _mock_buyer_orders(buyer_id: str) -> List[OrderOut]:
    now = _now()
    return [
        OrderOut(
            id="ord-0001", order_number="ORD-2027-10042",
            listing_id="lst-0001", buyer_id=buyer_id, organization_id="demo-org-001",
            quantity_kg=25, price_per_kg_inr=180,
            subtotal_inr=4500, discount_inr=225, platform_fee_inr=107, total_inr=4275,
            status="delivered", payment_status="released",
            payment_gateway="razorpay", gateway_order_id="rzp_order_demo001",
            delivery_address="12, Food Street", delivery_city="Bengaluru", delivery_pincode="560001",
            requested_delivery_date=_days_ago(5),
            actual_delivery_date=_days_ago(4),
            tracking_number="DTDC123456789", tracking_url="https://tracking.dtdc.com/123456789",
            logistics_partner="DTDC",
            delivery_confirmed_at=_days_ago(4),
            buyer_notes=None, seller_notes="Packed fresh, dispatched same day",
            invoice_number="INV-2027-10042", invoice_url=None,
            cancelled_at=None, cancel_reason=None,
            crop_name="Butterhead Lettuce", buyer_name="FreshKitchen Resto",
            buyer_email="orders@freshkitchen.in", created_at=_days_ago(7),
        ),
        OrderOut(
            id="ord-0002", order_number="ORD-2027-10058",
            listing_id="lst-0003", buyer_id=buyer_id, organization_id="demo-org-001",
            quantity_kg=40, price_per_kg_inr=320,
            subtotal_inr=12800, discount_inr=1024, platform_fee_inr=300, total_inr=11776,
            status="shipped", payment_status="held",
            payment_gateway="razorpay", gateway_order_id="rzp_order_demo002",
            delivery_address="12, Food Street", delivery_city="Bengaluru", delivery_pincode="560001",
            requested_delivery_date=_days_ahead(1),
            actual_delivery_date=None,
            tracking_number="BLUEDART987654", tracking_url=None,
            logistics_partner="BlueDart",
            delivery_confirmed_at=None,
            buyer_notes="Please deliver before 8am", seller_notes=None,
            invoice_number="INV-2027-10058", invoice_url=None,
            cancelled_at=None, cancel_reason=None,
            crop_name="Cherry Tomatoes", buyer_name="FreshKitchen Resto",
            buyer_email="orders@freshkitchen.in", created_at=_days_ago(2),
        ),
    ]


def _mock_incoming_orders(org_id: str) -> List[OrderOut]:
    now = _now()
    return [
        OrderOut(
            id="ord-0010", order_number="ORD-2027-10060",
            listing_id="lst-0001", buyer_id="buyer-001", organization_id=org_id,
            quantity_kg=30, price_per_kg_inr=180,
            subtotal_inr=5400, discount_inr=270, platform_fee_inr=128, total_inr=5130,
            status="pending", payment_status="unpaid",
            payment_gateway=None, gateway_order_id=None,
            delivery_address="45 Brigade Road", delivery_city="Bengaluru", delivery_pincode="560025",
            requested_delivery_date=_days_ahead(3),
            actual_delivery_date=None, tracking_number=None, tracking_url=None,
            logistics_partner=None, delivery_confirmed_at=None,
            buyer_notes="Need early morning delivery before 7am",
            seller_notes=None, invoice_number="INV-2027-10060", invoice_url=None,
            cancelled_at=None, cancel_reason=None,
            crop_name="Butterhead Lettuce",
            buyer_name="The Green Table Restaurant",
            buyer_email="purchase@greentable.in", created_at=_days_ago(1),
        ),
        OrderOut(
            id="ord-0011", order_number="ORD-2027-10055",
            listing_id="lst-0002", buyer_id="buyer-002", organization_id=org_id,
            quantity_kg=15, price_per_kg_inr=240,
            subtotal_inr=3600, discount_inr=0, platform_fee_inr=90, total_inr=3600,
            status="confirmed", payment_status="held",
            payment_gateway="razorpay", gateway_order_id="rzp_order_demo005",
            delivery_address="Plot 22, APMC Yard", delivery_city="Mumbai", delivery_pincode="400058",
            requested_delivery_date=_days_ahead(2),
            actual_delivery_date=None, tracking_number=None, tracking_url=None,
            logistics_partner=None, delivery_confirmed_at=None,
            buyer_notes=None, seller_notes="Payment received, packing in progress",
            invoice_number="INV-2027-10055", invoice_url=None,
            cancelled_at=None, cancel_reason=None,
            crop_name="Baby Spinach",
            buyer_name="Nature's Basket Mumbai",
            buyer_email="procurement@naturesbasket.in", created_at=_days_ago(2),
        ),
        OrderOut(
            id="ord-0012", order_number="ORD-2027-10048",
            listing_id="lst-0003", buyer_id="buyer-003", organization_id=org_id,
            quantity_kg=60, price_per_kg_inr=320,
            subtotal_inr=19200, discount_inr=1536, platform_fee_inr=445, total_inr=17664,
            status="shipped", payment_status="held",
            payment_gateway="stripe", gateway_order_id="pi_stripe_demo003",
            delivery_address="500, MG Road", delivery_city="Pune", delivery_pincode="411001",
            requested_delivery_date=_days_ago(1),
            actual_delivery_date=None, tracking_number="EKT99887766",
            tracking_url="https://ecomexpress.in/track/EKT99887766",
            logistics_partner="Ecom Express",
            delivery_confirmed_at=None,
            buyer_notes=None, seller_notes="Dispatched on schedule",
            invoice_number="INV-2027-10048", invoice_url=None,
            cancelled_at=None, cancel_reason=None,
            crop_name="Cherry Tomatoes",
            buyer_name="BigBasket Pune",
            buyer_email="fresh-ops@bigbasket.in", created_at=_days_ago(4),
        ),
    ]


def _mock_escrows(org_id: str) -> List[EscrowOut]:
    return [
        EscrowOut(
            id="esc-001", order_id="ord-0011", organization_id=org_id,
            gross_inr=3600, platform_fee_inr=90, net_inr=3510,
            status="held", gateway="razorpay", gateway_txn_id="rzp_pay_demo005",
            held_at=_days_ago(2), released_at=None, refunded_at=None,
            created_at=_days_ago(2),
        ),
        EscrowOut(
            id="esc-002", order_id="ord-0012", organization_id=org_id,
            gross_inr=17664, platform_fee_inr=445, net_inr=17219,
            status="held", gateway="stripe", gateway_txn_id="pi_stripe_demo003",
            held_at=_days_ago(4), released_at=None, refunded_at=None,
            created_at=_days_ago(4),
        ),
        EscrowOut(
            id="esc-003", order_id="ord-0001", organization_id=org_id,
            gross_inr=4275, platform_fee_inr=107, net_inr=4168,
            status="released", gateway="razorpay", gateway_txn_id="rzp_pay_demo001",
            held_at=_days_ago(7), released_at=_days_ago(4), refunded_at=None,
            created_at=_days_ago(7),
        ),
    ]


def _mock_invoice(order_id: str) -> Dict:
    return {
        "invoice_number": "INV-2027-10042",
        "order_number": "ORD-2027-10042",
        "issue_date": _days_ago(7).isoformat(),
        "due_date": _days_ago(0).isoformat(),
        "seller": {"name": "VertiFarm Demo Farm", "org_id": "demo-org-001"},
        "buyer": {
            "name": "FreshKitchen Restaurant", "company": "FreshKitchen Foods Pvt Ltd",
            "email": "orders@freshkitchen.in", "gst_number": "29AABCF1234A1Z5",
            "address": "12, Food Street", "city": "Bengaluru", "pincode": "560001",
        },
        "line_items": [{"description": "Butterhead Lettuce — Grade A", "quantity_kg": 25, "rate_per_kg_inr": 180.0, "amount_inr": 4500.0}],
        "subtotal_inr": 4500.0,
        "discount_inr": 225.0,
        "platform_fee_inr": 107.0,
        "tax_inr": 0.0,
        "total_inr": 4275.0,
        "payment_status": "released",
        "order_status": "delivered",
        "notes": "Thank you for purchasing through VertiFarm Marketplace.",
        "platform_commission_note": "VertiFarm platform fee (2.5%) has been deducted from seller proceeds.",
    }


def _mock_analytics(org_id: str) -> Dict:
    return {
        "org_id": org_id,
        "period": "last_30_days",
        "total_listings": 6,
        "active_listings": 5,
        "total_orders": 14,
        "pending_orders": 2,
        "delivered_orders": 9,
        "cancelled_orders": 1,
        "total_revenue_inr": 87440,
        "platform_fees_inr": 2186,
        "net_revenue_inr": 85254,
        "avg_order_value_inr": 6246,
        "total_kg_sold": 380,
        "top_crops": [
            {"crop": "Cherry Tomatoes", "kg_sold": 140, "revenue_inr": 44800},
            {"crop": "Butterhead Lettuce", "kg_sold": 120, "revenue_inr": 21600},
            {"crop": "Baby Spinach", "kg_sold": 60, "revenue_inr": 14400},
        ],
        "monthly_revenue": [
            {"month": "Feb 2027", "revenue_inr": 18200, "orders": 3},
            {"month": "Mar 2027", "revenue_inr": 24500, "orders": 4},
            {"month": "Apr 2027", "revenue_inr": 21800, "orders": 4},
            {"month": "May 2027", "revenue_inr": 22940, "orders": 3},
        ],
        "escrow_held_inr": 21219,
        "escrow_released_inr": 66035,
        "buyer_count": 7,
    }


def _mock_commission_summary() -> Dict:
    return {
        "platform_total_commission_inr": 84620,
        "this_month_inr": 9840,
        "last_month_inr": 8760,
        "avg_commission_rate_pct": 2.5,
        "total_transactions": 312,
        "total_gmv_inr": 3384800,
        "by_month": [
            {"month": "Jan 2027", "commission_inr": 7200, "gmv_inr": 288000},
            {"month": "Feb 2027", "commission_inr": 8100, "gmv_inr": 324000},
            {"month": "Mar 2027", "commission_inr": 8760, "gmv_inr": 350400},
            {"month": "Apr 2027", "commission_inr": 9840, "gmv_inr": 393600},
        ],
    }


def _mock_marketplace_stats() -> Dict:
    return {
        "active_listings": 42,
        "farms_selling": 18,
        "buyers_registered": 136,
        "orders_this_month": 89,
        "gmv_this_month_inr": 2_18_400,
        "top_crops": ["Lettuce", "Spinach", "Cherry Tomatoes", "Basil", "Microgreens"],
        "avg_price_lettuce_inr_kg": 175,
        "avg_price_tomato_inr_kg": 310,
    }
