"""
Shared pytest fixtures for VertiFarm XOS backend tests.

Uses an in-memory SQLite database (via aiosqlite) so tests run without
a live Postgres instance.  All fixtures are async-native.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.db.session import get_db
from app.models.models import Base, User, Organization
from app.core.security import hash_password
from app.main import app

# ──────────────────────────────────────────────────────────────────────────
# In-memory SQLite engine — isolated per test session
# ──────────────────────────────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables once for the test session."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a fresh DB session for each test, rolled back after."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture()
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTPX async client wired to the FastAPI app with the test DB session."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────
# Seed helpers
# ──────────────────────────────────────────────────────────────────────────

async def _make_org(db: AsyncSession, name: str = "Test Org") -> Organization:
    org = Organization(id=str(uuid.uuid4()), name=name, plan="growth")
    db.add(org)
    await db.flush()
    return org


async def _make_user(
    db: AsyncSession,
    org: Organization,
    role: str = "org_admin",
    email: str | None = None,
    password: str = "TestPass123!",
) -> tuple[User, str]:
    """Create a user and return (user, plain_password)."""
    email = email or f"{role}-{uuid.uuid4().hex[:6]}@test.io"
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
        organization_id=org.id,
    )
    db.add(user)
    await db.flush()
    return user, password


@pytest_asyncio.fixture()
async def org(db_session: AsyncSession) -> Organization:
    return await _make_org(db_session)


@pytest_asyncio.fixture()
async def admin_user(db_session: AsyncSession, org: Organization):
    user, pw = await _make_user(db_session, org, role="org_admin")
    return user, pw


@pytest_asyncio.fixture()
async def viewer_user(db_session: AsyncSession, org: Organization):
    user, pw = await _make_user(db_session, org, role="viewer")
    return user, pw


@pytest_asyncio.fixture()
async def operator_user(db_session: AsyncSession, org: Organization):
    user, pw = await _make_user(db_session, org, role="operator")
    return user, pw


async def get_token(client: AsyncClient, email: str, password: str) -> str:
    """Helper: log in and return the access token string."""
    resp = await client.post(
        "/api/v1/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
