from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta
from app.models.models import (
    Base, User, Organization, Farm, Zone, CropRecipe, Device, PlanLimit, PlanTier, Subscription, SubStatus,
    FarmType, UserRole, DeviceStatus, ZoneStatus,
    Crop, CropStatus, SensorReading, Alert, AlertSeverity, HarvestLog,
)
from app.core.security import get_password_hash
from app.core.config import settings
from app.db.session import engine
import logging

logger = logging.getLogger(__name__)


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True))
    logger.info("Database tables created.")


# ─── Per-farm-type zone templates ────────────────────────────────────────────
# Each farm type has distinct grow structures, dimensions, and environmental targets.

FARM_ZONE_CONFIGS = {

    # ── HYDROPONIC (NFW/DWC channels, horizontal, large area) ───────────────
    FarmType.rack: {
        "zones": [
            {"name":"Butterhead Lettuce — Bay A","code":"A1","rack_count":6,"level_count":4,"area_sqm":180,
             "target_temp":22.0,"target_humidity":65.0,"target_co2":1100,"target_ph":6.2,"target_ec":1.8,"target_ppfd":280,"status":ZoneStatus.active},
            {"name":"Oakleaf Lettuce — Bay B","code":"A2","rack_count":6,"level_count":4,"area_sqm":180,
             "target_temp":22.5,"target_humidity":65.0,"target_co2":1100,"target_ph":6.2,"target_ec":1.6,"target_ppfd":260,"status":ZoneStatus.active},
            {"name":"Lollo Rosso — Bay C","code":"A3","rack_count":5,"level_count":4,"area_sqm":150,
             "target_temp":21.0,"target_humidity":68.0,"target_co2":1000,"target_ph":6.0,"target_ec":1.5,"target_ppfd":250,"status":ZoneStatus.active},
            {"name":"Baby Spinach — Bay D","code":"B1","rack_count":5,"level_count":4,"area_sqm":150,
             "target_temp":18.0,"target_humidity":70.0,"target_co2":950,"target_ph":6.0,"target_ec":2.0,"target_ppfd":220,"status":ZoneStatus.active},
            {"name":"Swiss Chard — Bay E","code":"B2","rack_count":4,"level_count":3,"area_sqm":120,
             "target_temp":20.0,"target_humidity":67.0,"target_co2":1000,"target_ph":6.2,"target_ec":2.2,"target_ppfd":240,"status":ZoneStatus.maintenance},
            {"name":"Kale — Bay F","code":"B3","rack_count":4,"level_count":3,"area_sqm":120,
             "target_temp":18.0,"target_humidity":70.0,"target_co2":900,"target_ph":6.3,"target_ec":2.5,"target_ppfd":280,"status":ZoneStatus.active},
            {"name":"Arugula — Bay G","code":"C1","rack_count":4,"level_count":4,"area_sqm":130,
             "target_temp":20.0,"target_humidity":65.0,"target_co2":1050,"target_ph":6.1,"target_ec":1.4,"target_ppfd":230,"status":ZoneStatus.active},
            {"name":"Herbs Mix — Bay H","code":"C2","rack_count":3,"level_count":4,"area_sqm":90,
             "target_temp":22.0,"target_humidity":65.0,"target_co2":1100,"target_ph":6.0,"target_ec":1.8,"target_ppfd":260,"status":ZoneStatus.active},
            {"name":"Microgreens — Bay I","code":"D1","rack_count":3,"level_count":5,"area_sqm":85,
             "target_temp":21.0,"target_humidity":75.0,"target_co2":900,"target_ph":6.0,"target_ec":1.2,"target_ppfd":180,"status":ZoneStatus.active},
            {"name":"Seedling Nursery","code":"N1","rack_count":2,"level_count":5,"area_sqm":60,
             "target_temp":23.0,"target_humidity":78.0,"target_co2":800,"target_ph":5.8,"target_ec":0.8,"target_ppfd":120,"status":ZoneStatus.active},
        ]
    },

    # ── NFT (Nutrient Film Technique — channels on inclined gutters) ──────────
    FarmType.nft: {
        "zones": [
            {"name":"NFT Channel 01 — Lettuce","code":"N1","rack_count":8,"level_count":2,"area_sqm":200,
             "target_temp":21.0,"target_humidity":63.0,"target_co2":1050,"target_ph":6.0,"target_ec":1.6,"target_ppfd":270,"status":ZoneStatus.active},
            {"name":"NFT Channel 02 — Spinach","code":"N2","rack_count":8,"level_count":2,"area_sqm":200,
             "target_temp":18.0,"target_humidity":68.0,"target_co2":950,"target_ph":6.1,"target_ec":2.0,"target_ppfd":220,"status":ZoneStatus.active},
            {"name":"NFT Channel 03 — Basil","code":"N3","rack_count":6,"level_count":2,"area_sqm":150,
             "target_temp":25.0,"target_humidity":66.0,"target_co2":1100,"target_ph":6.2,"target_ec":2.2,"target_ppfd":300,"status":ZoneStatus.active},
            {"name":"NFT Channel 04 — Mint","code":"N4","rack_count":6,"level_count":2,"area_sqm":150,
             "target_temp":22.0,"target_humidity":68.0,"target_co2":1000,"target_ph":6.0,"target_ec":2.0,"target_ppfd":260,"status":ZoneStatus.active},
            {"name":"NFT Channel 05 — Coriander","code":"N5","rack_count":5,"level_count":2,"area_sqm":120,
             "target_temp":22.0,"target_humidity":65.0,"target_co2":1000,"target_ph":6.1,"target_ec":1.8,"target_ppfd":250,"status":ZoneStatus.active},
            {"name":"NFT Channel 06 — Arugula","code":"N6","rack_count":5,"level_count":2,"area_sqm":120,
             "target_temp":19.0,"target_humidity":65.0,"target_co2":1000,"target_ph":6.0,"target_ec":1.4,"target_ppfd":230,"status":ZoneStatus.active},
            {"name":"NFT Channel 07 — Watercress","code":"N7","rack_count":4,"level_count":2,"area_sqm":100,
             "target_temp":16.0,"target_humidity":75.0,"target_co2":900,"target_ph":5.8,"target_ec":1.6,"target_ppfd":200,"status":ZoneStatus.idle},
            {"name":"Germination Bay","code":"G1","rack_count":2,"level_count":4,"area_sqm":50,
             "target_temp":23.0,"target_humidity":80.0,"target_co2":800,"target_ph":5.8,"target_ec":0.6,"target_ppfd":100,"status":ZoneStatus.active},
        ]
    },

    # ── AEROPONIC (high-pressure mist, vertical towers/panels) ────────────────
    FarmType.aeroponic: {
        "zones": [
            {"name":"Aero Tower A — Leafy Greens","code":"T1","rack_count":12,"level_count":6,"area_sqm":80,
             "target_temp":22.0,"target_humidity":70.0,"target_co2":1200,"target_ph":5.8,"target_ec":2.0,"target_ppfd":320,"status":ZoneStatus.active},
            {"name":"Aero Tower B — Herbs","code":"T2","rack_count":12,"level_count":6,"area_sqm":80,
             "target_temp":24.0,"target_humidity":68.0,"target_co2":1200,"target_ph":5.9,"target_ec":2.2,"target_ppfd":300,"status":ZoneStatus.active},
            {"name":"Aero Tower C — Strawberry","code":"T3","rack_count":10,"level_count":6,"area_sqm":70,
             "target_temp":18.0,"target_humidity":65.0,"target_co2":1000,"target_ph":5.8,"target_ec":1.8,"target_ppfd":350,"status":ZoneStatus.active},
            {"name":"Aero Tower D — Spinach","code":"T4","rack_count":10,"level_count":6,"area_sqm":70,
             "target_temp":16.0,"target_humidity":72.0,"target_co2":900,"target_ph":6.0,"target_ec":2.0,"target_ppfd":220,"status":ZoneStatus.active},
            {"name":"Aero Tower E — Kale","code":"T5","rack_count":8,"level_count":6,"area_sqm":55,
             "target_temp":17.0,"target_humidity":70.0,"target_co2":950,"target_ph":6.2,"target_ec":2.5,"target_ppfd":270,"status":ZoneStatus.active},
            {"name":"Aero Research Bay","code":"R1","rack_count":4,"level_count":6,"area_sqm":30,
             "target_temp":21.0,"target_humidity":70.0,"target_co2":1200,"target_ph":5.9,"target_ec":1.5,"target_ppfd":280,"status":ZoneStatus.active},
            {"name":"Aero Nursery","code":"N1","rack_count":3,"level_count":4,"area_sqm":25,
             "target_temp":23.0,"target_humidity":80.0,"target_co2":800,"target_ph":5.7,"target_ec":0.5,"target_ppfd":100,"status":ZoneStatus.active},
        ]
    },

    # ── DWC (Deep Water Culture — large raft/float beds) ─────────────────────
    FarmType.dwc: {
        "zones": [
            {"name":"DWC Raft Bed 1 — Lettuce Mix","code":"R1","rack_count":1,"level_count":1,"area_sqm":200,
             "target_temp":20.0,"target_humidity":65.0,"target_co2":1000,"target_ph":5.9,"target_ec":1.6,"target_ppfd":250,"status":ZoneStatus.active},
            {"name":"DWC Raft Bed 2 — Spinach","code":"R2","rack_count":1,"level_count":1,"area_sqm":200,
             "target_temp":17.0,"target_humidity":68.0,"target_co2":950,"target_ph":6.0,"target_ec":2.0,"target_ppfd":220,"status":ZoneStatus.active},
            {"name":"DWC Raft Bed 3 — Basil & Herbs","code":"R3","rack_count":1,"level_count":1,"area_sqm":150,
             "target_temp":24.0,"target_humidity":65.0,"target_co2":1100,"target_ph":6.1,"target_ec":2.4,"target_ppfd":300,"status":ZoneStatus.active},
            {"name":"DWC Raft Bed 4 — Kale","code":"R4","rack_count":1,"level_count":1,"area_sqm":150,
             "target_temp":17.0,"target_humidity":70.0,"target_co2":900,"target_ph":6.3,"target_ec":2.6,"target_ppfd":260,"status":ZoneStatus.active},
            {"name":"DWC Raft Bed 5 — Research","code":"R5","rack_count":1,"level_count":1,"area_sqm":80,
             "target_temp":20.0,"target_humidity":65.0,"target_co2":1000,"target_ph":6.0,"target_ec":1.8,"target_ppfd":280,"status":ZoneStatus.active},
            {"name":"DWC Nursery Tank","code":"N1","rack_count":1,"level_count":2,"area_sqm":40,
             "target_temp":22.0,"target_humidity":78.0,"target_co2":800,"target_ph":5.7,"target_ec":0.6,"target_ppfd":120,"status":ZoneStatus.active},
        ]
    },
}

