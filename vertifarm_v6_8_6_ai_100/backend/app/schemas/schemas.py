from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from app.models.models import UserRole, FarmType, ZoneStatus, AlertSeverity, CropStatus, DeviceStatus


# ─── AUTH ─────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── USER ─────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.operator
    organization_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    preferences: Optional[Dict] = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    is_superuser: bool
    organization_id: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── ORGANIZATION ─────────────────────────────────────────────────────────────
class OrgCreate(BaseModel):
    name: str
    slug: str
    plan: str = "starter"


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    settings: Optional[Dict] = None


class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    logo_url: Optional[str] = None
    settings: Optional[Dict] = None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── FARM ─────────────────────────────────────────────────────────────────────
class FarmCreate(BaseModel):
    name: str
    code: str
    type: FarmType = FarmType.rack
    location: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str = "Asia/Kolkata"
    area_sqm: Optional[float] = None
    notes: Optional[str] = None
    organization_id: Optional[str] = None   # auto-filled from current user in endpoint

    @field_validator("code")
    @classmethod
    def code_upper(cls, v: str) -> str:
        return v.strip().upper()


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[FarmType] = None
    location: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    timezone: Optional[str] = None
    area_sqm: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    settings: Optional[Dict] = None


class FarmOut(BaseModel):
    id: str
    name: str
    code: str
    type: FarmType
    location: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str = "Asia/Kolkata"
    area_sqm: Optional[float] = None
    notes: Optional[str] = None
    organization_id: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── ZONE ─────────────────────────────────────────────────────────────────────
class ZoneCreate(BaseModel):
    name: str
    code: str
    farm_id: str
    status: ZoneStatus = ZoneStatus.idle
    rack_count: int = 1
    level_count: int = 4
    area_sqm: Optional[float] = None
    target_temp: float = 22.0
    target_humidity: float = 65.0
    target_co2: float = 1000.0
    target_ph: float = 6.0
    target_ec: float = 2.0
    target_ppfd: float = 280.0
    notes: Optional[str] = None

    @field_validator("code")
    @classmethod
    def code_upper(cls, v: str) -> str:
        return v.strip().upper()


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[ZoneStatus] = None
    rack_count: Optional[int] = None
    level_count: Optional[int] = None
    area_sqm: Optional[float] = None
    target_temp: Optional[float] = None
    target_humidity: Optional[float] = None
    target_co2: Optional[float] = None
    target_ph: Optional[float] = None
    target_ec: Optional[float] = None
    target_ppfd: Optional[float] = None
    notes: Optional[str] = None


class ZoneOut(BaseModel):
    id: str
    name: str
    code: str
    farm_id: str
    status: ZoneStatus
    rack_count: int
    level_count: int
    area_sqm: Optional[float] = None
    target_temp: float
    target_humidity: float
    target_co2: float
    target_ph: float
    target_ec: float
    target_ppfd: float
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── SENSOR ───────────────────────────────────────────────────────────────────
class SensorReadingCreate(BaseModel):
    zone_id: str
    device_id: Optional[str] = None
    sensor_type: str
    value: float
    unit: Optional[str] = None


class SensorReadingOut(BaseModel):
    id: str
    zone_id: str
    sensor_type: str
    value: float
    unit: Optional[str] = None
    timestamp: datetime
    model_config = {"from_attributes": True}


class SensorSummary(BaseModel):
    zone_id: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    co2: Optional[float] = None
    ph: Optional[float] = None
    ec: Optional[float] = None
    ppfd: Optional[float] = None
    vpd: Optional[float] = None
    water_temp: Optional[float] = None
    dissolved_oxygen: Optional[float] = None
    pressure: Optional[float] = None
    updated_at: Optional[datetime] = None


# ─── ALERT ────────────────────────────────────────────────────────────────────
class AlertCreate(BaseModel):
    farm_id: str
    zone_id: Optional[str] = None
    device_id: Optional[str] = None
    severity: AlertSeverity = AlertSeverity.info
    category: str
    title: str
    message: str
    alert_metadata: Dict = {}


class AlertOut(BaseModel):
    id: str
    farm_id: str
    zone_id: Optional[str] = None
    severity: AlertSeverity
    category: str
    title: str
    message: str
    is_resolved: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── CROP ─────────────────────────────────────────────────────────────────────
class CropCreate(BaseModel):
    batch_code: str
    name: str
    farm_id: str
    zone_id: Optional[str] = None
    recipe_id: Optional[str] = None
    planted_at: Optional[datetime] = None
    notes: Optional[str] = None

    @field_validator("batch_code")
    @classmethod
    def batch_upper(cls, v: str) -> str:
        return v.strip().upper()


class CropUpdate(BaseModel):
    status: Optional[CropStatus] = None
    zone_id: Optional[str] = None
    recipe_id: Optional[str] = None
    expected_harvest: Optional[datetime] = None
    actual_yield_kg: Optional[float] = None
    quality_score: Optional[float] = None
    notes: Optional[str] = None


class CropOut(BaseModel):
    id: str
    batch_code: str
    name: str
    farm_id: str
    zone_id: Optional[str] = None
    status: CropStatus
    planted_at: Optional[datetime] = None
    expected_harvest: Optional[datetime] = None
    actual_yield_kg: Optional[float] = None
    quality_score: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── RECIPE ───────────────────────────────────────────────────────────────────
