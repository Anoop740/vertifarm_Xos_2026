"""
Phase 1 SaaS endpoints:
  POST /auth/signup           — self-serve registration
  POST /auth/verify-email     — email verification
  POST /auth/resend-verify    — resend verify email
  POST /auth/forgot-password  — password reset request
  POST /auth/reset-password   — password reset confirm
  POST /auth/change-password  — change password (authenticated)

  GET  /billing               — subscription + usage overview
  GET  /billing/invoices      — invoice history
  POST /billing/checkout      — create Stripe checkout session
  POST /billing/portal        — Stripe billing portal URL
  POST /billing/webhook       — Stripe webhook receiver

  GET  /team                  — list team members
  POST /team/invite           — send invitation
  GET  /team/invites          — list pending invites
  DELETE /team/invites/{id}   — revoke invitation
  POST /team/accept/{token}   — accept invitation (public)
  PATCH /team/members/{id}    — change member role
  DELETE /team/members/{id}   — remove member

  GET  /org                   — get organization details
  PATCH /org                  — update organization settings

  GET  /api-keys              — list API keys
  POST /api-keys              — create API key
  DELETE /api-keys/{id}       — revoke API key
"""

import hashlib
import secrets
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, Body, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sa_update

from app.db.session import get_db
from app.models.models import (
    User, Organization, Subscription, Invoice, Invitation,
    EmailVerifyToken, PasswordResetToken, APIKey,
    UserRole, PlanTier, SubStatus, InviteStatus
)
from app.schemas.schemas import UserOut, OrgOut
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.api.v1.endpoints.auth import get_current_user, require_admin
from app.services.email import (
    send_welcome_email, send_verify_email, send_reset_password_email,
    send_invitation_email, send_trial_ending_email, send_payment_failed_email
)
from app.services.billing import (
    create_trial_subscription, create_stripe_customer,
    create_stripe_checkout_session, create_stripe_portal_session,
    handle_stripe_webhook, PLAN_LIMITS, PLAN_PRICES_INR
)
from app.services.limits import get_usage_summary, check_user_limit

router = APIRouter(tags=["SaaS — Phase 1"])


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _make_token(n: int = 64) -> str:
    return secrets.token_urlsafe(n)


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _slug(name: str) -> str:
    s = re.sub(r'[^a-zA-Z0-9\s-]', '', name.lower()).strip()
    s = re.sub(r'[\s-]+', '-', s)
    return s[:80]


# ══════════════════════════════════════════════════════════════════
# SIGNUP & ONBOARDING
# ══════════════════════════════════════════════════════════════════

class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    org_name: str
    farm_type: Optional[str] = None    # hint for onboarding
    phone: Optional[str] = None

    @field_validator("password")
    @classmethod
    def pw_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() or not c.isalnum() for c in v):
            raise ValueError("Password must contain at least one number or special character")
        return v


class SignupResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
    org: OrgOut
    trial_ends_at: Optional[datetime]
    email_verification_required: bool


@router.post("/auth/signup", response_model=SignupResponse, summary="Self-serve registration")
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    exists = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(400, "An account with this email already exists. Please sign in.")

    # Create organization
    base_slug = _slug(data.org_name)
    slug = base_slug
    n = 1
    while (await db.execute(select(Organization).where(Organization.slug == slug))).scalar_one_or_none():
        slug = f"{base_slug}-{n}"; n += 1

    org = Organization(
        name=data.org_name,
        slug=slug,
        plan="growth",   # trial gets growth features
        settings={"farm_type_hint": data.farm_type, "onboarding_complete": False}
    )
    db.add(org)
    await db.flush()

    # Create admin user (email_verified=False — add field via is_superuser False)
    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role=UserRole.org_admin,
        is_superuser=False,
        organization_id=org.id,
        preferences={"phone": data.phone, "email_verified": False, "onboarding_step": 1},
    )
    db.add(user)
    await db.flush()

    # Create trial subscription
    sub = await create_trial_subscription(db, org.id)

    # Create Stripe customer (non-blocking)
    stripe_cid = await create_stripe_customer(data.email, data.full_name, org.id)
    if stripe_cid:
        sub.stripe_customer_id = stripe_cid

    # Email verify token
    token_val = _make_token()
    ev = EmailVerifyToken(
        user_id=user.id,
        token=token_val,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.VERIFY_EMAIL_EXPIRE_HOURS)
    )
    db.add(ev)
    await db.commit()
    await db.refresh(user)
    await db.refresh(org)

    # Send welcome + verify email (non-blocking, never fail signup)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token_val}"
    try:
        await send_welcome_email(user.email, user.full_name, org.name, verify_url)
    except Exception:
        pass

    return SignupResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
        org=OrgOut.model_validate(org),
        trial_ends_at=sub.trial_ends_at,
        email_verification_required=True,
    )