# ─── Crop Recipes per farm type ───────────────────────────────────────────────

def get_recipes_for_farm_type(farm_type: FarmType) -> list:
    base = [
        {
            "name": "Butterhead Lettuce — Hydroponic",
            "crop_type": "Lettuce", "variety": "Butterhead",
            "grow_days": 35, "expected_yield_kg": 2.5,
            "notes": "Standard DWC/hydroponic letttuce. Fast turnover, high density.",
            "farm_type_tag": "hydroponic",
            "phases": [
                {"name":"Germination","days":5,"temp":22,"humidity":72,"co2":800,"ph":5.8,"ec":0.8,"ppfd":80},
                {"name":"Seedling","days":7,"temp":22,"humidity":70,"co2":900,"ph":6.0,"ec":1.2,"ppfd":160},
                {"name":"Vegetative","days":23,"temp":22,"humidity":65,"co2":1100,"ph":6.2,"ec":1.8,"ppfd":280},
            ]
        },
        {
            "name": "Sweet Basil — Genovese",
            "crop_type": "Basil", "variety": "Genovese Sweet",
            "grow_days": 28, "expected_yield_kg": 1.8,
            "notes": "Premium Italian basil for fresh herb market. High light requirement.",
            "farm_type_tag": "hydroponic",
            "phases": [
                {"name":"Germination","days":4,"temp":25,"humidity":78,"co2":800,"ph":5.8,"ec":0.6,"ppfd":80},
                {"name":"Establishment","days":8,"temp":25,"humidity":72,"co2":1000,"ph":6.0,"ec":1.4,"ppfd":220},
                {"name":"Harvest Growth","days":16,"temp":26,"humidity":68,"co2":1200,"ph":6.2,"ec":2.2,"ppfd":320},
            ]
        },
        {
            "name": "Baby Spinach — Hydro",
            "crop_type": "Spinach", "variety": "Baby Leaf",
            "grow_days": 25, "expected_yield_kg": 1.9,
            "notes": "Cool-weather crop. Lower temperatures reduce tip-burn risk.",
            "farm_type_tag": "hydroponic",
            "phases": [
                {"name":"Germination","days":4,"temp":18,"humidity":75,"co2":800,"ph":5.9,"ec":0.8,"ppfd":80},
                {"name":"Seedling","days":6,"temp":17,"humidity":72,"co2":900,"ph":6.0,"ec":1.4,"ppfd":160},
                {"name":"Vegetative","days":15,"temp":17,"humidity":70,"co2":950,"ph":6.1,"ec":2.0,"ppfd":220},
            ]
        },
        {
            "name": "NFT Lettuce — High Density",
            "crop_type": "Lettuce", "variety": "Oakleaf",
            "grow_days": 30, "expected_yield_kg": 2.1,
            "notes": "Optimized for NFT gutter channels. Slightly warmer than DWC.",
            "farm_type_tag": "nft",
            "phases": [
                {"name":"Germination","days":4,"temp":22,"humidity":72,"co2":800,"ph":5.9,"ec":0.7,"ppfd":80},
                {"name":"Seedling","days":7,"temp":21,"humidity":68,"co2":950,"ph":6.0,"ec":1.3,"ppfd":180},
                {"name":"Vegetative","days":19,"temp":21,"humidity":63,"co2":1050,"ph":6.0,"ec":1.6,"ppfd":270},
            ]
        },
        {
            "name": "Aeroponic Strawberry — Seasonal",
            "crop_type": "Strawberry", "variety": "Albion Everbearing",
            "grow_days": 90, "expected_yield_kg": 3.5,
            "notes": "Aeroponics delivers superior oxygen to roots, boosting fruit sweetness. Requires careful mist cycle timing.",
            "farm_type_tag": "aeroponic",
            "phases": [
                {"name":"Establishment","days":14,"temp":18,"humidity":68,"co2":900,"ph":5.8,"ec":1.2,"ppfd":180},
                {"name":"Runner Control","days":21,"temp":17,"humidity":65,"co2":1000,"ph":5.8,"ec":1.6,"ppfd":250},
                {"name":"Flowering","days":21,"temp":18,"humidity":62,"co2":1100,"ph":5.9,"ec":1.8,"ppfd":350},
                {"name":"Fruiting","days":34,"temp":17,"humidity":60,"co2":1000,"ph":6.0,"ec":2.0,"ppfd":400},
            ]
        },
        {
            "name": "Aeroponic Herbs — Premium Blend",
            "crop_type": "Herbs Mix", "variety": "Basil-Mint-Thyme",
            "grow_days": 32, "expected_yield_kg": 1.5,
            "notes": "Mixed herb tower optimized for aeroponics. 15-sec mist cycles every 4 min.",
            "farm_type_tag": "aeroponic",
            "phases": [
                {"name":"Germination","days":5,"temp":24,"humidity":78,"co2":900,"ph":5.8,"ec":0.5,"ppfd":100},
                {"name":"Establishment","days":10,"temp":23,"humidity":72,"co2":1100,"ph":5.9,"ec":1.5,"ppfd":250},
                {"name":"Harvest Phase","days":17,"temp":24,"humidity":68,"co2":1200,"ph":6.0,"ec":2.2,"ppfd":310},
            ]
        },
        {
            "name": "DWC Kale — Curly",
            "crop_type": "Kale", "variety": "Curly Vates",
            "grow_days": 50, "expected_yield_kg": 3.2,
            "notes": "DWC raft system. Kale tolerates lower EC. Cooler temps improve flavour.",
            "farm_type_tag": "dwc",
            "phases": [
                {"name":"Germination","days":5,"temp":18,"humidity":72,"co2":800,"ph":5.9,"ec":0.7,"ppfd":80},
                {"name":"Seedling","days":10,"temp":17,"humidity":70,"co2":900,"ph":6.0,"ec":1.5,"ppfd":180},
                {"name":"Vegetative","days":25,"temp":17,"humidity":70,"co2":950,"ph":6.2,"ec":2.5,"ppfd":260},
                {"name":"Harvest Hardening","days":10,"temp":15,"humidity":68,"co2":900,"ph":6.3,"ec":2.8,"ppfd":280},
            ]
        },
        {
            "name": "Cherry Tomato — Hydro Vine",
            "crop_type": "Tomato", "variety": "Cherry Plum F1",
            "grow_days": 75, "expected_yield_kg": 9.5,
            "notes": "High-wire tomato production. Requires trellising and pollination support.",
            "farm_type_tag": "hydroponic",
            "phases": [
                {"name":"Germination","days":7,"temp":26,"humidity":72,"co2":800,"ph":5.8,"ec":1.0,"ppfd":120},
                {"name":"Seedling","days":14,"temp":25,"humidity":68,"co2":1000,"ph":5.9,"ec":2.0,"ppfd":250},
                {"name":"Vegetative","days":21,"temp":25,"humidity":65,"co2":1200,"ph":5.9,"ec":2.8,"ppfd":380},
                {"name":"Flowering","days":14,"temp":23,"humidity":60,"co2":1400,"ph":6.0,"ec":3.2,"ppfd":480},
                {"name":"Fruiting","days":19,"temp":22,"humidity":58,"co2":1200,"ph":6.2,"ec":3.6,"ppfd":520},
            ]
        },
        {
            "name": "Microgreens — Sunflower Mix",
            "crop_type": "Microgreens", "variety": "Sunflower & Pea Shoot",
            "grow_days": 10, "expected_yield_kg": 0.8,
            "notes": "Ultra-fast cycle. Dense sowing on coco coir trays. 8-day harvest.",
            "farm_type_tag": "hydroponic",
            "phases": [
                {"name":"Soak & Blackout","days":3,"temp":22,"humidity":80,"co2":800,"ph":6.0,"ec":0.5,"ppfd":0},
                {"name":"Light Phase","days":7,"temp":21,"humidity":70,"co2":900,"ph":6.0,"ec":1.0,"ppfd":150},
            ]
        },
        {
            "name": "Watercress — NFT Flow",
            "crop_type": "Watercress", "variety": "Green",
            "grow_days": 21, "expected_yield_kg": 1.4,
            "notes": "Very high water requirement. NFT ideal. Prefers cool, humid conditions.",
            "farm_type_tag": "nft",
            "phases": [
                {"name":"Germination","days":4,"temp":16,"humidity":80,"co2":800,"ph":5.8,"ec":0.6,"ppfd":60},
                {"name":"Growth","days":17,"temp":15,"humidity":78,"co2":900,"ph":5.8,"ec":1.6,"ppfd":200},
            ]
        },
    ]
    return base


