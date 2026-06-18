"""
Farm CRUD tests — create, read, update, delete, and org isolation.
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import _make_org, _make_user, get_token, auth_headers

pytestmark = pytest.mark.asyncio

# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

def _farm_payload(**overrides) -> dict:
    return {
        "name": overrides.get("name", f"Test Farm {uuid.uuid4().hex[:6]}"),
        "location": overrides.get("location", "Building A"),
        "description": overrides.get("description", "Integration test farm"),
        "farm_type": overrides.get("farm_type", "indoor"),
        "total_area_sqm": overrides.get("total_area_sqm", 500.0),
    }


async def _admin_token(client: AsyncClient, user, pw: str) -> dict:
    token = await get_token(client, user.email, pw)
    return auth_headers(token)


# ──────────────────────────────────────────────────────────────────────────
# CREATE
# ──────────────────────────────────────────────────────────────────────────

async def test_create_farm_success(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = await _admin_token(client, user, pw)

    resp = await client.post("/api/v1/farms", headers=hdrs, json=_farm_payload())
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert "id" in body
    assert body["name"]


async def test_create_farm_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/farms", json=_farm_payload())
    assert resp.status_code == 401


async def test_create_farm_viewer_forbidden(client: AsyncClient, viewer_user):
    user, pw = viewer_user
    hdrs = auth_headers(await get_token(client, user.email, pw))
    resp = await client.post("/api/v1/farms", headers=hdrs, json=_farm_payload())
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────────────────
# READ
# ──────────────────────────────────────────────────────────────────────────

async def test_list_farms(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = await _admin_token(client, user, pw)

    # create one first
    await client.post("/api/v1/farms", headers=hdrs, json=_farm_payload(name="List Test Farm"))

    resp = await client.get("/api/v1/farms", headers=hdrs)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


async def test_get_farm_by_id(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = await _admin_token(client, user, pw)

    create = await client.post("/api/v1/farms", headers=hdrs, json=_farm_payload())
    farm_id = create.json()["id"]

    resp = await client.get(f"/api/v1/farms/{farm_id}", headers=hdrs)
    assert resp.status_code == 200
    assert resp.json()["id"] == farm_id


async def test_get_nonexistent_farm_returns_404(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = await _admin_token(client, user, pw)
    resp = await client.get(f"/api/v1/farms/{uuid.uuid4()}", headers=hdrs)
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────────────────
# UPDATE
# ──────────────────────────────────────────────────────────────────────────

async def test_update_farm(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = await _admin_token(client, user, pw)

    create = await client.post("/api/v1/farms", headers=hdrs, json=_farm_payload())
    farm_id = create.json()["id"]

    resp = await client.patch(
        f"/api/v1/farms/{farm_id}",
        headers=hdrs,
        json={"name": "Renamed Farm"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Farm"


async def test_update_farm_viewer_forbidden(client: AsyncClient, admin_user, viewer_user):
    admin, apw = admin_user
    viewer, vpw = viewer_user
    a_hdrs = await _admin_token(client, admin, apw)
    v_hdrs = auth_headers(await get_token(client, viewer.email, vpw))

    create = await client.post("/api/v1/farms", headers=a_hdrs, json=_farm_payload())
    farm_id = create.json()["id"]

    resp = await client.patch(
        f"/api/v1/farms/{farm_id}", headers=v_hdrs, json={"name": "Hacked"}
    )
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────────────────
# DELETE
# ──────────────────────────────────────────────────────────────────────────

async def test_delete_farm(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = await _admin_token(client, user, pw)

    create = await client.post("/api/v1/farms", headers=hdrs, json=_farm_payload())
    farm_id = create.json()["id"]

    resp = await client.delete(f"/api/v1/farms/{farm_id}", headers=hdrs)
    assert resp.status_code in (200, 204)

    # Confirm it's gone
    get_resp = await client.get(f"/api/v1/farms/{farm_id}", headers=hdrs)
    assert get_resp.status_code == 404


async def test_delete_farm_viewer_forbidden(client: AsyncClient, admin_user, viewer_user):
    admin, apw = admin_user
    viewer, vpw = viewer_user
    a_hdrs = await _admin_token(client, admin, apw)
    v_hdrs = auth_headers(await get_token(client, viewer.email, vpw))

    create = await client.post("/api/v1/farms", headers=a_hdrs, json=_farm_payload())
    farm_id = create.json()["id"]

    resp = await client.delete(f"/api/v1/farms/{farm_id}", headers=v_hdrs)
    assert resp.status_code == 403


# ──────────────────────────────────────────────────────────────────────────
# ORG ISOLATION — cross-org data must be invisible
# ──────────────────────────────────────────────────────────────────────────

async def test_farm_org_isolation(client: AsyncClient, db_session: AsyncSession):
    """Org A cannot see Org B's farms."""
    org_a = await _make_org(db_session, name="Org Alpha")
    org_b = await _make_org(db_session, name="Org Beta")

    user_a, pw_a = await _make_user(db_session, org_a, role="org_admin", email="admin-a@test.io")
    user_b, pw_b = await _make_user(db_session, org_b, role="org_admin", email="admin-b@test.io")

    a_hdrs = auth_headers(await get_token(client, user_a.email, pw_a))
    b_hdrs = auth_headers(await get_token(client, user_b.email, pw_b))

    # Org A creates a farm
    create = await client.post("/api/v1/farms", headers=a_hdrs, json=_farm_payload(name="Org A Secret Farm"))
    assert create.status_code in (200, 201)
    farm_id = create.json()["id"]

    # Org B cannot read it by ID
    resp = await client.get(f"/api/v1/farms/{farm_id}", headers=b_hdrs)
    assert resp.status_code == 404, (
        f"Org isolation breach: Org B got {resp.status_code} on Org A's farm"
    )

    # Org B's farm list must not include Org A's farm
    list_resp = await client.get("/api/v1/farms", headers=b_hdrs)
    assert list_resp.status_code == 200
    farm_ids = [f["id"] for f in list_resp.json()]
    assert farm_id not in farm_ids, "Org isolation breach: Org A's farm visible in Org B's list"
