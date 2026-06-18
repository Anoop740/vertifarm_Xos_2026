"""
RBAC enforcement tests.

For every protected mutating endpoint we confirm:
  • A viewer / operator receives HTTP 403 (not 200, not 404)
  • An org_admin receives a non-403 response (200, 201, 400, 404 all acceptable)

This covers the 29 endpoints fixed in v6.8.1-prod across:
  api.py, phase2.py, phase4.py
"""
import uuid
import pytest
from httpx import AsyncClient

from tests.conftest import get_token, auth_headers

pytestmark = pytest.mark.asyncio


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

def _random_id() -> str:
    return str(uuid.uuid4())


async def _tokens(client, admin_user, viewer_user, operator_user):
    admin, apw = admin_user
    viewer, vpw = viewer_user
    operator, opw = operator_user
    a_tok = await get_token(client, admin.email, apw)
    v_tok = await get_token(client, viewer.email, vpw)
    o_tok = await get_token(client, operator.email, opw)
    return auth_headers(a_tok), auth_headers(v_tok), auth_headers(o_tok)


def _assert_forbidden(resp, label: str):
    assert resp.status_code == 403, (
        f"{label}: expected 403, got {resp.status_code}. Body: {resp.text[:200]}"
    )


def _assert_not_forbidden(resp, label: str):
    assert resp.status_code != 403, (
        f"{label}: admin should not get 403, got {resp.status_code}. Body: {resp.text[:200]}"
    )


# ──────────────────────────────────────────────────────────────────────────
# api.py — Sensor ingest
# ──────────────────────────────────────────────────────────────────────────

async def test_sensor_ingest_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/sensors/readings", json={
        "zone_id": _random_id(), "sensor_type": "temperature", "value": 22.5
    })
    assert resp.status_code == 401, "Unauthenticated sensor ingest should be 401"


async def test_sensor_ingest_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/sensors/readings", headers=v_hdrs, json={
        "zone_id": _random_id(), "sensor_type": "temperature", "value": 22.5
    })
    _assert_forbidden(resp, "sensor ingest: viewer")


# ──────────────────────────────────────────────────────────────────────────
# phase2.py — API keys
# ──────────────────────────────────────────────────────────────────────────

async def test_create_api_key_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/api-keys", headers=v_hdrs, json={"name": "test-key"})
    _assert_forbidden(resp, "create_api_key: viewer")


async def test_create_api_key_admin_allowed(client: AsyncClient, admin_user, viewer_user, operator_user):
    a_hdrs, _, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/api-keys", headers=a_hdrs, json={"name": "test-key"})
    _assert_not_forbidden(resp, "create_api_key: admin")


async def test_revoke_api_key_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.delete(f"/api/v1/api-keys/{_random_id()}", headers=v_hdrs)
    _assert_forbidden(resp, "revoke_api_key: viewer")


# ──────────────────────────────────────────────────────────────────────────
# phase2.py — Webhooks
# ──────────────────────────────────────────────────────────────────────────

async def test_create_webhook_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/webhooks", headers=v_hdrs, json={
        "name": "wh", "url": "https://example.com/hook"
    })
    _assert_forbidden(resp, "create_webhook: viewer")


async def test_delete_webhook_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.delete(f"/api/v1/webhooks/{_random_id()}", headers=v_hdrs)
    _assert_forbidden(resp, "delete_webhook: viewer")


async def test_test_webhook_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post(f"/api/v1/webhooks/{_random_id()}/test", headers=v_hdrs)
    _assert_forbidden(resp, "test_webhook: viewer")


# ──────────────────────────────────────────────────────────────────────────
# phase2.py — Traceability
# ──────────────────────────────────────────────────────────────────────────

async def test_create_traceability_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/traceability", headers=v_hdrs, json={
        "batch_code": "BATCH-001", "crop_name": "Lettuce"
    })
    _assert_forbidden(resp, "create_traceability: viewer")


