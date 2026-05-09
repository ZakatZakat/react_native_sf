"""Pydantic request/response schemas. Kept separate from ORM models."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_handle(h: str) -> str:
    """@Handle / handle / t.me/handle → @handle (lowercased)."""
    s = h.strip()
    if s.startswith("https://t.me/"):
        s = s[len("https://t.me/"):]
    if s.startswith("t.me/"):
        s = s[len("t.me/"):]
    if s.startswith("@"):
        s = s[1:]
    return f"@{s}"


# ── Channel ─────────────────────────────────────────────────────────
class ChannelCreate(BaseModel):
    handle: str = Field(..., min_length=2, max_length=128)
    poll_enabled: bool = True
    poll_interval_minutes: int = Field(30, ge=5, le=1440)
    weight: float = Field(1.0, ge=0.0, le=10.0)

    @field_validator("handle")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return normalize_handle(v)


class ChannelUpdate(BaseModel):
    poll_enabled: Optional[bool] = None
    poll_interval_minutes: Optional[int] = Field(None, ge=5, le=1440)
    weight: Optional[float] = Field(None, ge=0.0, le=10.0)
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None


class ChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    handle: str
    title: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    subs: Optional[int] = None
    poll_enabled: bool
    poll_interval_minutes: int
    last_polled_at: Optional[datetime] = None
    last_message_id: Optional[int] = None
    weight: float
    created_at: datetime
