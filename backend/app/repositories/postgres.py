from __future__ import annotations

from datetime import datetime
from typing import Sequence
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Event
from app.schemas import EventCard, EventIngestRequest


class PostgresEventsRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def upsert(self, request: EventIngestRequest) -> EventCard:
        async with self._session_factory() as session:
            existing = await self._find_by_channel_msg(session, request.channel, request.message_id)
            if existing:
                if not existing.media_urls and request.media_urls:
                    existing.media_urls = request.media_urls
                    await session.commit()
                return self._to_card(existing)
            event = Event(
                id=uuid4().hex,
                title=request.text[:120] if request.text else "Untitled",
                description=request.text,
                channel=request.channel,
                message_id=request.message_id,
                event_time=request.published_at,
                media_urls=request.media_urls,
                location=None,
                price=None,
                category=None,
                source_link=None,
                created_at=datetime.utcnow(),
            )
            session.add(event)
            await session.commit()
            await session.refresh(event)
            return self._to_card(event)

    async def list_recent(self, limit: int = 50) -> list[EventCard]:
        async with self._session_factory() as session:
            result = await session.scalars(select(Event).order_by(Event.created_at.desc()).limit(limit))
            records: Sequence[Event] = result.all()
            return [self._to_card(item) for item in records]

    async def _find_by_channel_msg(self, session: AsyncSession, channel: str, message_id: int) -> Event | None:
        return await session.scalar(
            select(Event).where(Event.channel == channel).where(Event.message_id == message_id).limit(1)
        )

    @staticmethod
    def _to_card(event: Event) -> EventCard:
        return EventCard(
            id=event.id,
            title=event.title,
            description=event.description,
            channel=event.channel,
            message_id=event.message_id,
            event_time=event.event_time,
            media_urls=event.media_urls,
            location=event.location,
            price=event.price,
            category=event.category,
            source_link=event.source_link,
            created_at=event.created_at,
        )