# ─── Email verification ────────────────────────────────────────────────────────
class VerifyEmailRequest(BaseModel):
    token: str


@router.post("/auth/verify-email", summary="Verify email address with token")
async def verify_email(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    ev = (await db.execute(
        select(EmailVerifyToken).where(
            EmailVerifyToken.token == data.token,
            EmailVerifyToken.used_at.is_(None),
            EmailVerifyToken.expires_at > now,
        )
    )).scalar_one_or_none()

    if not ev:
        raise HTTPException(400, "Invalid or expired verification link. Please request a new one.")

    ev.used_at = now
    user = (await db.execute(select(User).where(User.id == ev.user_id))).scalar_one_or_none()
    if user:
        prefs = dict(user.preferences or {})
        prefs["email_verified"] = True
        user.preferences = prefs
    await db.commit()
    return {"ok": True, "message": "Email verified successfully. You can now use all features."}


@router.post("/auth/resend-verify", summary="Resend email verification")
async def resend_verify(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if (current_user.preferences or {}).get("email_verified"):
        return {"ok": True, "message": "Email already verified."}

    token_val = _make_token()
    ev = EmailVerifyToken(
        user_id=current_user.id,
        token=token_val,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.VERIFY_EMAIL_EXPIRE_HOURS)
    )
    db.add(ev)
    await db.commit()
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token_val}"
    await send_verify_email(current_user.email, current_user.full_name, verify_url)
    return {"ok": True, "message": "Verification email sent."}


# ─── Password reset ────────────────────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/auth/forgot-password", summary="Request password reset email")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    # Always return success (security — don't reveal if email exists)
    if user and user.is_active:
        token_val = _make_token()
        pr = PasswordResetToken(
            user_id=user.id,
            token=token_val,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.RESET_PASSWORD_EXPIRE_HOURS)
        )
        db.add(pr)
        await db.commit()
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token_val}"
        try:
            await send_reset_password_email(user.email, user.full_name, reset_url)
        except Exception:
            pass
    return {"ok": True, "message": "If that email exists, a reset link has been sent."}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pw_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


@router.post("/auth/reset-password", summary="Reset password with token")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    pr = (await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == data.token,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )).scalar_one_or_none()

    if not pr:
        raise HTTPException(400, "Invalid or expired reset link. Please request a new one.")

    pr.used_at = now
    user = (await db.execute(select(User).where(User.id == pr.user_id))).scalar_one_or_none()
    if user:
        user.hashed_password = get_password_hash(data.new_password)
    await db.commit()
    return {"ok": True, "message": "Password updated successfully. Please sign in."}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def pw_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


@router.post("/auth/change-password", summary="Change password (authenticated)")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(400, "Current password is incorrect.")
    current_user.hashed_password = get_password_hash(data.new_password)
    await db.commit()
    return {"ok": True, "message": "Password changed successfully."}


# ══════════════════════════════════════════════════════════════════
# BILLING
# ══════════════════════════════════════════════════════════════════

