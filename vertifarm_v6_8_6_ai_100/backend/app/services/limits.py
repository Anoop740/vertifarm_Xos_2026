"""
Plan limit enforcement — checks resource counts before every create operation.
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import Farm, Zone, Device, User, Subscription, PlanTier
from app.services.billing import get_plan_limit, PLAN_LIMITS


async def get_org_subscription(db: AsyncSession, org_id: str) -> tuple[PlanTier, str]:
    """Returns (plan, status) for org. Defaults to starter/trialing if no sub found."""
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return PlanTier.starter, "trialing"
    return sub.plan, sub.status


async def check_farm_limit(db: AsyncSession, org_id: str):
    plan, _ = await get_org_subscription(db, org_id)
    limits = await get_plan_limit(db, plan)
    max_farms = limits["max_farms"]
    if max_farms == -1:
        return  # unlimited

    count = (await db.execute(
        select(func.count(Farm.id)).where(
            Farm.organization_id == org_id, Farm.is_active == True
        )
    )).scalar() or 0

    if count >= max_farms:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "PLAN_LIMIT_FARMS",
                "message": f"Your {plan.value.title()} plan allows {max_farms} farm{'s' if max_farms != 1 else ''}. You have {count}.",
                "current": count,
                "limit": max_farms,
                "upgrade_required": True,
            }
        )


async def check_zone_limit(db: AsyncSession, org_id: str):
    plan, _ = await get_org_subscription(db, org_id)
    limits = await get_plan_limit(db, plan)
    max_zones = limits["max_zones"]
    if max_zones == -1:
        return

    # Count all zones across all org farms
    count = (await db.execute(
        select(func.count(Zone.id))
        .join(Farm, Farm.id == Zone.farm_id)
        .where(Farm.organization_id == org_id, Farm.is_active == True)
    )).scalar() or 0

    if count >= max_zones:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "PLAN_LIMIT_ZONES",
                "message": f"Your {plan.value.title()} plan allows {max_zones} zones. You have {count}.",
                "current": count,
                "limit": max_zones,
                "upgrade_required": True,
            }
        )


async def check_sensor_limit(db: AsyncSession, org_id: str):
    plan, _ = await get_org_subscription(db, org_id)
    limits = await get_plan_limit(db, plan)
    max_sensors = limits["max_sensors"]
    if max_sensors == -1:
        return

    count = (await db.execute(
        select(func.count(Device.id))
        .join(Farm, Farm.id == Device.farm_id)
        .where(Farm.organization_id == org_id)
    )).scalar() or 0

    if count >= max_sensors:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "PLAN_LIMIT_SENSORS",
                "message": f"Your {plan.value.title()} plan allows {max_sensors} sensors. You have {count}.",
                "current": count,
                "limit": max_sensors,
                "upgrade_required": True,
            }
        )


async def check_user_limit(db: AsyncSession, org_id: str):
    plan, _ = await get_org_subscription(db, org_id)
    limits = await get_plan_limit(db, plan)
    max_users = limits["max_users"]
    if max_users == -1:
        return

    count = (await db.execute(
        select(func.count(User.id)).where(
            User.organization_id == org_id, User.is_active == True
        )
    )).scalar() or 0

    if count >= max_users:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "PLAN_LIMIT_USERS",
                "message": f"Your {plan.value.title()} plan allows {max_users} team members. You have {count}.",
                "current": count,
                "limit": max_users,
                "upgrade_required": True,
            }
        )


async def get_usage_summary(db: AsyncSession, org_id: str) -> dict:
    """Returns current usage vs plan limits for the org."""
    plan, status = await get_org_subscription(db, org_id)
    limits = await get_plan_limit(db, plan)

    farms = (await db.execute(
        select(func.count(Farm.id)).where(
            Farm.organization_id == org_id, Farm.is_active == True
        )
    )).scalar() or 0

    zones = (await db.execute(
        select(func.count(Zone.id))
        .join(Farm, Farm.id == Zone.farm_id)
        .where(Farm.organization_id == org_id)
    )).scalar() or 0

    sensors = (await db.execute(
        select(func.count(Device.id))
        .join(Farm, Farm.id == Device.farm_id)
        .where(Farm.organization_id == org_id)
    )).scalar() or 0

    users = (await db.execute(
        select(func.count(User.id)).where(
            User.organization_id == org_id, User.is_active == True
        )
    )).scalar() or 0

    def pct(used, limit):
        if limit == -1:
            return 0
        return round(used / limit * 100, 1) if limit > 0 else 100

    return {
        "plan": plan,
        "status": status,
        "farms":   {"used": farms,   "limit": limits["max_farms"],   "pct": pct(farms,   limits["max_farms"])},
        "zones":   {"used": zones,   "limit": limits["max_zones"],   "pct": pct(zones,   limits["max_zones"])},
        "sensors": {"used": sensors, "limit": limits["max_sensors"], "pct": pct(sensors, limits["max_sensors"])},
        "users":   {"used": users,   "limit": limits["max_users"],   "pct": pct(users,   limits["max_users"])},
        "features": {
            "ai":           limits["has_ai"],
            "traceability": limits["has_traceability"],
            "api_access":   limits["has_api_access"],
            "webhooks":     limits["has_webhooks"],
            "white_label":  limits["has_white_label"],
        },
    }
