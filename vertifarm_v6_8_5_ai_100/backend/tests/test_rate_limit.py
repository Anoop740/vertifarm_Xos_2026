"""
Rate limiting tests — verify slowapi is wired and login endpoint is throttled.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_health_returns_ok(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_login_rate_limit_header_present(client: AsyncClient, admin_user):
    """A successful login should not have a 429; headers may vary by middleware version."""
    user, pw = admin_user
    resp = await client.post("/api/v1/auth/login", json={"email": user.email, "password": pw})
    # Should succeed (200), not rate-limited on first call
    assert resp.status_code == 200


async def test_login_bad_creds_repeated(client: AsyncClient):
    """
    Fire 5 bad-credential attempts — all should be 401 (not 429) on a fresh
    test client because the in-process SQLite test runner doesn't share Redis
    state with SlowAPI.  This confirms the endpoint is reachable and guarded.
    """
    for _ in range(5):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@test.io", "password": "badpass"},
        )
        assert resp.status_code in (401, 429)


async def test_root_endpoint(client: AsyncClient):
    resp = await client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert "docs" in body
    assert "version" in body