@router.get("/billing", summary="Get subscription, usage, and plan details")
async def get_billing(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.organization_id:
        raise HTTPException(400, "No organization associated with your account.")

    sub = (await db.execute(
        select(Subscription).where(Subscription.organization_id == current_user.organization_id)
    )).scalar_one_or_none()

    usage = await get_usage_summary(db, current_user.organization_id)

    plan_info = {}
    for tier, limits in PLAN_LIMITS.items():
        prices = PLAN_PRICES_INR.get(tier, {})
        plan_info[tier.value] = {
            **limits,
            "price_monthly_inr": prices.get("monthly", 0) // 100,
            "price_annual_inr":  prices.get("annual",  0) // 100,
        }

    return {
        "subscription": {
            "plan":                sub.plan if sub else "starter",
            "status":              sub.status if sub else "trialing",
            "trial_ends_at":       sub.trial_ends_at.isoformat() if sub and sub.trial_ends_at else None,
            "current_period_end":  sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
            "cancel_at_period_end": sub.cancel_at_period_end if sub else False,
            "has_payment_method":  bool(sub and sub.stripe_payment_method),
        } if sub else None,
        "usage": usage,
        "plans": plan_info,
    }


@router.get("/billing/invoices", summary="List invoice history")
async def list_invoices(
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.organization_id:
        raise HTTPException(400, "No organization.")

    result = await db.execute(
        select(Invoice)
        .where(Invoice.organization_id == current_user.organization_id)
        .order_by(Invoice.created_at.desc())
        .limit(limit)
    )
    invoices = result.scalars().all()
    return [
        {
            "id": inv.id,
            "amount_inr": inv.amount_inr // 100,
            "status": inv.status,
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            "pdf_url": inv.pdf_url,
            "hosted_url": inv.hosted_invoice_url,
            "created_at": inv.created_at.isoformat(),
        }
        for inv in invoices
    ]


class CheckoutRequest(BaseModel):
    plan: PlanTier
    interval: str = "monthly"   # monthly | annual


@router.post("/billing/checkout", summary="Create Stripe checkout session")
async def create_checkout(
    data: CheckoutRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    sub = (await db.execute(
        select(Subscription).where(Subscription.organization_id == current_user.organization_id)
    )).scalar_one_or_none()

    if not sub:
        raise HTTPException(400, "No subscription record found.")

    price_map = {
        ("starter",  "monthly"): settings.STRIPE_PRICE_STARTER_MONTHLY,
        ("starter",  "annual"):  settings.STRIPE_PRICE_STARTER_ANNUAL,
        ("growth",   "monthly"): settings.STRIPE_PRICE_GROWTH_MONTHLY,
        ("growth",   "annual"):  settings.STRIPE_PRICE_GROWTH_ANNUAL,
        ("enterprise","monthly"):settings.STRIPE_PRICE_ENTERPRISE_MONTHLY,
        ("enterprise","annual"): settings.STRIPE_PRICE_ENTERPRISE_ANNUAL,
    }
    price_id = price_map.get((data.plan.value, data.interval))

    success_url = f"{settings.FRONTEND_URL}/billing?success=1"
    cancel_url  = f"{settings.FRONTEND_URL}/billing?canceled=1"

    url = await create_stripe_checkout_session(
        customer_id=sub.stripe_customer_id or "",
        price_id=price_id or "",
        org_id=current_user.organization_id,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return {"checkout_url": url, "demo_mode": not settings.STRIPE_SECRET_KEY}


@router.post("/billing/portal", summary="Open Stripe billing portal")
async def billing_portal(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    sub = (await db.execute(
        select(Subscription).where(Subscription.organization_id == current_user.organization_id)
    )).scalar_one_or_none()

    return_url = f"{settings.FRONTEND_URL}/billing"
    url = await create_stripe_portal_session(
        customer_id=sub.stripe_customer_id if sub else None,
        return_url=return_url,
    )
    return {"portal_url": url, "demo_mode": not settings.STRIPE_SECRET_KEY}


@router.post("/billing/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        await handle_stripe_webhook(payload, sig, db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════
# TEAM MANAGEMENT
# ══════════════════════════════════════════════════════════════════

class InviteRequest(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.operator


@router.get("/team", summary="List team members")
async def list_team(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.organization_id:
        raise HTTPException(400, "No organization.")
    result = await db.execute(
        select(User)
        .where(User.organization_id == current_user.organization_id)
        .order_by(User.created_at)
    )
    members = result.scalars().all()
    return [
        {
            "id":         m.id,
            "email":      m.email,
            "full_name":  m.full_name,
            "role":       m.role,
            "is_active":  m.is_active,
            "last_login": m.last_login.isoformat() if m.last_login else None,
            "email_verified": (m.preferences or {}).get("email_verified", False),
            "created_at": m.created_at.isoformat(),
            "is_current": m.id == current_user.id,
        }
        for m in members
    ]


@router.post("/team/invite", summary="Invite a team member by email")
async def invite_member(
    data: InviteRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    await check_user_limit(db, current_user.organization_id)

    # Check if already a member
    existing_user = (await db.execute(
        select(User).where(
            User.email == data.email,
            User.organization_id == current_user.organization_id
        )
    )).scalar_one_or_none()
    if existing_user:
        raise HTTPException(400, f"{data.email} is already a member of your organization.")

    # Check for existing pending invite
    now = datetime.now(timezone.utc)
    existing_invite = (await db.execute(
        select(Invitation).where(
            Invitation.email == data.email,
            Invitation.organization_id == current_user.organization_id,
            Invitation.status == InviteStatus.pending,
            Invitation.expires_at > now,
        )
    )).scalar_one_or_none()
    if existing_invite:
        raise HTTPException(400, f"An invitation to {data.email} is already pending.")

    token_val = _make_token()
    invite = Invitation(
        organization_id=current_user.organization_id,
        invited_by=current_user.id,
        email=data.email,
        role=data.role,
        token=token_val,
        expires_at=now + timedelta(hours=settings.INVITE_EXPIRE_HOURS),
    )
    db.add(invite)
    await db.commit()

    org = (await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )).scalar_one_or_none()

    accept_url = f"{settings.FRONTEND_URL}/accept-invite?token={token_val}"
    try:
        await send_invitation_email(
            to=data.email,
            inviter_name=current_user.full_name,
            org_name=org.name if org else "your team",
            role=data.role.value,
            accept_url=accept_url,
        )
    except Exception:
        pass

    return {
        "ok": True,
        "invite_id": invite.id,
        "email": data.email,
        "role": data.role,
        "expires_at": invite.expires_at.isoformat(),
        "accept_url": accept_url,
    }


@router.get("/team/invites", summary="List pending invitations")
async def list_invites(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Invitation)
        .where(
            Invitation.organization_id == current_user.organization_id,
            Invitation.status == InviteStatus.pending,
        )
        .order_by(Invitation.created_at.desc())
    )
    invites = result.scalars().all()
    now = datetime.now(timezone.utc)
    return [
        {
            "id":         inv.id,
            "email":      inv.email,
            "role":       inv.role,
            "status":     inv.status,
            "expired":    inv.expires_at < now,
            "expires_at": inv.expires_at.isoformat(),
            "created_at": inv.created_at.isoformat(),
        }
        for inv in invites
    ]


@router.delete("/team/invites/{invite_id}", summary="Revoke invitation")
async def revoke_invite(
    invite_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    invite = (await db.execute(
        select(Invitation).where(
            Invitation.id == invite_id,
            Invitation.organization_id == current_user.organization_id
        )
    )).scalar_one_or_none()
    if not invite:
        raise HTTPException(404, "Invitation not found.")
    invite.status = InviteStatus.revoked
    await db.commit()
    return {"ok": True, "message": "Invitation revoked."}


class AcceptInviteRequest(BaseModel):
    token: str
    full_name: str
    password: str

    @field_validator("password")
    @classmethod
    def pw_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


@router.post("/team/accept", summary="Accept an invitation (public — no auth required)")
async def accept_invite(data: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    invite = (await db.execute(
        select(Invitation).where(
            Invitation.token == data.token,
            Invitation.status == InviteStatus.pending,
            Invitation.expires_at > now,
        )
    )).scalar_one_or_none()

    if not invite:
        raise HTTPException(400, "This invitation is invalid or has expired.")

    # Check if email already registered
    existing = (await db.execute(select(User).where(User.email == invite.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "An account with this email already exists. Please sign in.")

    await check_user_limit(db, invite.organization_id)

    user = User(
        email=invite.email,
        full_name=data.full_name,
        hashed_password=get_password_hash(data.password),
        role=invite.role,
        organization_id=invite.organization_id,
        preferences={"email_verified": True, "invited": True},
    )
    db.add(user)
    await db.flush()

    invite.status = InviteStatus.accepted
    invite.accepted_at = now
    await db.commit()
    await db.refresh(user)

    return {
        "ok": True,
        "access_token":  create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type":    "bearer",
        "user":          UserOut.model_validate(user),
    }


class UpdateMemberRequest(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


@router.patch("/team/members/{user_id}", summary="Update team member role or status")
async def update_member(
    user_id: str,
    data: UpdateMemberRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(400, "You cannot change your own role or status.")
    member = (await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == current_user.organization_id
        )
    )).scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found.")
    if data.role:
        member.role = data.role
    if data.is_active is not None:
        member.is_active = data.is_active
    await db.commit()
    await db.refresh(member)
    return UserOut.model_validate(member)


@router.delete("/team/members/{user_id}", summary="Remove team member")
async def remove_member(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(400, "You cannot remove yourself.")
    member = (await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == current_user.organization_id
        )
    )).scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found.")
    member.is_active = False
    member.organization_id = None
    await db.commit()
    return {"ok": True, "message": f"{member.full_name} removed from organization."}


# ══════════════════════════════════════════════════════════════════
# ORGANIZATION
# ══════════════════════════════════════════════════════════════════

class OrgUpdateRequest(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    settings: Optional[dict] = None


@router.get("/org", summary="Get organization details")
async def get_org(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    org = (await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )).scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Organization not found.")
    return OrgOut.model_validate(org)


@router.patch("/org", response_model=OrgOut, summary="Update organization details")
async def update_org(
    data: OrgUpdateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    org = (await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )).scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Organization not found.")
    if data.name:
        org.name = data.name
    if data.logo_url is not None:
        org.logo_url = data.logo_url
    if data.settings:
        org.settings = {**(org.settings or {}), **data.settings}
    await db.commit()
    await db.refresh(org)
    return OrgOut.model_validate(org)


# ══════════════════════════════════════════════════════════════════
# API KEYS
# ══════════════════════════════════════════════════════════════════

class APIKeyCreateRequest(BaseModel):
    name: str
    scopes: List[str] = ["farms:read", "zones:read", "sensors:read"]
    expires_days: Optional[int] = None   # None = never expires


@router.get("/api-keys", summary="List API keys for org")
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(APIKey).where(
            APIKey.organization_id == current_user.organization_id,
            APIKey.is_active == True
        ).order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        {
            "id":           k.id,
            "name":         k.name,
            "key_prefix":   f"vf_sk_{k.key_prefix}...",
            "scopes":       k.scopes,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "expires_at":   k.expires_at.isoformat() if k.expires_at else None,
            "created_at":   k.created_at.isoformat(),
        }
        for k in keys
    ]


@router.post("/api-keys", summary="Create new API key")
async def create_api_key(
    data: APIKeyCreateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    raw_key = f"vf_sk_{secrets.token_urlsafe(32)}"
    prefix  = raw_key[5:13]   # 8 chars after "vf_sk_"
    key_hash = _hash_key(raw_key)

    api_key = APIKey(
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        name=data.name,
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=data.scopes,
        expires_at=(
            datetime.now(timezone.utc) + timedelta(days=data.expires_days)
            if data.expires_days else None
        ),
    )
    db.add(api_key)
    await db.commit()

    # Return full key ONCE — never stored in plain text
    return {
        "id":         api_key.id,
        "name":       api_key.name,
        "key":        raw_key,    # shown ONCE — user must copy immediately
        "key_prefix": f"vf_sk_{prefix}...",
        "scopes":     api_key.scopes,
        "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
        "created_at": api_key.created_at.isoformat(),
        "warning":    "Copy this key now. It will never be shown again.",
    }


@router.delete("/api-keys/{key_id}", summary="Revoke API key")
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    key = (await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.organization_id == current_user.organization_id
        )
    )).scalar_one_or_none()
    if not key:
        raise HTTPException(404, "API key not found.")
    key.is_active = False
    await db.commit()
    return {"ok": True, "message": f"API key '{key.name}' revoked."}
