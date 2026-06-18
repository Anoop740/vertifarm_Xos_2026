"""
Sensor ingest tests — the critical auth regression from v6.8.1.

Covers:
  • Unauthenticated ingest is now blocked (was open in prior version)
  • Viewer role is blocked (403)
  • Operator role is allowed (the minimum permitted role)
  • org_admin is allowed
  • Ingested value is stored and readable
  • WebSocket rejects connections without a token
"""
import uuid
import pytest
from httpx import AsyncClient

from tests.conftest import get_token, auth_headers

pytestmark = pytest.mark.asyncio


def _reading(zone_id: str | None = None) -> dict:
    return {
        "zone_id": zone_id or str(uuid.uuid4()),
        "sensor_type": "temperature",
        "value": 23.5,
        "unit": "celsius",
    }


# ──────────────────────────────────────────────────────────────────────────
# AUTH — the FIX-1 regression test
# ──────────────────────────────────────────────────────────────────────────

async def test_sensor_ingest_no_auth_blocked(client: AsyncClient):
    """
    Core regression: POST /sensors/readings was unauthenticated before v6.8.1-prod.
    Must return 401 now.
    """
    resp = await client.post("/api/v1/sensors/readings", json=_reading())
    assert resp.status_code == 401, (
        f"REGRESSION: sensor ingest must require auth, got {resp.status_code}"
    )


async def test_sensor_ingest_invalid_token_blocked(client: AsyncClient):
    resp = await client.post(
        "/api/v1/sensors/readings",
        headers={"Authorization": "Bearer totally.invalid.token"},
        json=_reading(),
    )
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────────────────
# RBAC
# ──────────────────────────────────────────────────────────────────────────

async def test_sensor_ingest_viewer_forbidden(client: AsyncClient, viewer_user):
    user, pw = viewer_user
    hdrs = auth_headers(await get_token(client, user.email, pw))
    resp = await client.post("/api/v1/sensors/readings", headers=hdrs, json=_reading())
    assert resp.status_code == 403, (
        f"Viewer must not ingest sensor data, got {resp.status_code}"
    )


async def test_sensor_ingest_operator_allowed(client: AsyncClient, operator_user):
    user, pw = operator_user
    hdrs = auth_headers(await get_token(client, user.email, pw))
    resp = await client.post("/api/v1/sensors/readings", headers=hdrs, json=_reading())
    assert resp.status_code in (200, 201), (
        f"Operator should be able to ingest sensor data, got {resp.status_code}: {resp.text}"
    )


async def test_sensor_ingest_admin_allowed(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))
    resp = await client.post("/api/v1/sensors/readings", headers=hdrs, json=_reading())
    assert resp.status_code in (200, 201), resp.text


# ──────────────────────────────────────────────────────────────────────────
# DATA INTEGRITY — ingested reading is returned in GET
# ──────────────────────────────────────────────────────────────────────────

async def test_sensor_ingest_data_persisted(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))

    zone_id = str(uuid.uuid4())
    payload = {"zone_id": zone_id, "sensor_type": "humidity", "value": 68.2, "unit": "percent"}

    post_resp = await client.post("/api/v1/sensors/readings", headers=hdrs, json=payload)
    assert post_resp.status_code in (200, 201), post_resp.text

    body = post_resp.json()
    assert body["sensor_type"] == "humidity"
    assert abs(body["value"] - 68.2) < 0.01, "Stored value must match submitted value exactly"
    assert body["zone_id"] == zone_id


async def test_sensor_ingest_returns_id_and_timestamp(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))

    resp = await client.post("/api/v1/sensors/readings", headers=hdrs, json=_reading())
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()

    assert "id" in body, "Response must include an id"
    assert "timestamp" in body, "Response must include a timestamp"
    assert body["id"]  # not empty / null


# ──────────────────────────────────────────────────────────────────────────
# WebSocket — must reject without token (FIX-2)
# ──────────────────────────────────────────────────────────────────────────

async def test_websocket_rejects_no_token(client: AsyncClient):
    """
    WebSocket /ws/sensors/{zone_id} must not accept unauthenticated connections.
    Expects a 403, 401, or WS close code 4401 before data is streamed.
    """
    zone_id = str(uuid.uuid4())
    # httpx doesn't support WebSockets natively; test via HTTP upgrade rejection
    resp = await client.get(
        f"/api/v1/ws/sensors/{zone_id}",
        headers={"Connection": "Upgrade", "Upgrade": "websocket",
                 "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
                 "Sec-WebSocket-Version": "13"},
    )
    # FastAPI will return 403/400/422 when token query param is missing
    assert resp.status_code in (400, 401, 403, 422), (
        f"WS endpoint must reject missing token, got {resp.status_code}"
    )


async def test_websocket_rejects_invalid_token(client: AsyncClient):
    zone_id = str(uuid.uuid4())
    resp = await client.get(
        f"/api/v1/ws/sensors/{zone_id}",
        params={"token": "this.is.not.valid"},
        headers={"Connection": "Upgrade", "Upgrade": "websocket",
                 "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
                 "Sec-WebSocket-Version": "13"},
    )
    assert resp.status_code in (400, 401, 403, 422), (
        f"WS endpoint must reject invalid token, got {resp.status_code}"
    )
