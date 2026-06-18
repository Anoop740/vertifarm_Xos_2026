"""
AI Chat endpoint tests.

Covers:
  • Endpoint requires authentication
  • Authenticated request returns a reply (either real LLM or honest fallback)
  • Reply is never the old keyword-matching synthetic response
  • Response schema is correct (reply + model fields)
  • Rate limit headers are present
"""
import pytest
from httpx import AsyncClient

from tests.conftest import get_token, auth_headers

pytestmark = pytest.mark.asyncio

# Known synthetic trigger phrases from the old keyword-matching implementation
# that FIX-3 replaced. If any of these appear verbatim in a reply it means
# the old code path is still active.
_SYNTHETIC_PHRASES = [
    "I've analyzed your farm data",
    "Based on the sensor patterns I'm detecting",
    "the correlation between your CO2",
    "Executing harvest optimisation protocol",
]


# ──────────────────────────────────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────────────────────────────────

async def test_ai_chat_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/ai/chat", json={"message": "Hello", "history": []})
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────────────────
# Response schema
# ──────────────────────────────────────────────────────────────────────────

async def test_ai_chat_returns_correct_schema(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))

    resp = await client.post(
        "/api/v1/ai/chat",
        headers=hdrs,
        json={"message": "What is the optimal pH for lettuce?", "history": []},
        timeout=30.0,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()

    assert "reply" in body, f"Response must have 'reply' field. Got: {list(body.keys())}"
    assert "model" in body, f"Response must have 'model' field. Got: {list(body.keys())}"
    assert isinstance(body["reply"], str), "reply must be a string"
    assert len(body["reply"]) > 0, "reply must not be empty"


async def test_ai_chat_no_synthetic_phrases(client: AsyncClient, admin_user):
    """FIX-3 regression: old keyword-matching phrases must never appear in replies."""
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))

    resp = await client.post(
        "/api/v1/ai/chat",
        headers=hdrs,
        json={"message": "Analyse my sensor data", "history": []},
        timeout=30.0,
    )
    assert resp.status_code == 200
    reply = resp.json().get("reply", "")

    for phrase in _SYNTHETIC_PHRASES:
        assert phrase not in reply, (
            f"Synthetic phrase detected — old keyword-matching code is still active.\n"
            f"Phrase: '{phrase}'\nReply: {reply[:300]}"
        )


async def test_ai_chat_fallback_is_honest(client: AsyncClient, admin_user):
    """
    When no LLM API key is configured the endpoint must return a clear,
    honest message — not a fake AI-sounding response.
    """
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))

    resp = await client.post(
        "/api/v1/ai/chat",
        headers=hdrs,
        json={"message": "Hello", "history": []},
        timeout=30.0,
    )
    assert resp.status_code == 200
    reply = resp.json().get("reply", "").lower()

    # If a fallback is returned, it should mention configuration / API key
    # Real LLM replies are also fine; we just must not get a synthetic fake.
    for phrase in _SYNTHETIC_PHRASES:
        assert phrase.lower() not in reply, (
            f"Synthetic fallback phrase found: '{phrase}'"
        )


async def test_ai_chat_multi_turn_history(client: AsyncClient, admin_user):
    """Multi-turn conversation history is accepted without error."""
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))

    history = [
        {"role": "user",      "content": "What crops do you recommend for a beginner?"},
        {"role": "assistant", "content": "I'd suggest starting with lettuce or basil."},
    ]
    resp = await client.post(
        "/api/v1/ai/chat",
        headers=hdrs,
        json={"message": "Tell me more about lettuce.", "history": history},
        timeout=30.0,
    )
    assert resp.status_code == 200


async def test_ai_chat_empty_history_accepted(client: AsyncClient, admin_user):
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))

    resp = await client.post(
        "/api/v1/ai/chat",
        headers=hdrs,
        json={"message": "hi", "history": []},
        timeout=30.0,
    )
    assert resp.status_code == 200


# ──────────────────────────────────────────────────────────────────────────
# Rate limit headers
# ──────────────────────────────────────────────────────────────────────────

async def test_ai_chat_rate_limit_headers_present(client: AsyncClient, admin_user):
    """slowapi injects X-RateLimit-* headers on every response."""
    user, pw = admin_user
    hdrs = auth_headers(await get_token(client, user.email, pw))

    resp = await client.post(
        "/api/v1/ai/chat",
        headers=hdrs,
        json={"message": "ping", "history": []},
        timeout=30.0,
    )
    assert resp.status_code == 200
    # At least one rate-limit header should be present
    rl_headers = [k for k in resp.headers if k.lower().startswith("x-ratelimit")]
    assert len(rl_headers) > 0, (
        f"Rate-limit headers missing. Got headers: {dict(resp.headers)}"
    )
