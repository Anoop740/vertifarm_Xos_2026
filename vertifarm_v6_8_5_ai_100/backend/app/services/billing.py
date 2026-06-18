"""
Billing service — Stripe integration with graceful fallback when key not set.
"""
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.models import Subscription, PlanLimit, Organization, PlanTier, SubStatus

logger = logging.getLogger(__name__)

PLAN_PRICES_INR = {
    PlanTier.starter:    {"monthly": 499900,  "annual": 4999000},   # ₹4,999 / ₹49,990
    PlanTier.growth:     {"monthly": 1499900, "annual": 14999000},  # ₹14,999 / ₹1,49,990
    PlanTier.enterprise: {"monthly": 4999900, "annual": 49999000},  # ₹49,999 / ₹4,99,990
}

PLAN_LIMITS = {
    PlanTier.starter: {
        "max_farms": 1, "max_zones": 10, "max_sensors": 50, "max_users": 3,
        "max_api_req_per_min": 0, "data_retention_days": 30,
        "has_ai": True, "has_traceability": False, "has_api_access": False,
        "has_webhooks": False, "has_white_label": False, "has_custom_domain": False,
    },
    PlanTier.growth: {
        "max_farms": 5, "max_zones": 60, "max_sensors": 500, "max_users": 15,
        "max_api_req_per_min": 300, "data_retention_days": 365,
        "has_ai": True, "has_traceability": True, "has_api_access": True,
        "has_webhooks": True, "has_white_label": False, "has_custom_domain": False,
    },
    PlanTier.enterprise: {
        "max_farms": -1, "max_zones": -1, "max_sensors": -1, "max_users": -1,
        "max_api_req_per_min": 1000, "data_retention_days": -1,
        "has_ai": True, "has_traceability": True, "has_api_access": True,
        "has_webhooks": True, "has_white_label": True, "has_custom_domain": True,
    },
}


def get_stripe():
    if not settings.STRIPE_SECRET_KEY:
        return None
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


async def get_plan_limit(db: AsyncSession, plan: PlanTier) -> dict:
    """Get plan limits from DB (seeded) or fall back to in-memory."""
    result = await db.execute(
        select(PlanLimit).where(PlanLimit.plan == plan)
    )
    row = result.scalar_one_or_none()
    if row:
        return {
            "max_farms": row.max_farms, "max_zones": row.max_zones,
            "max_sensors": row.max_sensors, "max_users": row.max_users,
            "max_api_req_per_min": row.max_api_req_per_min,
            "data_retention_days": row.data_retention_days,
            "has_ai": row.has_ai, "has_traceability": row.has_traceability,
            "has_api_access": row.has_api_access, "has_webhooks": row.has_webhooks,
            "has_white_label": row.has_white_label, "has_custom_domain": row.has_custom_domain,
        }
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[PlanTier.starter])


async def get_subscription(db: AsyncSession, org_id: str) -> Subscription | None:
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id)
    )
    return result.scalar_one_or_none()


async def create_trial_subscription(db: AsyncSession, org_id: str) -> Subscription:
    """Create a 14-day trial subscription for a new organization."""
    now = datetime.now(timezone.utc)
    sub = Subscription(
        organization_id=org_id,
        plan=PlanTier.growth,        # trial gets Growth features
        status=SubStatus.trialing,
        trial_starts_at=now,
        trial_ends_at=now + timedelta(days=settings.TRIAL_DAYS),
        seats_used=1,
    )
    db.add(sub)
    await db.flush()
    return sub


async def create_stripe_customer(email: str, name: str, org_id: str) -> str | None:
    """Create a Stripe customer and return their ID."""
    stripe = get_stripe()
    if not stripe:
        logger.info(f"[BILLING-DEV] Would create Stripe customer for {email}")
        return None
    try:
        customer = stripe.Customer.create(
            email=email, name=name,
            metadata={"org_id": org_id, "platform": "vertifarm-xos"}
        )
        return customer.id
    except Exception as e:
        logger.error(f"Stripe customer create failed: {e}")
        return None


async def create_stripe_checkout_session(
    customer_id: str, price_id: str, org_id: str, success_url: str, cancel_url: str
) -> str | None:
    """Create a Stripe Checkout session and return the URL."""
    stripe = get_stripe()
    if not stripe or not customer_id:
        return f"{settings.FRONTEND_URL}/billing?demo=true"
    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"org_id": org_id},
        )
        return session.url
    except Exception as e:
        logger.error(f"Stripe checkout session failed: {e}")
        return None


async def create_stripe_portal_session(customer_id: str, return_url: str) -> str | None:
    """Create a Stripe Billing Portal session."""
    stripe = get_stripe()
    if not stripe or not customer_id:
        return f"{settings.FRONTEND_URL}/billing?demo=true"
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session.url
    except Exception as e:
        logger.error(f"Stripe portal session failed: {e}")
        return None


async def handle_stripe_webhook(payload: bytes, sig: str, db: AsyncSession):
    """Process Stripe webhook events."""
    stripe = get_stripe()
    if not stripe:
        return

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        logger.error(f"Stripe webhook verify failed: {e}")
        raise ValueError("Invalid webhook signature")

    evt_type = event["type"]
    data = event["data"]["object"]

    if evt_type == "customer.subscription.updated":
        await _sync_subscription(db, data)
    elif evt_type == "customer.subscription.deleted":
        await _cancel_subscription(db, data)
    elif evt_type == "invoice.payment_succeeded":
        await _record_payment(db, data, "paid")
    elif evt_type == "invoice.payment_failed":
        await _record_payment(db, data, "open")
    else:
        logger.info(f"Unhandled Stripe event: {evt_type}")


async def _sync_subscription(db: AsyncSession, stripe_sub: dict):
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub["id"])
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    status_map = {
        "trialing": SubStatus.trialing, "active": SubStatus.active,
        "past_due": SubStatus.past_due, "canceled": SubStatus.canceled,
        "paused": SubStatus.paused,
    }
    sub.status = status_map.get(stripe_sub["status"], SubStatus.active)
    sub.cancel_at_period_end = stripe_sub.get("cancel_at_period_end", False)
    await db.commit()


async def _cancel_subscription(db: AsyncSession, stripe_sub: dict):
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub["id"])
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = SubStatus.canceled
        sub.canceled_at = datetime.now(timezone.utc)
        await db.commit()


async def _record_payment(db: AsyncSession, invoice: dict, status: str):
    from app.models.models import Invoice
    existing = await db.execute(
        select(Invoice).where(Invoice.stripe_invoice_id == invoice.get("id"))
    )
    if existing.scalar_one_or_none():
        return
    # find org from customer
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == invoice.get("customer"))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return
    inv = Invoice(
        organization_id=sub.organization_id,
        stripe_invoice_id=invoice.get("id"),
        amount_inr=invoice.get("amount_paid", 0) or invoice.get("amount_due", 0),
        status=status,
        paid_at=datetime.now(timezone.utc) if status == "paid" else None,
        pdf_url=invoice.get("invoice_pdf"),
        hosted_invoice_url=invoice.get("hosted_invoice_url"),
    )
    db.add(inv)
    await db.commit()