# ─── Device templates per farm type ──────────────────────────────────────────

def get_devices_for_zone(zone_code: str, zone_name: str, farm_code: str, farm_type: FarmType) -> list:
    base_sensors = [
        {"name": f"{zone_code} — Temp/Humidity Sensor", "device_type": "sensor",
         "device_uid": f"{farm_code}-{zone_code}-THU01", "protocol": "mqtt", "firmware_version": "3.1.2",
         "config": {"sensor_type": "temperature_humidity"}},
        {"name": f"{zone_code} — CO₂ Sensor", "device_type": "sensor",
         "device_uid": f"{farm_code}-{zone_code}-CO201", "protocol": "mqtt", "firmware_version": "2.8.0",
         "config": {"sensor_type": "co2"}},
        {"name": f"{zone_code} — pH/EC Controller", "device_type": "sensor",
         "device_uid": f"{farm_code}-{zone_code}-PHE01", "protocol": "modbus", "firmware_version": "4.0.1",
         "config": {"sensor_type": "ph_ec"}},
        {"name": f"{zone_code} — IoT Gateway", "device_type": "gateway",
         "device_uid": f"{farm_code}-{zone_code}-GW01", "protocol": "mqtt", "firmware_version": "2.4.1",
         "config": {}},
    ]

    # Farm-type specific additions
    if farm_type == FarmType.aeroponic:
        base_sensors.append({
            "name": f"{zone_code} — Mist Pressure Sensor", "device_type": "sensor",
            "device_uid": f"{farm_code}-{zone_code}-PRS01", "protocol": "mqtt", "firmware_version": "1.9.3",
            "config": {"sensor_type": "pressure"}
        })
        base_sensors.append({
            "name": f"{zone_code} — Mist Pump Controller", "device_type": "pump_controller",
            "device_uid": f"{farm_code}-{zone_code}-PMP01", "protocol": "mqtt", "firmware_version": "3.2.0",
            "config": {"mist_cycle_on_sec": 15, "mist_cycle_off_sec": 240}
        })
    elif farm_type == FarmType.nft:
        base_sensors.append({
            "name": f"{zone_code} — Flow Rate Sensor", "device_type": "sensor",
            "device_uid": f"{farm_code}-{zone_code}-FLW01", "protocol": "mqtt", "firmware_version": "2.1.0",
            "config": {"sensor_type": "flow"}
        })
        base_sensors.append({
            "name": f"{zone_code} — Drain Monitor", "device_type": "sensor",
            "device_uid": f"{farm_code}-{zone_code}-DRN01", "protocol": "modbus", "firmware_version": "1.8.5",
            "config": {"sensor_type": "drain_ec"}
        })
    elif farm_type == FarmType.dwc:
        base_sensors.append({
            "name": f"{zone_code} — DO Sensor (Dissolved O₂)", "device_type": "sensor",
            "device_uid": f"{farm_code}-{zone_code}-DO01", "protocol": "modbus", "firmware_version": "3.0.2",
            "config": {"sensor_type": "dissolved_oxygen"}
        })
        base_sensors.append({
            "name": f"{zone_code} — Water Level Sensor", "device_type": "sensor",
            "device_uid": f"{farm_code}-{zone_code}-WLV01", "protocol": "mqtt", "firmware_version": "2.2.1",
            "config": {"sensor_type": "water_level"}
        })
    else:  # hydroponic
        base_sensors.append({
            "name": f"{zone_code} — PPFD Light Sensor", "device_type": "sensor",
            "device_uid": f"{farm_code}-{zone_code}-LGT01", "protocol": "mqtt", "firmware_version": "2.5.0",
            "config": {"sensor_type": "ppfd"}
        })

    return base_sensors


