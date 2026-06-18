"""
AI Chat endpoint — FIX-3: replaces keyword-matching with a real LLM.

POST /api/v1/ai/chat
  body: { "message": str, "history": [{role, content}] }
  returns: { "reply": str, "model": str }

Supports OpenAI (gpt-4o-mini default) and Anthropic (claude-haiku default).
Falls back to a clear informational message if neither API key is configured.
Never exposes API keys to the frontend.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import httpx, json, logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.v1.endpoints.auth import get_current_user
from app.models.models import User, Farm, Zone, Alert, Crop
from app.db.session import get_db
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()

AGRONOMY_SYSTEM_PROMPT = """You are an expert AI Agronomist for VertiFarm XOS, a precision vertical farming platform.
You have deep knowledge of:
- Hydroponics, aeroponics, NFT, DWC, and rack-based growing systems
- Plant nutrition (EC, pH, NPK ratios, micronutrients)
- Climate management (temperature, humidity, CO2, VPD)
- Crop-specific growing protocols (lettuce, herbs, tomatoes, microgreens)
- Pest and disease identification and integrated pest management
- Energy optimisation and lighting schedules
- Harvest readiness and post-harvest handling
- Food safety (FSSAI, GlobalGAP compliance)

You respond concisely with actionable recommendations. When asked about specific sensor values,
acknowledge you need real sensor data to give precise advice. Always be honest about what you know vs
what requires real-time data from the farm.

Current platform context is provided in the user message if available."""


class ChatMessage(BaseModel):
    role: str    # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    farm_context: Optional[dict] = None   # optional: pass farm stats for richer answers


async def _build_context(db: AsyncSession, user: User) -> str:
    """Build a brief real farm context string from the DB."""
    try:
        org_id = user.organization_id
        if not org_id:
            return ""
        farms_count = (await db.execute(
            select(func.count(Farm.id)).where(Farm.organization_id == org_id, Farm.is_active == True)
        )).scalar() or 0
        zones_count = (await db.execute(
            select(func.count(Zone.id)).where(
                Zone.farm_id.in_(select(Farm.id).where(Farm.organization_id == org_id))
            )
        )).scalar() or 0
        active_alerts = (await db.execute(
            select(func.count(Alert.id)).where(
                Alert.is_resolved == False,
                Alert.farm_id.in_(select(Farm.id).where(Farm.organization_id == org_id))
            )
        )).scalar() or 0
        active_crops = (await db.execute(
            select(func.count(Crop.id)).where(
                Crop.farm_id.in_(select(Farm.id).where(Farm.organization_id == org_id))
            )
        )).scalar() or 0
        return (
            f"\n\n[Farm Context: {farms_count} farm(s), {zones_count} zone(s), "
            f"{active_crops} active crop batches, {active_alerts} unresolved alert(s)]"
        )
    except Exception:
        return ""


async def _call_openai(messages: list, context: str) -> str:
    system = AGRONOMY_SYSTEM_PROMPT + context
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 500,
        "temperature": 0.3,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                     "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def _call_anthropic(messages: list, context: str) -> str:
    system = AGRONOMY_SYSTEM_PROMPT + context
    # Convert to Anthropic message format
    anthropic_messages = [
        {"role": m["role"] if m["role"] != "assistant" else "assistant",
         "content": m["content"]}
        for m in messages
    ]
    payload = {
        "model": settings.ANTHROPIC_MODEL,
        "max_tokens": 500,
        "system": system,
        "messages": anthropic_messages,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"].strip()


@router.post("/ai/chat", tags=["AI — Copilot"])
@limiter.limit("20/minute")
async def ai_chat(
    request: Request,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Real AI Agronomist chat endpoint.
    Uses OpenAI or Anthropic depending on which key is configured.
    Returns an honest fallback when no API key is set.
    """
    # Build context from real DB data
    context = await _build_context(db, current_user)

    # Assemble message history
    messages = [
        {"role": m.role if m.role in ("user", "assistant") else "user",
         "content": m.content}
        for m in body.history[-8:]   # keep last 8 turns to manage token cost
    ]
    messages.append({"role": "user", "content": body.message + context})

    model_used = "none"
    reply = ""

    try:
        if settings.OPENAI_API_KEY:
            reply = await _call_openai(messages, context)
            model_used = settings.OPENAI_MODEL
        elif settings.ANTHROPIC_API_KEY:
            reply = await _call_anthropic(messages, context)
            model_used = settings.ANTHROPIC_MODEL
        else:
            # Honest fallback — no fake keyword matching
            reply = (
                "The AI Agronomist is not yet configured. "
                "To enable real AI responses, set OPENAI_API_KEY or ANTHROPIC_API_KEY "
                "in your .env file. Your question was: \"" + body.message + "\""
            )
            model_used = "not-configured"
    except httpx.HTTPStatusError as exc:
        logger.error("LLM API error: %s — %s", exc.response.status_code, exc.response.text[:200])
        raise HTTPException(
            502,
            detail="AI service returned an error. Check your API key and quota.",
        )
    except httpx.RequestError as exc:
        logger.error("LLM network error: %s", exc)
        raise HTTPException(503, detail="Could not reach AI service. Check network connectivity.")
    except Exception as exc:
        logger.exception("Unexpected AI chat error")
        raise HTTPException(500, detail="Unexpected error in AI chat.")

    return {"reply": reply, "model": model_used}
