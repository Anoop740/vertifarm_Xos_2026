"""
Auth flow tests — login, token refresh, inactive guard, bad credentials.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import _make_org, _make_user, get_token, auth_headers

pytestmark = pytest.mark.asyncio


async def test_login_success(client: AsyncClient, admin_user):
    user, pw = admin_user
    resp = await client.post("/api/v1/login", json={"email": user.email, "password": pw})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient, admin_user):
    user, _ = admin_user
    resp = await client.post("/api/v1/login", json={"email": user.email, "password": "WrongPass!"})
    assert resp.status_code == 401


async def test_login_unknown_email(client: AsyncClient):
    resp = await client.post("/api/v1/login", json={"email": "nobody@example.com", "password": "x"})
    assert resp.status_code == 401


async def test_login_inactive_user(client: AsyncClient, db_session: AsyncSession, org):
    user, pw = await _make_user(db_session, org, role="org_admin", email="inactive@test.io")
    user.is_active = False
    await db_session.flush()

    resp = await client.post("/api/v1/login", json={"email": user.email, "password": pw})
    assert resp.status_code in (401, 403), (
        "Inactive user should be rejected at login"
    )


async def test_token_refresh(client: AsyncClient, admin_user):
    user, pw = admin_user
    login = await client.post("/api/v1/login", json={"email": user.email, "password": pw})
    refresh_token = login.json()["refresh_token"]

    resp = await client.post("/api/v1/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_refresh_with_access_token_rejected(client: AsyncClient, admin_user):
    """Using an access token as a refresh token must be rejected."""
    user, pw = admin_user
    login = await client.post("/api/v1/login", json={"email": user.email, "password": pw})
    access_token = login.json()["access_token"]

    resp = await client.post("/api/v1/refresh", json={"refresh_token": access_token})
    assert resp.status_code in (401, 422)


async def test_me_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/me")
    assert resp.status_code == 401


async def test_me_returns_profile(client: AsyncClient, admin_user):
    user, pw = admin_user
    token = await get_token(client, user.email, pw)
    resp = await client.get("/api/v1/me", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["email"] == user.email
