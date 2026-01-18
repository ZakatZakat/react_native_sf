from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import uuid4

from app.schemas import EventCard, EventIngestRequest


class EventsRepository(Protocol):
    async def upsert(self, request: EventIngestRequest) -> EventCard: ...

    async def list_recent(self, limit: int = 50) -> list[EventCard]: ...


class InMemoryEventsRepository(EventsRepository):
    def __init__(self) -> None:
        self._store: dict[str, EventCard] = {}

    async def upsert(self, request: EventIngestRequest) -> EventCard:
        existing = self._find_by_channel_msg(request.channel, request.message_id)
        if existing:
            return existing
        event_id = uuid4().hex
        card = EventCard(
            id=event_id,
            title=request.text[:120] if request.text else "Untitled",
            description=request.text,
            channel=request.channel,
            message_id=request.message_id,
            event_time=request.published_at,
            location=None,
            price=None,
            category=None,
            source_link=None,
            created_at=datetime.utcnow(),
        )
        self._store[event_id] = card
        return card

    async def list_recent(self, limit: int = 50) -> list[EventCard]:
        return sorted(self._store.values(), key=lambda item: item.created_at, reverse=True)[:limit]

    def _find_by_channel_msg(self, channel: str, message_id: int) -> EventCard | None:
        for card in self._store.values():
            if card.channel == channel and card.message_id == message_id:
                return card
        return None