async def init_db(db: AsyncSession) -> None:
    await create_tables()

    result = await db.execute(select(User).where(User.email == settings.FIRST_SUPERUSER_EMAIL))
    if result.scalar_one_or_none():
        logger.info("Database already seeded — skipping.")
        return

    logger.info("Seeding initial data...")


    # ── Plan Limits (seed once) ───────────────────────────────────────────────
    existing_limits = (await db.execute(select(PlanLimit))).scalars().all()
    if not existing_limits:
        for plan, limits in [
            (PlanTier.starter,    {"max_farms":1,"max_zones":10,"max_sensors":50,"max_users":3,"max_api_req_per_min":0,"data_retention_days":30,"has_ai":True,"has_traceability":False,"has_api_access":False,"has_webhooks":False,"has_white_label":False,"has_custom_domain":False,"price_monthly_inr":499900,"price_annual_inr":4999000}),
            (PlanTier.growth,     {"max_farms":5,"max_zones":60,"max_sensors":500,"max_users":15,"max_api_req_per_min":300,"data_retention_days":365,"has_ai":True,"has_traceability":True,"has_api_access":True,"has_webhooks":True,"has_white_label":False,"has_custom_domain":False,"price_monthly_inr":1499900,"price_annual_inr":14999000}),
            (PlanTier.enterprise, {"max_farms":-1,"max_zones":-1,"max_sensors":-1,"max_users":-1,"max_api_req_per_min":1000,"data_retention_days":-1,"has_ai":True,"has_traceability":True,"has_api_access":True,"has_webhooks":True,"has_white_label":True,"has_custom_domain":True,"price_monthly_inr":4999900,"price_annual_inr":49999000}),
        ]:
            db.add(PlanLimit(plan=plan, **limits))
        await db.flush()

    # ── Organization ──────────────────────────────────────────────────────────
    org = Organization(
        name="VertiFarm Demo Corp",
        slug="vertifarm-demo",
        plan="enterprise",
        settings={"currency": "INR", "timezone": "Asia/Kolkata"}
    )
    db.add(org)
    await db.flush()

    # ── Trial subscription for demo org ──────────────────────────────────────
    now = datetime.now(timezone.utc)
    demo_sub = Subscription(
        organization_id=org.id,
        plan=PlanTier.growth,
        status=SubStatus.trialing,
        trial_starts_at=now,
        trial_ends_at=now + timedelta(days=14),
        seats_used=1,
    )
    db.add(demo_sub)
    await db.flush()

    # ── Admin user ────────────────────────────────────────────────────────────
    admin = User(
        email=settings.FIRST_SUPERUSER_EMAIL,
        full_name="System Administrator",
        hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
        role=UserRole.superadmin,
        is_superuser=True,
        organization_id=org.id,
    )
    db.add(admin)
    await db.flush()

    # ── Farms — each with distinct type, location, area ───────────────────────
    farms_data = [
        {
            "name": "Delhi HQ — Hydroponic",
            "code": "DHF",
            "type": FarmType.rack,
            "location": "Okhla Industrial Area, New Delhi",
            "latitude": 28.5355, "longitude": 77.2700,
            "area_sqm": 2400,
        },
        {
            "name": "Mumbai — NFT Urban Farm",
            "code": "MUF",
            "type": FarmType.nft,
            "location": "Andheri East, Mumbai",
            "latitude": 19.1136, "longitude": 72.8697,
            "area_sqm": 1400,
        },
        {
            "name": "Pune — Aeroponics Centre",
            "code": "PNF",
            "type": FarmType.aeroponic,
            "location": "Hinjewadi Phase II, Pune",
            "latitude": 18.5912, "longitude": 73.7389,
            "area_sqm": 900,
        },
        {
            "name": "Bengaluru — DWC R&D Lab",
            "code": "BLR",
            "type": FarmType.dwc,
            "location": "Electronic City, Bengaluru",
            "latitude": 12.8399, "longitude": 77.6770,
            "area_sqm": 780,
        },
    ]

    for fd in farms_data:
        farm = Farm(organization_id=org.id, **fd)
        db.add(farm)
        await db.flush()

        zone_configs = FARM_ZONE_CONFIGS.get(fd["type"], FARM_ZONE_CONFIGS[FarmType.rack])

        for zc in zone_configs["zones"]:
            zone = Zone(farm_id=farm.id, **zc)
            db.add(zone)
            await db.flush()

            devices = get_devices_for_zone(zc["code"], zc["name"], fd["code"], fd["type"])
            for dev_data in devices:
                dev = Device(
                    farm_id=farm.id,
                    zone_id=zone.id,
                    status=DeviceStatus.online,
                    **dev_data
                )
                db.add(dev)

    # ── Crop Recipes — comprehensive library ──────────────────────────────────
    all_recipes = get_recipes_for_farm_type(None)
    for r in all_recipes:
        recipe = CropRecipe(
            organization_id=org.id,
            created_by=admin.id,
            is_public=True,
            name=r["name"],
            crop_type=r["crop_type"],
            variety=r.get("variety"),
            grow_days=r["grow_days"],
            expected_yield_kg=r.get("expected_yield_kg"),
            notes=r.get("notes"),
            phases=r["phases"],
        )
        db.add(recipe)

    await db.commit()
    logger.info("✓ Seeding complete.")
    logger.info(f"  Admin: {settings.FIRST_SUPERUSER_EMAIL}")


