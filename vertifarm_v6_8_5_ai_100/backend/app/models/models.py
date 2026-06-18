from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, ForeignKey,
    Text, JSON, Enum as SAEnum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func
import uuid
import enum


class Base(DeclarativeBase):
    pass


def gen_uuid():
    return str(uuid.uuid4())


# ─── ENUMS ────────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    superadmin  = "superadmin"
    org_admin   = "org_admin"
    farm_manager = "farm_manager"
    operator    = "operator"
    viewer      = "viewer"


class FarmType(str, enum.Enum):
    # Hydroponic family
    hydroponic  = "hydroponic"       # Generic DWC / raft / flood-and-drain
    nft         = "nft"              # Nutrient Film Technique — channels
    dwc         = "dwc"              # Deep Water Culture — root-submerged rafts
    # Aeroponic family
    aeroponic   = "aeroponic"        # High-pressure mist towers
    # Vertical / structural
    tower       = "tower"            # Vertical tower columns with drip
    rack        = "rack"             # Multi-tier grow racks (most common indoor)
    zip_grow    = "zip_grow"         # ZipGrow / vertical wall panels
    # Controlled environment
    greenhouse  = "greenhouse"       # Hybrid greenhouse + hydro
    container   = "container"        # Shipping container farm
    # Soil-based indoor
    raised_bed  = "raised_bed"       # Indoor raised beds (soil/coco)
    # Specialty
    aquaponics  = "aquaponics"       # Fish + plant symbiotic system
    fogponics   = "fogponics"        # Ultra-fine fog (low-pressure aero variant)


class ZoneStatus(str, enum.Enum):
    active      = "active"
    idle        = "idle"
    maintenance = "maintenance"
    harvesting  = "harvesting"


class AlertSeverity(str, enum.Enum):
    info     = "info"
    warning  = "warning"
    critical = "critical"


class CropStatus(str, enum.Enum):
    seeding     = "seeding"
    germination = "germination"
    vegetative  = "vegetative"
    flowering   = "flowering"
    fruiting    = "fruiting"
    ready       = "ready"
    harvested   = "harvested"


class DeviceStatus(str, enum.Enum):
    online      = "online"
    offline     = "offline"
    error       = "error"
    maintenance = "maintenance"


# ─── ORGANIZATION ─────────────────────────────────────────────────────────────
class Organization(Base):
    __tablename__ = "organizations"
    id          = Column(String, primary_key=True, default=gen_uuid)
    name        = Column(String(200), nullable=False)
    slug        = Column(String(100), unique=True, nullable=False)
    plan        = Column(String(50), default="starter")   # starter|growth|enterprise
    logo_url    = Column(String, nullable=True)
    settings    = Column(JSON, default=dict)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    users       = relationship("User",  back_populates="organization")
    farms       = relationship("Farm",  back_populates="organization")


# ─── USER ─────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id              = Column(String, primary_key=True, default=gen_uuid)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    full_name       = Column(String(200), nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(SAEnum(UserRole), default=UserRole.operator)
    is_active       = Column(Boolean, default=True)
    is_superuser    = Column(Boolean, default=False)
    avatar_url      = Column(String, nullable=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    last_login      = Column(DateTime(timezone=True), nullable=True)
    preferences     = Column(JSON, default=dict)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization    = relationship("Organization", back_populates="users")
    farms           = relationship("Farm", secondary="user_farms", back_populates="users")


class UserFarm(Base):
    __tablename__ = "user_farms"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    farm_id = Column(String, ForeignKey("farms.id"), primary_key=True)


# ─── FARM ─────────────────────────────────────────────────────────────────────
class Farm(Base):
    __tablename__ = "farms"
    id              = Column(String, primary_key=True, default=gen_uuid)
    name            = Column(String(200), nullable=False)
    code            = Column(String(20), nullable=False)
    type            = Column(SAEnum(FarmType), default=FarmType.rack)
    location        = Column(String(500), nullable=True)
    address         = Column(String(500), nullable=True)
    city            = Column(String(100), nullable=True)
    state           = Column(String(100), nullable=True)
    country         = Column(String(100), default="India")
    latitude        = Column(Float, nullable=True)
    longitude       = Column(Float, nullable=True)
    timezone        = Column(String(50), default="Asia/Kolkata")
    area_sqm        = Column(Float, nullable=True)
    total_racks     = Column(Integer, default=0)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    is_active       = Column(Boolean, default=True)
    settings        = Column(JSON, default=dict)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization    = relationship("Organization", back_populates="farms")
    zones           = relationship("Zone",   back_populates="farm", cascade="all, delete-orphan")
    devices         = relationship("Device", back_populates="farm")
    users           = relationship("User",   secondary="user_farms", back_populates="farms")
    alerts          = relationship("Alert",  back_populates="farm")


# ─── ZONE ─────────────────────────────────────────────────────────────────────
class Zone(Base):
    __tablename__ = "zones"
    id               = Column(String, primary_key=True, default=gen_uuid)
    name             = Column(String(200), nullable=False)
    code             = Column(String(20),  nullable=False)
    farm_id          = Column(String, ForeignKey("farms.id"), nullable=False)
    status           = Column(SAEnum(ZoneStatus), default=ZoneStatus.idle)
    rack_count       = Column(Integer, default=1)
    level_count      = Column(Integer, default=4)
    area_sqm         = Column(Float, nullable=True)
    current_crop_id  = Column(String, ForeignKey("crops.id"), nullable=True)
    target_temp      = Column(Float, default=22.0)
    target_humidity  = Column(Float, default=65.0)
    target_co2       = Column(Float, default=1000.0)
    target_ph        = Column(Float, default=6.0)
    target_ec        = Column(Float, default=2.0)
    target_ppfd      = Column(Float, default=280.0)
    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    farm             = relationship("Farm", back_populates="zones")
    current_crop     = relationship("Crop", foreign_keys=[current_crop_id])
    sensors          = relationship("SensorReading", back_populates="zone")
    alerts           = relationship("Alert", back_populates="zone")


# ─── CROP RECIPE ──────────────────────────────────────────────────────────────
class CropRecipe(Base):
    __tablename__ = "crop_recipes"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    name                = Column(String(200), nullable=False)
    crop_type           = Column(String(100), nullable=False)
    variety             = Column(String(100), nullable=True)
    grow_days           = Column(Integer, nullable=False)
    phases              = Column(JSON, default=list)
    expected_yield_kg   = Column(Float, nullable=True)
    notes               = Column(Text, nullable=True)
    organization_id     = Column(String, ForeignKey("organizations.id"), nullable=True)
    is_public           = Column(Boolean, default=True)
    created_by          = Column(String, ForeignKey("users.id"), nullable=True)
    farm_type_tag       = Column(String(50), nullable=True)   # which farm type this is tuned for
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())


