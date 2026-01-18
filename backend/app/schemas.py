from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, HttpUrl, Field


class EventCard(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    channel: str
    message_id: int
    event_time: Optional[datetime] = None
    media_urls: list[str] = []
    location: Optional[str] = None
    price: Optional[str] = None
    category: Optional[str] = None
    source_link: Optional[HttpUrl] = None
    created_at: datetime


class EventIngestRequest(BaseModel):
    channel: str
    message_id: int
    text: str
    media_urls: list[str] = []
    published_at: Optional[datetime] = None


class TelegramAuthUser(BaseModel):
    telegram_id: int = Field(..., alias="id")
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    language_code: Optional[str] = None


class UserProfile(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    photo_url: Optional[str] = None
    language_code: Optional[str] = None
    city: Optional[str] = None
    interests: list[str] = []
    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(BaseModel):
    city: Optional[str] = None
    interests: Optional[list[str]] = None


class TelegramAuthRequest(BaseModel):
    init_data: Optional[str] = None
    init_data_b64: Optional[str] = None


class TelegramAuthUpdateRequest(BaseModel):
    init_data: Optional[str] = None
    init_data_b64: Optional[str] = None
    city: Optional[str] = None
    interests: Optional[list[str]] = None


class ClientErrorReport(BaseModel):
    message: str
    stack: Optional[str] = None
    url: Optional[str] = None
    user_agent: Optional[str] = None
    tag: Optional[str] = None