# ─────────────────────────────────────────────────────────────────────────────
# DEMO DATA SEEDER  —  rich historical data for investor demos
# Call via:  python seed.py --demo   or automatically on first boot in dev
# ─────────────────────────────────────────────────────────────────────────────

async def seed_demo_data(db: AsyncSession) -> None:
    """
    Seeds realistic historical sensor readings, active crop batches, harvest logs,
    and sample alerts so every dashboard / chart is populated on first login.

    Design principles:
      • All variation uses deterministic math (sin/cos waves, index offsets) —
        zero calls to random() so the data is reproducible and investor-consistent.
      • Sensor readings follow real diurnal patterns (CO2 peaks at noon, temp
        dips at night, lights-off PPFD=0 etc.).
      • Harvest logs cover the past 30 days, giving the yield-trend chart data.
      • Crops are spread across grow stages so the crop-management view shows
        seeding, vegetative, and ready-to-harvest batches simultaneously.
    """
    import math

    # ── Guard: skip if demo data already present ──────────────────────────────
    result = await db.execute(select(func.count(SensorReading.id)))
    if (result.scalar() or 0) > 0:
        logger.info("Demo data already present — skipping seed_demo_data.")
        return

    # ── Fetch the seeded org / farms / zones / recipes ────────────────────────
    org_result = await db.execute(select(Organization).limit(1))
    org = org_result.scalar_one_or_none()
    if not org:
        logger.warning("No organisation found — run init_db first.")
        return

    admin_result = await db.execute(select(User).where(User.organization_id == org.id).limit(1))
    admin = admin_result.scalar_one_or_none()

    farms_result = await db.execute(select(Farm).where(Farm.organization_id == org.id))
    farms = farms_result.scalars().all()

    recipes_result = await db.execute(select(CropRecipe).where(CropRecipe.organization_id == org.id))
    recipes = recipes_result.scalars().all()

    recipe_by_type: dict = {}
    for r in recipes:
        key = r.crop_type.lower()
        if key not in recipe_by_type:
            recipe_by_type[key] = r

    now = datetime.now(timezone.utc)

    # ── Sensor type metadata: (unit, base_value, amplitude, period_hours) ─────
    # base ± amplitude × sin(2π t / period)
    SENSOR_META = {
        "temperature":       ("°C",    22.5,  2.0,   24),   # peaks afternoon
        "humidity":          ("%",     65.0,  6.0,   24),   # inverse of temp
        "co2":               ("ppm",  1080.0, 120.0, 12),   # peaks midday with lights
        "ph":                ("pH",     6.10,  0.08, 48),   # slow drift
        "ec":                ("mS/cm",  2.00,  0.10, 48),
        "ppfd":              ("µmol",  280.0, 280.0, 24),   # zero at night
        "vpd":               ("kPa",    0.85,  0.15, 24),
        "water_temp":        ("°C",    19.5,   1.2,  24),
        "dissolved_oxygen":  ("mg/L",   8.2,   0.4,  24),
    }

    # ── Crop batch templates per zone (index-spread across grow stages) ───────
    CROP_TEMPLATES = [
        # (crop_type_key,  batch_prefix, grow_days, yield_per_kg, days_since_plant, status)
        ("lettuce",       "LET",  35, 2.5,   28, CropStatus.vegetative),
        ("spinach",       "SPN",  25, 1.9,   20, CropStatus.vegetative),
        ("basil",         "BSL",  28, 1.8,   26, CropStatus.ready),
        ("tomato",        "TOM",  75, 9.5,   65, CropStatus.ready),
        ("microgreens",   "MCG",  10, 0.8,    8, CropStatus.ready),
        ("kale",          "KAL",  50, 3.2,   12, CropStatus.vegetative),
        ("lettuce",       "LT2",  35, 2.5,    5, CropStatus.seeding),
        ("spinach",       "SP2",  25, 1.9,    3, CropStatus.seeding),
        ("basil",         "BS2",  28, 1.8,   14, CropStatus.vegetative),
        ("tomato",        "TM2",  75, 9.5,   35, CropStatus.vegetative),
    ]

    # ── Alert templates (seeded once per farm, mix of severities) ─────────────
    ALERT_TEMPLATES = [
        # (severity, category, title, message, is_resolved)
        (AlertSeverity.warning,  "sensor",     "pH drift in Zone B2",
         "Zone B2 pH reading 6.45 — above target 6.2. Check dosing pump.",                False),
        (AlertSeverity.info,     "maintenance","Filter service due",
         "Zone A1 recirculation filter at 82% capacity. Schedule cleaning within 5 days.", True),
        (AlertSeverity.critical, "sensor",     "EC spike — Zone C1",
         "Zone C1 EC reading 3.8 mS/cm — significantly above target 2.0. Check nutrient dosing.", False),
        (AlertSeverity.warning,  "device",     "CO₂ sensor offline",
         "Zone D1 CO₂ sensor last reported 4 hours ago. Check MQTT broker connection.",    False),
        (AlertSeverity.info,     "harvest",    "Batch BSL-001 ready to harvest",
         "Basil batch BSL-001 has reached day 26 of 28. Schedule harvest within 48 hours.", True),
        (AlertSeverity.warning,  "climate",    "Humidity high — Zone A2",
         "Zone A2 humidity at 78% for 2 consecutive readings. Risk of botrytis.",          False),
    ]

    batch_counter = 0

    for farm_idx, farm in enumerate(farms):
        # ── Load zones for this farm ──────────────────────────────────────────
        zones_result = await db.execute(select(Zone).where(Zone.farm_id == farm.id))
        zones = zones_result.scalars().all()
        if not zones:
            continue

        # ── Seed alerts for this farm ─────────────────────────────────────────
        for a_idx, (sev, cat, title, msg, resolved) in enumerate(ALERT_TEMPLATES):
            zone = zones[a_idx % len(zones)]
            alert = Alert(
                farm_id=farm.id,
                zone_id=zone.id,
                severity=sev,
                category=cat,
                title=title,
                message=msg,
                is_resolved=resolved,
                resolved_at=now - timedelta(hours=6) if resolved else None,
                created_at=now - timedelta(hours=a_idx * 8 + farm_idx * 3),
            )
            db.add(alert)

        # ── Seed crop batches + harvest logs per zone ─────────────────────────
        for z_idx, zone in enumerate(zones):
            tmpl_idx = (z_idx + farm_idx * 3) % len(CROP_TEMPLATES)
            crop_type, prefix, grow_days, yield_kg, days_planted, status = CROP_TEMPLATES[tmpl_idx]
            batch_counter += 1

            recipe = recipe_by_type.get(crop_type)
            planted_at = now - timedelta(days=days_planted)
            expected_harvest = planted_at + timedelta(days=grow_days)

            batch_code = f"{prefix}-{farm.code}-{z_idx+1:02d}-{batch_counter:04d}"

            crop = Crop(
                batch_code=batch_code,
                name=f"{crop_type.title()} — {zone.name}",
                farm_id=farm.id,
                zone_id=zone.id,
                recipe_id=recipe.id if recipe else None,
                status=status,
                planted_at=planted_at,
                expected_harvest=expected_harvest,
                notes=f"Demo batch seeded for investor preview.",
            )
            db.add(crop)
            await db.flush()

            # ── Historical harvest logs (past 30 days, ~every 3–5 days) ───────
            # Each zone gets a harvest log every ~4 days for the past month
            harvest_interval_days = 4 + (z_idx % 3)  # 4–6 days between harvests
            harvest_day = 0
            harvest_count = 0
            while harvest_day < 30:
                harvest_day += harvest_interval_days
                if harvest_day > 30:
                    break
                harvested_at = now - timedelta(days=30 - harvest_day)
                # Deterministic yield variation: sinusoidal ±8% around expected
                variation = 1.0 + 0.08 * math.sin(harvest_count * 1.3 + z_idx * 0.7)
                weight = round(yield_kg * variation * (zone.area_sqm or 100) / 100, 2)

                # Create a completed crop reference for each historical harvest
                hist_batch_code = f"{prefix}-HIST-{farm.code}-{z_idx+1:02d}-{harvest_count:02d}"
                hist_crop = Crop(
                    batch_code=hist_batch_code,
                    name=f"{crop_type.title()} — {zone.name} (harvested)",
                    farm_id=farm.id,
                    zone_id=zone.id,
                    recipe_id=recipe.id if recipe else None,
                    status=CropStatus.harvested,
                    planted_at=harvested_at - timedelta(days=grow_days),
                    expected_harvest=harvested_at,
                    harvested_at=harvested_at,
                    actual_yield_kg=weight,
                    quality_score=round(92.0 + 4.0 * math.sin(harvest_count * 0.9), 1),
                    notes="Historical batch — auto-seeded.",
                )
                db.add(hist_crop)
                await db.flush()

                harvest_log = HarvestLog(
                    crop_id=hist_crop.id,
                    farm_id=farm.id,
                    zone_id=zone.id,
                    harvested_by=admin.id if admin else None,
                    weight_kg=weight,
                    quality_grade="A" if variation > 1.0 else "B",
                    notes=f"Batch {hist_batch_code} — auto-seeded demo harvest.",
                    harvested_at=harvested_at,
                )
                db.add(harvest_log)
                harvest_count += 1

            # ── Seed 48 hours of sensor readings (every 15 min = 192 rows/type) ─
            # Only seed for the first 3 zones per farm to keep row count manageable
            if z_idx >= 3:
                continue

            zone_offset = z_idx * 0.5  # phase shift per zone
            farm_offset = farm_idx * 0.3

            # Override base values with zone targets where available
            sensor_bases = {
                "temperature":      float(zone.target_temp or 22.5),
                "humidity":         float(zone.target_humidity or 65.0),
                "co2":              float(zone.target_co2 or 1080.0),
                "ph":               float(zone.target_ph or 6.1),
                "ec":               float(zone.target_ec or 2.0),
                "ppfd":             float(zone.target_ppfd or 280.0),
                "vpd":              0.85,
                "water_temp":       float((zone.target_temp or 22.5) - 3.0),
                "dissolved_oxygen": 8.2,
            }

            readings_to_add = []
            for s_type, (unit, _base, amplitude, period_h) in SENSOR_META.items():
                base = sensor_bases.get(s_type, _base)
                for step in range(192):       # 192 × 15min = 48 hours
                    ts = now - timedelta(minutes=(192 - step) * 15)
                    hour_of_day = (ts.hour + ts.minute / 60.0)

                    if s_type == "ppfd":
                        # Lights on 06:00–22:00, simulate ramp up/down
                        if 6 <= hour_of_day <= 22:
                            light_factor = math.sin(math.pi * (hour_of_day - 6) / 16)
                            value = round(base * light_factor, 1)
                        else:
                            value = 0.0
                    elif s_type == "humidity":
                        # Humidity inversely correlated with temperature
                        temp_wave = math.sin(2 * math.pi * hour_of_day / period_h + zone_offset + farm_offset)
                        value = round(base - amplitude * 0.5 * temp_wave, 1)
                    elif s_type == "co2":
                        # CO2 peaks midday when lights are on (photosynthesis demand)
                        if 6 <= hour_of_day <= 22:
                            wave = math.sin(math.pi * (hour_of_day - 6) / 16)
                            value = round(base + amplitude * wave * 0.5, 1)
                        else:
                            value = round(base * 0.88, 1)  # lower CO2 at night
                    else:
                        wave = math.sin(2 * math.pi * hour_of_day / period_h + zone_offset + farm_offset)
                        value = round(base + amplitude * wave, 4)

                    readings_to_add.append(SensorReading(
                        zone_id=zone.id,
                        sensor_type=s_type,
                        value=value,
                        unit=unit,
                        timestamp=ts,
                    ))

            # Bulk-add in chunks to avoid huge single flush
            for i in range(0, len(readings_to_add), 500):
                for r in readings_to_add[i:i+500]:
                    db.add(r)
                await db.flush()

    await db.commit()
    logger.info("✓ Demo data seeding complete.")
    logger.info(f"  Farms: {len(farms)}, sensor readings: {len(farms) * 3 * 9 * 192:,}")