class RecipeCreate(BaseModel):
    name: str
    crop_type: str
    variety: Optional[str] = None
    grow_days: int
    phases: List[Dict] = []
    expected_yield_kg: Optional[float] = None
    notes: Optional[str] = None
    is_public: bool = True
    farm_type_tag: Optional[str] = None


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    grow_days: Optional[int] = None
    phases: Optional[List[Dict]] = None
    expected_yield_kg: Optional[float] = None
    notes: Optional[str] = None
    is_public: Optional[bool] = None


class RecipeOut(BaseModel):
    id: str
    name: str
    crop_type: str
    variety: Optional[str] = None
    grow_days: int
    phases: List[Dict]
    expected_yield_kg: Optional[float] = None
    notes: Optional[str] = None
    is_public: bool
    farm_type_tag: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── DEVICE ───────────────────────────────────────────────────────────────────
class DeviceCreate(BaseModel):
    name: str
    device_type: str
    device_uid: str
    farm_id: str
    zone_id: Optional[str] = None
    protocol: str = "mqtt"
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    firmware_version: Optional[str] = None
    config: Dict = {}
    notes: Optional[str] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    zone_id: Optional[str] = None
    status: Optional[DeviceStatus] = None
    firmware_version: Optional[str] = None
    ip_address: Optional[str] = None
    config: Optional[Dict] = None
    notes: Optional[str] = None


class DeviceOut(BaseModel):
    id: str
    name: str
    device_type: str
    device_uid: str
    farm_id: str
    zone_id: Optional[str] = None
    status: DeviceStatus
    firmware_version: Optional[str] = None
    protocol: str
    ip_address: Optional[str] = None
    last_seen: Optional[datetime] = None
    config: Dict = {}
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── AUTOMATION ───────────────────────────────────────────────────────────────
class RuleCreate(BaseModel):
    name: str
    farm_id: str
    zone_id: Optional[str] = None
    trigger_type: str
    conditions: List[Dict] = []
    actions: List[Dict] = []
    priority: int = 5


class RuleOut(BaseModel):
    id: str
    name: str
    farm_id: str
    zone_id: Optional[str] = None
    is_active: bool
    trigger_type: str
    conditions: List[Dict]
    actions: List[Dict]
    priority: int
    last_triggered: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── HARVEST LOG ──────────────────────────────────────────────────────────────
class HarvestLogCreate(BaseModel):
    crop_id: str
    farm_id: str
    zone_id: Optional[str] = None
    weight_kg: float
    quality_grade: Optional[str] = None   # A|B|C
    notes: Optional[str] = None


class HarvestLogOut(BaseModel):
    id: str
    crop_id: str
    farm_id: str
    zone_id: Optional[str] = None
    weight_kg: float
    quality_grade: Optional[str] = None
    notes: Optional[str] = None
    harvested_at: datetime
    model_config = {"from_attributes": True}


# ─── DASHBOARD ────────────────────────────────────────────────────────────────
class DashboardStats(BaseModel):
    # ── Core counts — always real integers (0 for new orgs) ──────
    total_farms: int = 0
    total_zones: int = 0
    total_devices: int = 0
    online_devices: int = 0
    active_alerts: int = 0
    critical_alerts: int = 0
    total_crops: int = 0
    ready_to_harvest: int = 0
    # ── Harvest-log derived — real from DB (0 until first harvest) ─
    today_yield_kg: float = 0.0
    monthly_yield_kg: float = 0.0
    # ── Sensor-derived — None until IoT pipeline connected (FIX-4) ─
    # Frontend displays "—" when these are None instead of fake data.
    water_efficiency_pct: Optional[float] = None
    energy_today_kwh: Optional[float] = None
    ai_forecast_yield_kg: Optional[float] = None
    sustainability_score: Optional[float] = None


# ─── PAGINATION ───────────────────────────────────────────────────────────────
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int


# ─── SIGNUP (Phase 1) ────────────────────────────────────────────────────────
class SignupResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"
    org: "OrgOut"
    trial_ends_at: Optional[datetime] = None
    email_verification_required: bool = True


# ── Traceability ─────────────────────────────────────────────────
class TraceabilityCreate(BaseModel):
    batch_code:      str
    crop_id:         Optional[str] = None
    farm_name:       str
    zone:            Optional[str] = None
    grow_method:     Optional[str] = "NFT Hydroponics"
    nutrients_used:  Optional[List[str]] = []
    water_source:    Optional[str] = "RO Water"
    certifications:  Optional[List[str]] = []
    test_results:    Optional[dict] = {}
    sow_date:        Optional[datetime] = None
    harvest_date:    Optional[datetime] = None
    is_public:       Optional[bool] = True

class TraceabilityOut(BaseModel):
    id:              str
    batch_code:      str
    crop_id:         Optional[str]
    farm_name:       str
    zone:            Optional[str]
    grow_method:     Optional[str]
    nutrients_used:  Optional[List[str]]
    water_source:    Optional[str]
    certifications:  Optional[List[str]]
    test_results:    Optional[dict]
    sow_date:        Optional[datetime]
    harvest_date:    Optional[datetime]
    qr_code_url:     Optional[str]
    pdf_url:         Optional[str]
    is_public:       Optional[bool]
    created_at:      datetime

    class Config:
        from_attributes = True