# ─── CROP BATCH ───────────────────────────────────────────────────────────────
class Crop(Base):
    __tablename__ = "crops"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    batch_code          = Column(String(50), nullable=False, unique=True)
    name                = Column(String(200), nullable=False)
    farm_id             = Column(String, ForeignKey("farms.id"), nullable=False)
    zone_id             = Column(String, ForeignKey("zones.id"), nullable=True)
    recipe_id           = Column(String, ForeignKey("crop_recipes.id"), nullable=True)
    status              = Column(SAEnum(CropStatus), default=CropStatus.seeding)
    planted_at          = Column(DateTime(timezone=True), nullable=True)
    expected_harvest    = Column(DateTime(timezone=True), nullable=True)
    harvested_at        = Column(DateTime(timezone=True), nullable=True)
    actual_yield_kg     = Column(Float, nullable=True)
    quality_score       = Column(Float, nullable=True)
    qr_code             = Column(String, nullable=True)
    traceability_data   = Column(JSON, default=dict)
    notes               = Column(Text, nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    recipe = relationship("CropRecipe")


# ─── DEVICE ───────────────────────────────────────────────────────────────────
class Device(Base):
    __tablename__ = "devices"
    id               = Column(String, primary_key=True, default=gen_uuid)
    name             = Column(String(200), nullable=False)
    device_type      = Column(String(100), nullable=False)
    device_uid       = Column(String(100), unique=True, nullable=False)
    farm_id          = Column(String, ForeignKey("farms.id"), nullable=False)
    zone_id          = Column(String, ForeignKey("zones.id"), nullable=True)
    status           = Column(SAEnum(DeviceStatus), default=DeviceStatus.offline)
    firmware_version = Column(String(50), nullable=True)
    protocol         = Column(String(50), default="mqtt")
    ip_address       = Column(String(50), nullable=True)
    mac_address      = Column(String(50), nullable=True)
    last_seen        = Column(DateTime(timezone=True), nullable=True)
    config           = Column(JSON, default=dict)
    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    farm = relationship("Farm", back_populates="devices")


# ─── SENSOR READING ───────────────────────────────────────────────────────────
class SensorReading(Base):
    __tablename__ = "sensor_readings"
    id          = Column(String, primary_key=True, default=gen_uuid)
    zone_id     = Column(String, ForeignKey("zones.id"), nullable=False)
    device_id   = Column(String, ForeignKey("devices.id"), nullable=True)
    sensor_type = Column(String(50), nullable=False)
    value       = Column(Float, nullable=False)
    unit        = Column(String(20), nullable=True)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    zone = relationship("Zone", back_populates="sensors")

    __table_args__ = (
        Index("ix_sensor_zone_type_ts", "zone_id", "sensor_type", "timestamp"),
    )


# ─── ALERT ────────────────────────────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"
    id             = Column(String, primary_key=True, default=gen_uuid)
    farm_id        = Column(String, ForeignKey("farms.id"), nullable=False)
    zone_id        = Column(String, ForeignKey("zones.id"), nullable=True)
    device_id      = Column(String, ForeignKey("devices.id"), nullable=True)
    severity       = Column(SAEnum(AlertSeverity), default=AlertSeverity.info)
    category       = Column(String(100), nullable=False)
    title          = Column(String(300), nullable=False)
    message        = Column(Text, nullable=False)
    is_resolved    = Column(Boolean, default=False)
    resolved_at    = Column(DateTime(timezone=True), nullable=True)
    resolved_by    = Column(String, ForeignKey("users.id"), nullable=True)
    alert_metadata = Column(JSON, default=dict)
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    farm = relationship("Farm", back_populates="alerts")
    zone = relationship("Zone", back_populates="alerts")


# ─── AUTOMATION RULE ──────────────────────────────────────────────────────────
class AutomationRule(Base):
    __tablename__ = "automation_rules"
    id             = Column(String, primary_key=True, default=gen_uuid)
    name           = Column(String(200), nullable=False)
    farm_id        = Column(String, ForeignKey("farms.id"), nullable=False)
    zone_id        = Column(String, ForeignKey("zones.id"), nullable=True)
    is_active      = Column(Boolean, default=True)
    trigger_type   = Column(String(50), nullable=False)
    conditions     = Column(JSON, default=list)
    actions        = Column(JSON, default=list)
    priority       = Column(Integer, default=5)
    last_triggered = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


# ─── HARVEST LOG ──────────────────────────────────────────────────────────────
class HarvestLog(Base):
    __tablename__ = "harvest_logs"
    id            = Column(String, primary_key=True, default=gen_uuid)
    crop_id       = Column(String, ForeignKey("crops.id"), nullable=False)
    farm_id       = Column(String, ForeignKey("farms.id"), nullable=False)
    zone_id       = Column(String, ForeignKey("zones.id"), nullable=True)
    harvested_by  = Column(String, ForeignKey("users.id"), nullable=True)
    weight_kg     = Column(Float, nullable=False)
    quality_grade = Column(String(10), nullable=True)
    notes         = Column(Text, nullable=True)
    harvested_at  = Column(DateTime(timezone=True), server_default=func.now())


# ══════════════════════════════════════════════════════════════════
# PHASE 1 — SaaS MODELS: Billing · Auth · Teams · Usage
# ══════════════════════════════════════════════════════════════════

class PlanTier(str, enum.Enum):
    starter    = "starter"
    growth     = "growth"
    enterprise = "enterprise"

class SubStatus(str, enum.Enum):
    trialing   = "trialing"
    active     = "active"
    past_due   = "past_due"
    canceled   = "canceled"
    paused     = "paused"

class InviteStatus(str, enum.Enum):
    pending  = "pending"
    accepted = "accepted"
    expired  = "expired"
    revoked  = "revoked"

class BillingInterval(str, enum.Enum):
    monthly = "monthly"
    annual  = "annual"


# ─── PLAN LIMITS ──────────────────────────────────────────────────────────────
class PlanLimit(Base):
    """Static config table — seeded once, defines caps per plan tier."""
    __tablename__ = "plan_limits"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    plan                = Column(SAEnum(PlanTier), unique=True, nullable=False)
    max_farms           = Column(Integer, nullable=False)   # -1 = unlimited
    max_zones           = Column(Integer, nullable=False)
    max_sensors         = Column(Integer, nullable=False)
    max_users           = Column(Integer, nullable=False)
    max_api_req_per_min = Column(Integer, nullable=False)
    data_retention_days = Column(Integer, nullable=False)
    has_ai              = Column(Boolean, default=True)
    has_traceability    = Column(Boolean, default=False)
    has_api_access      = Column(Boolean, default=False)
    has_webhooks        = Column(Boolean, default=False)
    has_white_label     = Column(Boolean, default=False)
    has_custom_domain   = Column(Boolean, default=False)
    price_monthly_inr   = Column(Integer, nullable=False)   # in paise (x100 for INR)
    price_annual_inr    = Column(Integer, nullable=False)
    stripe_price_id_monthly = Column(String, nullable=True)
    stripe_price_id_annual  = Column(String, nullable=True)


# ─── SUBSCRIPTION ─────────────────────────────────────────────────────────────
class Subscription(Base):
    __tablename__ = "subscriptions"
    id                      = Column(String, primary_key=True, default=gen_uuid)
    organization_id         = Column(String, ForeignKey("organizations.id"), unique=True, nullable=False)
    plan                    = Column(SAEnum(PlanTier), default=PlanTier.starter)
    status                  = Column(SAEnum(SubStatus), default=SubStatus.trialing)
    billing_interval        = Column(SAEnum(BillingInterval), default=BillingInterval.monthly)
    stripe_customer_id      = Column(String, unique=True, nullable=True, index=True)
    stripe_subscription_id  = Column(String, unique=True, nullable=True, index=True)
    stripe_payment_method   = Column(String, nullable=True)
    trial_starts_at         = Column(DateTime(timezone=True), nullable=True)
    trial_ends_at           = Column(DateTime(timezone=True), nullable=True)
    current_period_start    = Column(DateTime(timezone=True), nullable=True)
    current_period_end      = Column(DateTime(timezone=True), nullable=True)
    canceled_at             = Column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end    = Column(Boolean, default=False)
    seats_used              = Column(Integer, default=1)
    created_at              = Column(DateTime(timezone=True), server_default=func.now())
    updated_at              = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", backref="subscription", uselist=False)


# ─── INVOICE ──────────────────────────────────────────────────────────────────
class Invoice(Base):
    __tablename__ = "invoices"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    organization_id     = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    stripe_invoice_id   = Column(String, unique=True, nullable=True)
    amount_inr          = Column(Integer, nullable=False)   # paise
    status              = Column(String(30), default="draft")  # draft|open|paid|void|uncollectible
    period_start        = Column(DateTime(timezone=True), nullable=True)
    period_end          = Column(DateTime(timezone=True), nullable=True)
    paid_at             = Column(DateTime(timezone=True), nullable=True)
    pdf_url             = Column(String, nullable=True)
    hosted_invoice_url  = Column(String, nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", backref="invoices")


# ─── USAGE COUNTER ────────────────────────────────────────────────────────────
class UsageCounter(Base):
    """Tracks monthly rolling usage per org for metered billing."""
    __tablename__ = "usage_counters"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    month_key       = Column(String(7), nullable=False)   # "2026-05"
    api_calls       = Column(Integer, default=0)
    sensor_readings = Column(Integer, default=0)
    ai_requests     = Column(Integer, default=0)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("organization_id", "month_key", name="uq_usage_org_month"),
    )


# ─── INVITATION ───────────────────────────────────────────────────────────────
class Invitation(Base):
    __tablename__ = "invitations"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    invited_by      = Column(String, ForeignKey("users.id"), nullable=False)
    email           = Column(String(255), nullable=False, index=True)
    role            = Column(SAEnum(UserRole), default=UserRole.operator)
    token           = Column(String(128), unique=True, nullable=False, index=True)
    status          = Column(SAEnum(InviteStatus), default=InviteStatus.pending)
    expires_at      = Column(DateTime(timezone=True), nullable=False)
    accepted_at     = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", backref="invitations")
    inviter      = relationship("User", foreign_keys=[invited_by])


# ─── EMAIL VERIFICATION TOKEN ─────────────────────────────────────────────────
class EmailVerifyToken(Base):
    __tablename__ = "email_verify_tokens"
    id         = Column(String, primary_key=True, default=gen_uuid)
    user_id    = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    token      = Column(String(128), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at    = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ─── PASSWORD RESET TOKEN ─────────────────────────────────────────────────────
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id         = Column(String, primary_key=True, default=gen_uuid)
    user_id    = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    token      = Column(String(128), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at    = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ─── API KEY ──────────────────────────────────────────────────────────────────
class APIKey(Base):
    __tablename__ = "api_keys"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by      = Column(String, ForeignKey("users.id"), nullable=False)
    name            = Column(String(100), nullable=False)
    key_prefix      = Column(String(8),  nullable=False)           # shown in UI: "vf_sk_ab12"
    key_hash        = Column(String(64), unique=True, nullable=False)  # sha256
    scopes          = Column(JSON, default=list)                   # ["farms:read","zones:write",...]
    last_used_at    = Column(DateTime(timezone=True), nullable=True)
    expires_at      = Column(DateTime(timezone=True), nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", backref="api_keys")


# ══════════════════════════════════════════════════════════════════
# PHASE 2 — Revenue & Retention: API Portal · Notifications ·
#            Traceability · Integrations
# ══════════════════════════════════════════════════════════════════

# ─── WEBHOOK ENDPOINT ────────────────────────────────────────────
class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by      = Column(String, ForeignKey("users.id"), nullable=False)
    url             = Column(String(500), nullable=False)
    name            = Column(String(100), nullable=False)
    # events: ["alert_fired","harvest_completed","device_offline","threshold_breached"]
    events          = Column(JSON, default=list)
    secret_hash     = Column(String(64), nullable=True)   # HMAC signing secret (sha256)
    is_active       = Column(Boolean, default=True)
    last_triggered  = Column(DateTime(timezone=True), nullable=True)
    failure_count   = Column(Integer, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", backref="webhook_endpoints")


class WebhookDelivery(Base):
    """Delivery queue with retry tracking."""
    __tablename__ = "webhook_deliveries"
    id              = Column(String, primary_key=True, default=gen_uuid)
    endpoint_id     = Column(String, ForeignKey("webhook_endpoints.id"), nullable=False, index=True)
    event_type      = Column(String(80), nullable=False)
    payload         = Column(JSON, default=dict)
    status          = Column(String(20), default="pending")  # pending|delivered|failed
    response_code   = Column(Integer, nullable=True)
    response_body   = Column(Text, nullable=True)
    attempt_count   = Column(Integer, default=0)
    next_retry_at   = Column(DateTime(timezone=True), nullable=True)
    delivered_at    = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    endpoint = relationship("WebhookEndpoint", backref="deliveries")


# ─── NOTIFICATION ────────────────────────────────────────────────
class NotificationType(str, enum.Enum):
    critical_alert    = "critical_alert"
    harvest_ready     = "harvest_ready"
    device_offline    = "device_offline"
    threshold_breach  = "threshold_breach"
    daily_digest      = "daily_digest"
    system            = "system"


class Notification(Base):
    __tablename__ = "notifications"
    id          = Column(String, primary_key=True, default=gen_uuid)
    user_id     = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type        = Column(SAEnum(NotificationType), nullable=False)
    title       = Column(String(200), nullable=False)
    body        = Column(Text, nullable=False)
    read_at     = Column(DateTime(timezone=True), nullable=True)
    action_url  = Column(String(300), nullable=True)
    notif_meta  = Column(JSON, default=dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", backref="notifications")


class NotificationPreference(Base):
    """Per-user channel preferences per alert type."""
    __tablename__ = "notification_preferences"
    id              = Column(String, primary_key=True, default=gen_uuid)
    user_id         = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    alert_type      = Column(String(80), nullable=False)   # critical_alert|harvest_ready|...
    email_enabled   = Column(Boolean, default=True)
    sms_enabled     = Column(Boolean, default=False)
    whatsapp_enabled= Column(Boolean, default=False)
    inapp_enabled   = Column(Boolean, default=True)
    push_enabled    = Column(Boolean, default=True)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "alert_type", name="uq_notif_pref_user_type"),
    )


class EscalationRule(Base):
    __tablename__ = "escalation_rules"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    alert_type      = Column(String(80), nullable=False)
    level1_minutes  = Column(Integer, default=15)   # escalate to farm manager
    level2_minutes  = Column(Integer, default=30)   # escalate to org admin
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


# ─── TRACEABILITY ─────────────────────────────────────────────────
class TraceabilityRecord(Base):
    __tablename__ = "traceability_records"
    id              = Column(String, primary_key=True, default=gen_uuid)
    batch_code      = Column(String(50), nullable=False, unique=True, index=True)
    crop_id         = Column(String, ForeignKey("crops.id"), nullable=True)
    farm_name       = Column(String(200), nullable=False)
    zone            = Column(String(100), nullable=True)
    grow_method     = Column(String(100), nullable=True)
    nutrients_used  = Column(JSON, default=list)     # list of nutrient names/amounts
    water_source    = Column(String(200), nullable=True)
    certifications  = Column(JSON, default=list)     # ["FSSAI","GlobalGAP",...]
    test_results    = Column(JSON, default=dict)     # heavy metals, pesticides
    sow_date        = Column(DateTime(timezone=True), nullable=True)
    harvest_date    = Column(DateTime(timezone=True), nullable=True)
    qr_code_url     = Column(String, nullable=True)
    pdf_url         = Column(String, nullable=True)
    is_public       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    crop = relationship("Crop", backref="traceability_record", foreign_keys=[crop_id])


# ─── INTEGRATION HUB ─────────────────────────────────────────────
class IntegrationType(str, enum.Enum):
    # ERP
    tally_prime   = "tally_prime"
    zoho_books    = "zoho_books"
    # Logistics
    delhivery     = "delhivery"
    shiprocket    = "shiprocket"
    # Weather
    openweathermap = "openweathermap"
    # Certifications
    fssai         = "fssai"
    globalgap     = "globalgap"
    # Communication
    slack         = "slack"
    whatsapp_biz  = "whatsapp_biz"
    # LIMS
    lims_generic  = "lims_generic"


class Integration(Base):
    __tablename__ = "integrations"
    id                   = Column(String, primary_key=True, default=gen_uuid)
    organization_id      = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    type                 = Column(SAEnum(IntegrationType), nullable=False)
    name                 = Column(String(100), nullable=False)
    credentials_encrypted= Column(Text, nullable=True)   # Fernet-encrypted JSON
    config               = Column(JSON, default=dict)    # non-secret config
    is_active            = Column(Boolean, default=False)
    auth_method          = Column(String(30), default="api_key")  # oauth2|api_key
    oauth_access_token   = Column(Text, nullable=True)
    oauth_refresh_token  = Column(Text, nullable=True)
    oauth_expires_at     = Column(DateTime(timezone=True), nullable=True)
    last_synced_at       = Column(DateTime(timezone=True), nullable=True)
    last_error           = Column(Text, nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", backref="integrations")

    __table_args__ = (
        UniqueConstraint("organization_id", "type", name="uq_integration_org_type"),
    )


# ══════════════════════════════════════════════════════════════════
# PHASE 3 — Scale & Ecosystem: AI Models, Analytics, Reports
# ══════════════════════════════════════════════════════════════════

# ─── AI MODEL VERSIONING ─────────────────────────────────────────
class AIModelType(str, enum.Enum):
    yield_prediction    = "yield_prediction"
    anomaly_detection   = "anomaly_detection"
    nutrient_optimizer  = "nutrient_optimizer"
    energy_optimizer    = "energy_optimizer"
    harvest_scheduler   = "harvest_scheduler"
    computer_vision     = "computer_vision"


class AIModel(Base):
    __tablename__ = "ai_models"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    model_type      = Column(SAEnum(AIModelType), nullable=False)
    version         = Column(String(20), nullable=False)         # e.g. "2.1.0"
    trained_at      = Column(DateTime(timezone=True), nullable=True)
    accuracy        = Column(Float, nullable=True)               # 0.0–1.0
    is_active       = Column(Boolean, default=True)
    parameters      = Column(JSON, default=dict)                 # hyperparams, feature list
    metrics         = Column(JSON, default=dict)                 # RMSE, MAE, F1, etc.
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


# ─── AI PREDICTION LOG ───────────────────────────────────────────
class AIPrediction(Base):
    """Stores every AI inference for audit and retraining."""
    __tablename__ = "ai_predictions"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    model_id        = Column(String, ForeignKey("ai_models.id"), nullable=True)
    model_type      = Column(SAEnum(AIModelType), nullable=False)
    zone_id         = Column(String, ForeignKey("zones.id"), nullable=True)
    farm_id         = Column(String, ForeignKey("farms.id"), nullable=True)
    input_features  = Column(JSON, default=dict)
    output          = Column(JSON, default=dict)   # prediction result
    confidence      = Column(Float, nullable=True)
    actual_outcome  = Column(JSON, nullable=True)  # filled in post-harvest
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    model = relationship("AIModel", foreign_keys=[model_id])


# ─── ANOMALY LOG ─────────────────────────────────────────────────
class AnomalyLog(Base):
    __tablename__ = "anomaly_logs"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    farm_id         = Column(String, ForeignKey("farms.id"), nullable=True)
    zone_id         = Column(String, ForeignKey("zones.id"), nullable=True)
    device_id       = Column(String, ForeignKey("devices.id"), nullable=True)
    sensor_type     = Column(String(80), nullable=False)   # temperature|ec|ph|...
    anomaly_score   = Column(Float, nullable=False)        # Isolation Forest score
    detected_value  = Column(Float, nullable=True)
    expected_range  = Column(JSON, default=dict)           # {min, max, mean, std}
    severity        = Column(String(20), default="warning") # info|warning|critical
    is_resolved     = Column(Boolean, default=False)
    resolved_at     = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ─── ENERGY TARIFF ───────────────────────────────────────────────
class EnergyTariff(Base):
    """Time-of-use tariff schedule for energy optimizer."""
    __tablename__ = "energy_tariffs"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    name            = Column(String(100), nullable=False)
    # peak_slots: [{day_of_week:[0-6], hour_start:int, hour_end:int, rate_per_kwh_inr:float}]
    peak_slots      = Column(JSON, default=list)
    off_peak_rate   = Column(Float, default=6.5)   # ₹/kWh
    peak_rate       = Column(Float, default=12.0)  # ₹/kWh
    currency        = Column(String(5), default="INR")
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())


# ─── ENERGY SCHEDULE ─────────────────────────────────────────────
class EnergySchedule(Base):
    """AI-generated optimized device schedules."""
    __tablename__ = "energy_schedules"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    farm_id         = Column(String, ForeignKey("farms.id"), nullable=True)
    zone_id         = Column(String, ForeignKey("zones.id"), nullable=True)
    device_type     = Column(String(50), nullable=False)   # lighting|hvac|pump
    schedule_date   = Column(DateTime(timezone=True), nullable=False)
    # slots: [{hour:int, power_kw:float, is_peak:bool, tariff_rate:float}]
    hourly_plan     = Column(JSON, default=list)
    estimated_saving_inr = Column(Float, default=0.0)
    is_applied      = Column(Boolean, default=False)
    applied_at      = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


# ─── HARVEST WINDOW ──────────────────────────────────────────────
class HarvestWindow(Base):
    """AI-predicted optimal harvest windows."""
    __tablename__ = "harvest_windows"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    crop_id         = Column(String, ForeignKey("crops.id"), nullable=False)
    farm_id         = Column(String, ForeignKey("farms.id"), nullable=True)
    zone_id         = Column(String, ForeignKey("zones.id"), nullable=True)
    window_start    = Column(DateTime(timezone=True), nullable=False)
    window_end      = Column(DateTime(timezone=True), nullable=False)
    optimal_day     = Column(DateTime(timezone=True), nullable=False)
    confidence_pct  = Column(Float, nullable=False)
    predicted_yield_kg = Column(Float, nullable=True)
    # factors: list of strings explaining prediction
    factors         = Column(JSON, default=list)
    is_actioned     = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    crop = relationship("Crop", foreign_keys=[crop_id])


# ─── COMPUTER VISION SCAN ────────────────────────────────────────
class CVScan(Base):
    """Results from camera-based crop analysis."""
    __tablename__ = "cv_scans"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    device_id       = Column(String, ForeignKey("devices.id"), nullable=True)
    farm_id         = Column(String, ForeignKey("farms.id"), nullable=True)
    zone_id         = Column(String, ForeignKey("zones.id"), nullable=True)
    image_url       = Column(String, nullable=True)
    scan_type       = Column(String(50), nullable=False)   # disease|growth|canopy
    # detections: [{label:str, confidence:float, bbox:[x,y,w,h]}]
    detections      = Column(JSON, default=list)
    canopy_coverage_pct = Column(Float, nullable=True)
    growth_rate_index   = Column(Float, nullable=True)    # 0–10 scale
    disease_risk_pct    = Column(Float, nullable=True)
    summary         = Column(Text, nullable=True)
    model_version   = Column(String(20), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ─── REPORT ──────────────────────────────────────────────────────
class ReportType(str, enum.Enum):
    yield_performance   = "yield_performance"
    cost_of_production  = "cost_of_production"
    sustainability      = "sustainability"
    compliance          = "compliance"
    custom              = "custom"


class ReportSchedule(str, enum.Enum):
    once        = "once"
    daily       = "daily"
    weekly      = "weekly"
    monthly     = "monthly"


class Report(Base):
    __tablename__ = "reports"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by      = Column(String, ForeignKey("users.id"), nullable=False)
    name            = Column(String(200), nullable=False)
    type            = Column(SAEnum(ReportType), nullable=False)
    schedule        = Column(SAEnum(ReportSchedule), default=ReportSchedule.once)
    # filters: {farm_ids, zone_ids, date_from, date_to, crop_types}
    filters         = Column(JSON, default=dict)
    # recipients: [email strings]
    recipients      = Column(JSON, default=list)
    last_generated_at = Column(DateTime(timezone=True), nullable=True)
    pdf_url         = Column(String, nullable=True)
    is_active       = Column(Boolean, default=True)
    # custom_widgets: for custom dashboard builder
    widgets         = Column(JSON, default=list)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", backref="reports")
    creator      = relationship("User", foreign_keys=[created_by])


# ─── DASHBOARD WIDGET ────────────────────────────────────────────
class DashboardWidget(Base):
    """User-customised Overview dashboard layout."""
    __tablename__ = "dashboard_widgets"
    id              = Column(String, primary_key=True, default=gen_uuid)
    user_id         = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    widget_type     = Column(String(80), nullable=False)   # yield_chart|sensor_heatmap|...
    title           = Column(String(100), nullable=True)
    config          = Column(JSON, default=dict)           # chart type, farm filter, etc.
    position_x      = Column(Integer, default=0)
    position_y      = Column(Integer, default=0)
    width           = Column(Integer, default=2)           # grid columns
    height          = Column(Integer, default=2)           # grid rows
    is_visible      = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])


# ══════════════════════════════════════════════════════════════════
# PHASE 4 — Ecosystem: Resellers · Compliance · Franchise
# ══════════════════════════════════════════════════════════════════

# ─── RESELLER ────────────────────────────────────────────────────

class ResellerStatus(str, enum.Enum):
    pending  = "pending"
    active   = "active"
    suspended = "suspended"
    terminated = "terminated"

class CommissionStatus(str, enum.Enum):
    pending  = "pending"
    approved = "approved"
    paid     = "paid"
    cancelled = "cancelled"


class Reseller(Base):
    """White-label reseller account. Each reseller manages sub-orgs."""
    __tablename__ = "resellers"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    organization_id     = Column(String, ForeignKey("organizations.id"), nullable=False, unique=True)
    company_name        = Column(String(200), nullable=False)
    contact_email       = Column(String(255), nullable=False)
    contact_phone       = Column(String(50), nullable=True)
    brand_name          = Column(String(200), nullable=True)   # white-label brand
    logo_url            = Column(String, nullable=True)
    custom_domain       = Column(String(255), nullable=True)
    commission_rate     = Column(Float, default=15.0)          # percentage 15–20
    custom_pricing      = Column(JSON, default=dict)           # plan_id -> custom price
    status              = Column(SAEnum(ResellerStatus), default=ResellerStatus.pending)
    onboarding_completed = Column(Boolean, default=False)
    notes               = Column(Text, nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    organization        = relationship("Organization", foreign_keys=[organization_id], backref="reseller_profile")
    client_orgs         = relationship("ResellerClient", back_populates="reseller")
    commissions         = relationship("ResellerCommission", back_populates="reseller")


class ResellerClient(Base):
    """Org referred/managed by a reseller."""
    __tablename__ = "reseller_clients"
    id              = Column(String, primary_key=True, default=gen_uuid)
    reseller_id     = Column(String, ForeignKey("resellers.id"), nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, unique=True)
    referred_at     = Column(DateTime(timezone=True), server_default=func.now())
    is_active       = Column(Boolean, default=True)

    reseller     = relationship("Reseller", back_populates="client_orgs")
    organization = relationship("Organization", foreign_keys=[organization_id])


class ResellerCommission(Base):
    """Monthly recurring commission record per client org."""
    __tablename__ = "reseller_commissions"
    id              = Column(String, primary_key=True, default=gen_uuid)
    reseller_id     = Column(String, ForeignKey("resellers.id"), nullable=False, index=True)
    client_org_id   = Column(String, ForeignKey("organizations.id"), nullable=False)
    month_key       = Column(String(7), nullable=False)          # "2027-03"
    plan            = Column(String(50), nullable=True)
    base_amount_inr = Column(Integer, nullable=False)            # subscription amount in paise
    commission_rate = Column(Float, nullable=False)
    commission_inr  = Column(Integer, nullable=False)            # earned amount in paise
    status          = Column(SAEnum(CommissionStatus), default=CommissionStatus.pending)
    paid_at         = Column(DateTime(timezone=True), nullable=True)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    reseller    = relationship("Reseller", back_populates="commissions")
    client_org  = relationship("Organization", foreign_keys=[client_org_id])

    __table_args__ = (
        UniqueConstraint("reseller_id", "client_org_id", "month_key", name="uq_commission_reseller_client_month"),
    )


# ─── COMPLIANCE & CERTIFICATION ───────────────────────────────────

class CertificationType(str, enum.Enum):
    organic     = "organic"
    fssai       = "fssai"
    globalgap   = "globalgap"
    export      = "export"
    iso22000    = "iso22000"
    haccp       = "haccp"
    other       = "other"

class CertificationStatus(str, enum.Enum):
    active   = "active"
    expired  = "expired"
    pending  = "pending"
    revoked  = "revoked"


class Certification(Base):
    """Tracks org certifications with expiry, documents, and renewal alerts."""
    __tablename__ = "certifications"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    cert_type       = Column(SAEnum(CertificationType), nullable=False)
    name            = Column(String(200), nullable=False)
    issuing_body    = Column(String(200), nullable=False)
    cert_number     = Column(String(100), nullable=True)
    issued_at       = Column(DateTime(timezone=True), nullable=True)
    expires_at      = Column(DateTime(timezone=True), nullable=True)
    status          = Column(SAEnum(CertificationStatus), default=CertificationStatus.active)
    document_url    = Column(String, nullable=True)         # stored certificate PDF
    notes           = Column(Text, nullable=True)
    # gap_results: {requirement: str, status: pass|fail|na, notes: str}[]
    gap_analysis    = Column(JSON, default=list)
    # audit_data: auto-populated from farm sensor records
    audit_data      = Column(JSON, default=dict)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization    = relationship("Organization", backref="certifications")


class ComplianceDocument(Base):
    """Document vault: store certs, lab reports, inspection reports."""
    __tablename__ = "compliance_documents"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    certification_id= Column(String, ForeignKey("certifications.id"), nullable=True)
    doc_type        = Column(String(80), nullable=False)    # certificate|lab_report|inspection|audit
    name            = Column(String(200), nullable=False)
    file_url        = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type       = Column(String(100), nullable=True)
    tags            = Column(JSON, default=list)
    expiry_date     = Column(DateTime(timezone=True), nullable=True)
    uploaded_by     = Column(String, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    organization  = relationship("Organization", backref="compliance_documents")
    certification = relationship("Certification", backref="documents")


# ─── FRANCHISE / MULTI-SITE ───────────────────────────────────────

class FranchiseGroup(Base):
    """Franchise HQ grouping multiple farm sites."""
    __tablename__ = "franchise_groups"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, unique=True)
    name            = Column(String(200), nullable=False)
    description     = Column(Text, nullable=True)
    hq_location     = Column(String(300), nullable=True)
    brand_color     = Column(String(10), nullable=True)    # hex color for map markers
    logo_url        = Column(String, nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization    = relationship("Organization", backref="franchise_group")
    sites           = relationship("FranchiseSite", back_populates="franchise_group")
    recipe_pushes   = relationship("FranchiseRecipePush", back_populates="franchise_group")


class FranchiseSite(Base):
    """A farm site belonging to a franchise group."""
    __tablename__ = "franchise_sites"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    franchise_group_id  = Column(String, ForeignKey("franchise_groups.id"), nullable=False, index=True)
    organization_id     = Column(String, ForeignKey("organizations.id"), nullable=False)
    farm_id             = Column(String, ForeignKey("farms.id"), nullable=True)
    site_code           = Column(String(20), nullable=False)
    display_name        = Column(String(200), nullable=False)
    manager_name        = Column(String(200), nullable=True)
    manager_email       = Column(String(255), nullable=True)
    city                = Column(String(100), nullable=True)
    state               = Column(String(100), nullable=True)
    latitude            = Column(Float, nullable=True)
    longitude           = Column(Float, nullable=True)
    is_active           = Column(Boolean, default=True)
    # benchmark_scores: {yield_efficiency, energy_use, quality_score, rank}
    benchmark_scores    = Column(JSON, default=dict)
    last_synced_at      = Column(DateTime(timezone=True), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    franchise_group = relationship("FranchiseGroup", back_populates="sites")
    organization    = relationship("Organization", foreign_keys=[organization_id])
    farm            = relationship("Farm", foreign_keys=[farm_id])


class FranchiseRecipePush(Base):
    """HQ pushes standardised grow recipes to franchise sites."""
    __tablename__ = "franchise_recipe_pushes"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    franchise_group_id  = Column(String, ForeignKey("franchise_groups.id"), nullable=False, index=True)
    recipe_id           = Column(String, ForeignKey("crop_recipes.id"), nullable=False)
    pushed_by           = Column(String, ForeignKey("users.id"), nullable=False)
    target_site_ids     = Column(JSON, default=list)     # [] = all sites
    push_notes          = Column(Text, nullable=True)
    status              = Column(String(30), default="pushed")   # pushed|acknowledged|applied
    acknowledged_count  = Column(Integer, default=0)
    applied_count       = Column(Integer, default=0)
    pushed_at           = Column(DateTime(timezone=True), server_default=func.now())

    franchise_group = relationship("FranchiseGroup", back_populates="recipe_pushes")
    recipe          = relationship("CropRecipe", foreign_keys=[recipe_id])
    pusher          = relationship("User", foreign_keys=[pushed_by])


class FranchiseConfigPush(Base):
    """HQ pushes zone target configurations to all sites."""
    __tablename__ = "franchise_config_pushes"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    franchise_group_id  = Column(String, ForeignKey("franchise_groups.id"), nullable=False, index=True)
    pushed_by           = Column(String, ForeignKey("users.id"), nullable=False)
    config_type         = Column(String(50), nullable=False)   # zone_targets|alerts|thresholds
    config_payload      = Column(JSON, nullable=False)
    target_site_ids     = Column(JSON, default=list)
    description         = Column(String(300), nullable=True)
    status              = Column(String(30), default="pending")
    applied_count       = Column(Integer, default=0)
    pushed_at           = Column(DateTime(timezone=True), server_default=func.now())

    franchise_group = relationship("FranchiseGroup", foreign_keys=[franchise_group_id])
    pusher          = relationship("User", foreign_keys=[pushed_by])


# ══════════════════════════════════════════════════════════════════
# FEATURE 12 — MULTI-FARM MARKETPLACE (B2B Network)
# ══════════════════════════════════════════════════════════════════

class BuyerType(str, enum.Enum):
    restaurant   = "restaurant"
    retailer     = "retailer"
    distributor  = "distributor"
    institution  = "institution"   # hospitals, schools, catering
    individual   = "individual"

class BuyerStatus(str, enum.Enum):
    pending   = "pending"
    verified  = "verified"
    suspended = "suspended"

class ProduceGrade(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"

class ListingStatus(str, enum.Enum):
    active    = "active"
    sold_out  = "sold_out"
    expired   = "expired"
    withdrawn = "withdrawn"

class OrderStatus(str, enum.Enum):
    pending    = "pending"      # buyer placed order, awaiting farm confirm
    confirmed  = "confirmed"    # farm accepted
    packed     = "packed"       # produce packed, awaiting pickup
    shipped    = "shipped"      # in transit
    delivered  = "delivered"    # buyer confirmed delivery
    cancelled  = "cancelled"
    disputed   = "disputed"

class PaymentStatus(str, enum.Enum):
    unpaid    = "unpaid"
    held      = "held"          # funds in escrow
    released  = "released"      # released to farm after delivery confirmed
    refunded  = "refunded"

class EscrowStatus(str, enum.Enum):
    pending   = "pending"
    held      = "held"
    released  = "released"
    refunded  = "refunded"


class Buyer(Base):
    """
    Separate buyer account — restaurants, retailers, distributors.
    Deliberately separate from farm User accounts.
    """
    __tablename__ = "marketplace_buyers"
    id              = Column(String, primary_key=True, default=gen_uuid)
    email           = Column(String(255), unique=True, nullable=False)
    full_name       = Column(String(200), nullable=False)
    company_name    = Column(String(200), nullable=True)
    buyer_type      = Column(SAEnum(BuyerType), default=BuyerType.restaurant)
    phone           = Column(String(30), nullable=True)
    gst_number      = Column(String(20), nullable=True)
    fssai_number    = Column(String(30), nullable=True)
    delivery_address= Column(Text, nullable=True)
    city            = Column(String(100), nullable=True)
    state           = Column(String(100), nullable=True)
    pincode         = Column(String(10), nullable=True)
    status          = Column(SAEnum(BuyerStatus), default=BuyerStatus.pending)
    password_hash   = Column(String, nullable=True)     # optional auth
    verified_at     = Column(DateTime(timezone=True), nullable=True)
    total_orders    = Column(Integer, default=0)
    total_spent_paise = Column(Integer, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    listings_ordered = relationship("MarketplaceOrder", back_populates="buyer", foreign_keys="MarketplaceOrder.buyer_id")


class ProduceListing(Base):
    """
    Farm posts available produce for B2B sale.
    Linked to a harvest batch for full traceability.
    """
    __tablename__ = "produce_listings"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    farm_id         = Column(String, ForeignKey("farms.id"), nullable=True)
    harvest_id      = Column(String, ForeignKey("harvest_logs.id"), nullable=True)
    posted_by       = Column(String, ForeignKey("users.id"), nullable=False)

    crop_name       = Column(String(200), nullable=False)
    variety         = Column(String(100), nullable=True)
    grade           = Column(SAEnum(ProduceGrade), default=ProduceGrade.A)
    description     = Column(Text, nullable=True)

    quantity_kg     = Column(Float, nullable=False)         # total available
    reserved_kg     = Column(Float, default=0.0)            # held by pending/confirmed orders
    sold_kg         = Column(Float, default=0.0)
    min_order_kg    = Column(Float, default=1.0)
    max_order_kg    = Column(Float, nullable=True)

    price_per_kg_paise = Column(Integer, nullable=False)    # in paise (INR * 100)
    bulk_discount_pct  = Column(Float, default=0.0)         # e.g. 5% off orders > 50kg
    bulk_threshold_kg  = Column(Float, default=50.0)

    available_from  = Column(DateTime(timezone=True), nullable=True)
    available_until = Column(DateTime(timezone=True), nullable=True)

    certifications  = Column(JSON, default=list)            # ["organic", "fssai"]
    packaging       = Column(String(100), nullable=True)    # "5kg bag", "10kg crate"
    storage_temp_c  = Column(Float, nullable=True)
    shelf_life_days = Column(Integer, nullable=True)
    origin_city     = Column(String(100), nullable=True)
    origin_state    = Column(String(100), nullable=True)

    images          = Column(JSON, default=list)            # list of image URLs
    status          = Column(SAEnum(ListingStatus), default=ListingStatus.active)
    view_count      = Column(Integer, default=0)

    # VertiFarm platform commission (2–3%)
    platform_commission_pct = Column(Float, default=2.5)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization    = relationship("Organization", backref="produce_listings")
    farm            = relationship("Farm", foreign_keys=[farm_id], backref="produce_listings")
    harvest         = relationship("HarvestLog", foreign_keys=[harvest_id], backref="produce_listings")
    poster          = relationship("User", foreign_keys=[posted_by])
    orders          = relationship("MarketplaceOrder", back_populates="listing")


class MarketplaceOrder(Base):
    """
    Buyer places an order against a ProduceListing.
    Escrow payment held until delivery confirmed.
    """
    __tablename__ = "marketplace_orders"
    id              = Column(String, primary_key=True, default=gen_uuid)
    order_number    = Column(String(30), unique=True, nullable=False)   # ORD-2027-000001
    listing_id      = Column(String, ForeignKey("produce_listings.id"), nullable=False, index=True)
    buyer_id        = Column(String, ForeignKey("marketplace_buyers.id"), nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)  # seller org

    quantity_kg     = Column(Float, nullable=False)
    price_per_kg_paise = Column(Integer, nullable=False)    # locked at order time
    subtotal_paise  = Column(Integer, nullable=False)       # qty * price
    discount_paise  = Column(Integer, default=0)
    platform_fee_paise = Column(Integer, default=0)         # 2–3% of subtotal
    tax_paise       = Column(Integer, default=0)            # GST if applicable
    total_paise     = Column(Integer, nullable=False)

    status          = Column(SAEnum(OrderStatus), default=OrderStatus.pending)
    payment_status  = Column(SAEnum(PaymentStatus), default=PaymentStatus.unpaid)

    # Payment gateway refs
    payment_gateway = Column(String(20), nullable=True)     # "razorpay" | "stripe"
    gateway_order_id= Column(String(100), nullable=True)
    gateway_payment_id = Column(String(100), nullable=True)

    # Delivery
    delivery_address    = Column(Text, nullable=True)
    delivery_city       = Column(String(100), nullable=True)
    delivery_pincode    = Column(String(10), nullable=True)
    requested_delivery_date = Column(DateTime(timezone=True), nullable=True)
    actual_delivery_date    = Column(DateTime(timezone=True), nullable=True)
    tracking_number     = Column(String(100), nullable=True)
    tracking_url        = Column(String, nullable=True)
    logistics_partner   = Column(String(100), nullable=True)

    # Confirmation
    delivery_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    delivery_confirmed_by = Column(String, nullable=True)   # buyer name/email
    buyer_notes         = Column(Text, nullable=True)
    seller_notes        = Column(Text, nullable=True)

    # Invoice
    invoice_number  = Column(String(30), nullable=True)     # INV-2027-000001
    invoice_url     = Column(String, nullable=True)

    cancelled_at    = Column(DateTime(timezone=True), nullable=True)
    cancel_reason   = Column(Text, nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    listing         = relationship("ProduceListing", back_populates="orders")
    buyer           = relationship("Buyer", back_populates="listings_ordered", foreign_keys=[buyer_id])
    organization    = relationship("Organization", foreign_keys=[organization_id])
    escrow          = relationship("MarketplaceEscrow", back_populates="order", uselist=False)


class MarketplaceEscrow(Base):
    """
    Escrow record: funds held by platform until buyer confirms delivery.
    Released to farm within 24–48h of delivery confirmation.
    """
    __tablename__ = "marketplace_escrows"
    id              = Column(String, primary_key=True, default=gen_uuid)
    order_id        = Column(String, ForeignKey("marketplace_orders.id"), nullable=False, unique=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)

    gross_paise     = Column(Integer, nullable=False)       # total paid by buyer
    platform_fee_paise = Column(Integer, nullable=False)    # VertiFarm 2–3%
    net_paise       = Column(Integer, nullable=False)       # gross - platform_fee

    status          = Column(SAEnum(EscrowStatus), default=EscrowStatus.pending)
    gateway         = Column(String(20), nullable=True)
    gateway_txn_id  = Column(String(100), nullable=True)

    held_at         = Column(DateTime(timezone=True), nullable=True)
    released_at     = Column(DateTime(timezone=True), nullable=True)
    refunded_at     = Column(DateTime(timezone=True), nullable=True)
    release_notes   = Column(Text, nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    order           = relationship("MarketplaceOrder", back_populates="escrow")
    organization    = relationship("Organization", foreign_keys=[organization_id])


# ══════════════════════════════════════════════════════════════════
# FIX 1 — Persistent DB models replacing in-memory stores
# ══════════════════════════════════════════════════════════════════

# ─── INVENTORY ITEM ───────────────────────────────────────────────
class InventoryItem(Base):
    """Persistent replacement for _inventory_store list in management.py"""
    __tablename__ = "inventory_items"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    name            = Column(String(200), nullable=False)
    category        = Column(String(100), default="Nutrients")
    unit            = Column(String(30), default="kg")
    quantity        = Column(Float, default=0.0)
    min_stock       = Column(Float, default=0.0)
    reorder_qty     = Column(Float, default=0.0)
    cost_per_unit   = Column(Float, default=0.0)
    supplier        = Column(String(200), nullable=True)
    sku             = Column(String(100), nullable=True)
    location        = Column(String(200), nullable=True)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", backref="inventory_items")

    __table_args__ = (
        Index("ix_inventory_org_category", "organization_id", "category"),
    )


# ─── SOP (Standard Operating Procedure) ──────────────────────────
class SOP(Base):
    """Persistent replacement for _sop_store list in management.py"""
    __tablename__ = "sops"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    title           = Column(String(300), nullable=False)
    category        = Column(String(100), default="Operations")
    frequency       = Column(String(100), default="As needed")
    department      = Column(String(100), default="Operations")
    version         = Column(String(20), default="1.0")
    status          = Column(String(20), default="active")   # active|archived|draft
    steps           = Column(JSON, default=list)             # List[str]
    tags            = Column(JSON, default=list)             # List[str]
    created_by_id   = Column(String, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", backref="sops")
    creator      = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("ix_sop_org_category", "organization_id", "category"),
    )


# ─── INTEGRATION CONNECTION ───────────────────────────────────────
class IntegrationConnection(Base):
    """Persistent replacement for _connected_store dict in management.py"""
    __tablename__ = "integration_connections"
    id                  = Column(String, primary_key=True, default=gen_uuid)
    organization_id     = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    integration_id      = Column(String(80), nullable=False)     # "aws-iot", "slack", etc.
    integration_name    = Column(String(200), nullable=False)
    status              = Column(String(30), default="healthy")  # healthy|error|disconnected
    # Encrypted credentials — never stored in plaintext
    config              = Column(JSON, default=dict)              # non-secret public config
    credentials_json    = Column(Text, nullable=True)            # Fernet-encrypted JSON
    events_today        = Column(Integer, default=0)
    last_synced_at      = Column(DateTime(timezone=True), nullable=True)
    last_error          = Column(Text, nullable=True)
    connected_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", backref="integration_connections")

    __table_args__ = (
        UniqueConstraint("organization_id", "integration_id",
                         name="uq_integration_conn_org_integ"),
    )


# ─── WIDGET LAYOUT (Dashboard Builder) ────────────────────────────
class WidgetLayout(Base):
    """Persistent replacement for _widget_store dict in management.py"""
    __tablename__ = "widget_layouts"
    id              = Column(String, primary_key=True, default=gen_uuid)
    user_id         = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    widget_type     = Column(String(80), nullable=False)
    title           = Column(String(100), nullable=True)
    config          = Column(JSON, default=dict)
    position_x      = Column(Integer, default=0)
    position_y      = Column(Integer, default=0)
    width           = Column(Integer, default=2)
    height          = Column(Integer, default=2)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])


# ─── GROW JOURNAL ENTRY ───────────────────────────────────────────
class GrowJournalEntry(Base):
    """Persistent replacement for _journal_store list in management.py"""
    __tablename__ = "grow_journal_entries"
    id              = Column(String, primary_key=True, default=gen_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    author_id       = Column(String, ForeignKey("users.id"), nullable=False)
    type            = Column(String(50), default="observation")  # observation|issue|action|milestone
    title           = Column(String(300), nullable=False)
    body            = Column(Text, default="")
    batch_code      = Column(String(50), nullable=True, index=True)
    zone_id         = Column(String, ForeignKey("zones.id"), nullable=True)
    tags            = Column(JSON, default=list)
    severity        = Column(String(20), default="info")         # info|warning|critical
    sensors         = Column(JSON, nullable=True)                # snapshot of sensor readings
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", backref="grow_journal_entries")
    author       = relationship("User", foreign_keys=[author_id])
    zone         = relationship("Zone", foreign_keys=[zone_id])

    __table_args__ = (
        Index("ix_journal_org_created", "organization_id", "created_at"),
    )


# ─── AUDIT LOG (Enterprise — Event Sourcing) ──────────────────────
class AuditLog(Base):
    """
    Immutable append-only audit trail for every mutating action in the system.
    Covers auth events, CRUD on farms/zones/crops/devices, billing changes,
    team membership changes, compliance actions, and AI interactions.
    """
    __tablename__ = "audit_logs"

    id              = Column(String,  primary_key=True, default=gen_uuid)
    organization_id = Column(String,  ForeignKey("organizations.id"), nullable=True, index=True)
    actor_id        = Column(String,  ForeignKey("users.id"),         nullable=True, index=True)
    actor_email     = Column(String(255), nullable=True)            # denormalised — survives user deletion
    actor_role      = Column(String(50),  nullable=True)
    # What happened
    event_type      = Column(String(100), nullable=False, index=True)  # e.g. "farm.create"
    event_category  = Column(String(50),  nullable=False, index=True)  # auth|farm|zone|crop|device|billing|team|compliance|ai|api
    resource_type   = Column(String(80),  nullable=True)               # "Farm", "Zone", "User" …
    resource_id     = Column(String,      nullable=True, index=True)
    resource_name   = Column(String(200), nullable=True)               # human-readable label
    # Payload
    before_state    = Column(JSON, nullable=True)   # snapshot before mutation
    after_state     = Column(JSON, nullable=True)   # snapshot after mutation
    delta           = Column(JSON, nullable=True)   # just the changed fields
    metadata_json   = Column(JSON, default=dict)    # extra context (IP, user-agent, etc.)
    # Outcome
    status          = Column(String(20), default="success")  # success | failure | partial
    error_detail    = Column(Text, nullable=True)
    # Context
    ip_address      = Column(String(45),  nullable=True)
    user_agent      = Column(String(500), nullable=True)
    request_id      = Column(String(36),  nullable=True, index=True)
    # Timestamp — never updated; immutable row
    created_at      = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    organization = relationship("Organization", backref="audit_logs")
    actor        = relationship("User", foreign_keys=[actor_id], backref="audit_actions")

    __table_args__ = (
        Index("ix_audit_org_created",    "organization_id", "created_at"),
        Index("ix_audit_actor_created",  "actor_id",        "created_at"),
        Index("ix_audit_event_created",  "event_type",      "created_at"),
        Index("ix_audit_resource",       "resource_type",   "resource_id"),
    )
