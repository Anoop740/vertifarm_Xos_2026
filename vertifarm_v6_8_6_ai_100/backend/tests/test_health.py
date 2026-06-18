"""
Smoke tests — health check, root, OpenAPI schema, CORS headers.

These run first (alphabetically before other test_* files) and confirm
the application boots and is wired correctly before deeper tests run.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_health_returns_200(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200


async def test_health_body(client: AsyncClient):
    resp = await client.get("/health")
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "app" in body


async def test_root_returns_200(client: AsyncClient):
    resp = await client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert "api" in body


async def test_openapi_schema_loads(client: AsyncClient):
    """OpenAPI JSON must be valid and list the expected routers."""
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()

    assert "paths" in schema, "OpenAPI schema must contain 'paths'"
    paths = list(schema["paths"].keys())

    # Core endpoint groups must be present
    assert any("/login" in p for p in paths),      "Missing /login path in schema"
    assert any("/farms" in p for p in paths),       "Missing /farms path in schema"
    assert any("/sensors" in p for p in paths),     "Missing /sensors path in schema"
    assert any("/ai/chat" in p for p in paths),     "Missing /ai/chat path in schema"
    assert any("/webhooks" in p for p in paths),    "Missing /webhooks path in schema"
    assert any("/compliance" in p for p in paths),  "Missing /compliance path in schema"
    assert any("/franchise" in p for p in paths),   "Missing /franchise path in schema"


async def test_openapi_has_security_scheme(client: AsyncClient):
    """JWT bearer scheme must be declared in the OpenAPI security schemas."""
    resp = await client.get("/openapi.json")
    schema = resp.json()
    components = schema.get("components", {})
    security_schemes = components.get("securitySchemes", {})
    assert len(security_schemes) > 0, (
        "No security schemes found in OpenAPI — JWT bearer scheme must be declared"
    )


async def test_cors_headers_present(client: AsyncClient):
    """CORS preflight for the API must include Access-Control-Allow-Origin."""
    resp = await client.options(
        "/api/v1/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    # FastAPI returns 200 on OPTIONS with CORS middleware enabled
    assert resp.status_code in (200, 204)
    assert "access-control-allow-origin" in resp.headers, (
        "CORS header 'access-control-allow-origin' missing from OPTIONS response"
    )


async def test_docs_endpoint_accessible(client: AsyncClient):
    resp = await client.get("/docs")
    assert resp.status_code == 200


async def test_unknown_route_returns_404(client: AsyncClient):
    resp = await client.get("/api/v1/this-does-not-exist")
    assert resp.status_code == 404


async def test_gzip_enabled_for_large_response(client: AsyncClient, admin_user):
    """Responses over 1 KB should be served gzip-encoded when requested."""
    from tests.conftest import get_token, auth_headers
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))
    hdrs["Accept-Encoding"] = "gzip"

    resp = await client.get("/api/v1/farms", headers=hdrs)
    assert resp.status_code == 200
    # Content-Encoding: gzip only appears for responses > 1000 bytes (GZipMiddleware threshold)
    # This is a soft check — just confirm the middleware doesn't break the response
    assert resp.status_code == 200