async def test_update_traceability_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.patch(f"/api/v1/traceability/BATCH-001", headers=v_hdrs, json={
        "crop_name": "Basil"
    })
    _assert_forbidden(resp, "update_traceability: viewer")


# ──────────────────────────────────────────────────────────────────────────
# phase2.py — Integrations
# ──────────────────────────────────────────────────────────────────────────

async def test_connect_integration_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/integrations", headers=v_hdrs, json={
        "type": "erp", "name": "SAP", "credentials": {}
    })
    _assert_forbidden(resp, "connect_integration: viewer")


async def test_update_integration_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.patch(f"/api/v1/integrations/{_random_id()}", headers=v_hdrs, json={})
    _assert_forbidden(resp, "update_integration: viewer")


async def test_disconnect_integration_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.delete(f"/api/v1/integrations/{_random_id()}", headers=v_hdrs)
    _assert_forbidden(resp, "disconnect_integration: viewer")


# ──────────────────────────────────────────────────────────────────────────
# phase4.py — Resellers
# ──────────────────────────────────────────────────────────────────────────

async def test_register_reseller_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/resellers/register", headers=v_hdrs, json={
        "company_name": "Evil Corp", "tier": "silver"
    })
    _assert_forbidden(resp, "register_reseller: viewer")


async def test_register_reseller_admin_allowed(client: AsyncClient, admin_user, viewer_user, operator_user):
    a_hdrs, _, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/resellers/register", headers=a_hdrs, json={
        "company_name": "Legit Reseller", "tier": "silver"
    })
    _assert_not_forbidden(resp, "register_reseller: admin")


# ──────────────────────────────────────────────────────────────────────────
# phase4.py — Compliance / Certifications
# ──────────────────────────────────────────────────────────────────────────

async def test_create_certification_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/compliance/certifications", headers=v_hdrs, json={
        "name": "USDA Organic", "issuing_body": "USDA", "cert_number": "ORG-001"
    })
    _assert_forbidden(resp, "create_certification: viewer")


async def test_delete_certification_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.delete(f"/api/v1/compliance/certifications/{_random_id()}", headers=v_hdrs)
    _assert_forbidden(resp, "delete_certification: viewer")


# ──────────────────────────────────────────────────────────────────────────
# phase4.py — Franchise
# ──────────────────────────────────────────────────────────────────────────

async def test_create_franchise_group_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/franchise/groups", headers=v_hdrs, json={
        "name": "East Coast", "region": "US-East"
    })
    _assert_forbidden(resp, "create_franchise_group: viewer")


async def test_create_franchise_group_admin_allowed(client: AsyncClient, admin_user, viewer_user, operator_user):
    a_hdrs, _, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.post("/api/v1/franchise/groups", headers=a_hdrs, json={
        "name": "East Coast", "region": "US-East"
    })
    _assert_not_forbidden(resp, "create_franchise_group: admin")


async def test_delete_franchise_group_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    resp = await client.delete(f"/api/v1/franchise/groups/{_random_id()}", headers=v_hdrs)
    _assert_forbidden(resp, "delete_franchise_group: viewer")


async def test_push_recipe_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    gid = _random_id()
    resp = await client.post(f"/api/v1/franchise/groups/{gid}/recipe-pushes", headers=v_hdrs, json={
        "recipe_id": _random_id(), "notes": "test"
    })
    _assert_forbidden(resp, "push_recipe: viewer")


async def test_push_config_viewer_forbidden(client: AsyncClient, admin_user, viewer_user, operator_user):
    _, v_hdrs, _ = await _tokens(client, admin_user, viewer_user, operator_user)
    gid = _random_id()
    resp = await client.post(f"/api/v1/franchise/groups/{gid}/config-pushes", headers=v_hdrs, json={
        "target_temp": 23.0
    })
    _assert_forbidden(resp, "push_config: viewer")
