"""
Audit Log tests — emit, query, stats, RBAC, CSV export.
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import _make_org, _make_user, get_token, auth_headers
from app.services.audit import emit_audit, audit_resource
from app.models.models import AuditLog

pytestmark = pytest.mark.asyncio


# ─── Service layer ────────────────────────────────────────────────────────────

async def test_emit_audit_creates_row(db_session: AsyncSession, org):
    user, _ = await _make_user(db_session, org)
    entry = await emit_audit(
        db_session,
        event_type="farm.create",
        event_category="farm",
        actor=user,
        resource_type="Farm",
        resource_id=str(uuid.uuid4()),
        resource_name="Test Farm",
        after_state={"name": "Test Farm"},
    )
    await db_session.flush()
    assert entry.id is not None
    assert entry.event_type == "farm.create"
    assert entry.actor_id == user.id
    assert entry.actor_email == user.email
    assert entry.status == "success"


async def test_audit_resource_convenience(db_session: AsyncSession, org):
    user, _ = await _make_user(db_session, org)
    entry = await audit_resource(
        db_session,
        category="zone",
        verb="delete",
        resource_type="Zone",
        resource_id="zone-xyz",
        resource_name="Zone A",
        actor=user,
    )
    await db_session.flush()
    assert entry.event_type == "zone.delete"
    assert entry.event_category == "zone"


async def test_emit_audit_no_actor(db_session: AsyncSession, org):
    """System events may have no actor."""
    entry = await emit_audit(
        db_session,
        event_type="system.startup",
        event_category="system",
        organization_id=org.id,
        meta={"version": "1.0.0"},
    )
    await db_session.flush()
    assert entry.actor_id is None
    assert entry.event_category == "system"


# ─── API layer ────────────────────────────────────────────────────────────────

async def test_list_audit_logs_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/audit-logs")
    assert resp.status_code == 401


async def test_viewer_cannot_access_audit_logs(
    client: AsyncClient, admin_user, viewer_user
):
    _, vpw = viewer_user
    vuser, _ = viewer_user
    v_tok = await get_token(client, vuser.email, vpw)
    resp = await client.get("/api/v1/audit-logs", headers=auth_headers(v_tok))
    assert resp.status_code == 403


async def test_admin_can_list_audit_logs(
    client: AsyncClient, db_session: AsyncSession, admin_user, org
):
    admin, apw = admin_user
    # Seed an audit row
    await emit_audit(
        db_session,
        event_type="test.event",
        event_category="test",
        organization_id=org.id,
        actor_id=admin.id,
        actor_email=admin.email,
        actor_role=admin.role,
    )
    await db_session.commit()

    a_tok = await get_token(client, admin.email, apw)
    resp = await client.get("/api/v1/audit-logs", headers=auth_headers(a_tok))
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["items"], list)


async def test_audit_logs_pagination(
    client: AsyncClient, db_session: AsyncSession, admin_user, org
):
    admin, apw = admin_user
    # Seed 5 rows
    for i in range(5):
        await emit_audit(
            db_session,
            event_type=f"test.event_{i}",
            event_category="test",
            organization_id=org.id,
        )
    await db_session.commit()

    a_tok = await get_token(client, admin.email, apw)
    resp = await client.get(
        "/api/v1/audit-logs?page=1&page_size=2",
        headers=auth_headers(a_tok),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) <= 2
    assert body["page"] == 1
    assert body["page_size"] == 2


async def test_audit_logs_filter_by_category(
    client: AsyncClient, db_session: AsyncSession, admin_user, org
):
    admin, apw = admin_user
    await emit_audit(db_session, event_type="farm.create", event_category="farm",
                     organization_id=org.id)
    await emit_audit(db_session, event_type="auth.login", event_category="auth",
                     organization_id=org.id)
    await db_session.commit()

    a_tok = await get_token(client, admin.email, apw)
    resp = await client.get(
        "/api/v1/audit-logs?category=farm",
        headers=auth_headers(a_tok),
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(i["event_category"] == "farm" for i in items)


async def test_audit_stats_endpoint(
    client: AsyncClient, db_session: AsyncSession, admin_user, org
):
    admin, apw = admin_user
    await emit_audit(db_session, event_type="farm.create", event_category="farm",
                     organization_id=org.id, actor_id=admin.id, actor_email=admin.email,
                     actor_role=admin.role)
    await db_session.commit()

    a_tok = await get_token(client, admin.email, apw)
    resp = await client.get("/api/v1/audit-logs/stats", headers=auth_headers(a_tok))
    assert resp.status_code == 200
    body = resp.json()
    assert "total_events" in body
    assert "top_actors" in body
    assert "by_category" in body


async def test_audit_get_single(
    client: AsyncClient, db_session: AsyncSession, admin_user, org
):
    admin, apw = admin_user
    entry = await emit_audit(
        db_session,
        event_type="zone.create",
        event_category="zone",
        organization_id=org.id,
    )
    await db_session.commit()

    a_tok = await get_token(client, admin.email, apw)
    resp = await client.get(f"/api/v1/audit-logs/{entry.id}", headers=auth_headers(a_tok))
    assert resp.status_code == 200
    assert resp.json()["event_type"] == "zone.create"


async def test_audit_get_nonexistent(client: AsyncClient, admin_user):
    admin, apw = admin_user
    a_tok = await get_token(client, admin.email, apw)
    resp = await client.get(f"/api/v1/audit-logs/{uuid.uuid4()}", headers=auth_headers(a_tok))
    assert resp.status_code == 404


async def test_audit_csv_export(
    client: AsyncClient, db_session: AsyncSession, admin_user, org
):
    admin, apw = admin_user
    await emit_audit(db_session, event_type="billing.plan_change", event_category="billing",
                     organization_id=org.id)
    await db_session.commit()

    a_tok = await get_token(client, admin.email, apw)
    resp = await client.get("/api/v1/audit-logs/export/csv", headers=auth_headers(a_tok))
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers.get("content-disposition", "")
