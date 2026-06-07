"""Repositories for posts_raw, events_curated, moderation_queue, ingest_runs."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    EventCurated,
    EventStatus,
    IngestRun,
    IngestStatus,
    ModerationQueue,
    PostRaw,
)
from app.pipeline.detector import DetectionResult
from app.pipeline.enricher import EnrichmentResult
from app.services.tg_client import RawMessage


class PostsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def insert_unseen(
        self, channel_id: int, messages: Sequence[RawMessage]
    ) -> list[PostRaw]:
        """Insert messages that aren't yet in DB. Returns the newly-inserted rows."""
        if not messages:
            return []

        # ON CONFLICT DO NOTHING + RETURNING — atomic dedup
        rows = []
        for m in messages:
            if not m.text and not m.media_urls:
                continue  # ignore truly-empty
            rows.append({
                "channel_id": channel_id,
                "message_id": m.message_id,
                "text": m.text,
                "media_urls": m.media_urls,
                "published_at": m.published_at,
            })

        if not rows:
            return []

        stmt = pg_insert(PostRaw).values(rows).on_conflict_do_nothing(
            index_elements=["channel_id", "message_id"]
        ).returning(PostRaw)

        result = await self.s.execute(stmt)
        return list(result.scalars().all())


class EventsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def insert(
        self,
        post: PostRaw,
        detection: DetectionResult,
        enrichment: EnrichmentResult,
        status: EventStatus,
    ) -> EventCurated:
        ev = EventCurated(
            post_id=post.id,
            event_time=enrichment.event_time,
            event_time_end=enrichment.event_time_end,
            location_text=enrichment.location_text,
            price_text=enrichment.price_text,
            price_kopecks=enrichment.price_kopecks,
            filter_score=detection.score,
            filter_reasons=detection.reasons,
            status=status,
        )
        self.s.add(ev)
        await self.s.flush()
        return ev

    async def list_approved(
        self, *, limit: int = 50, offset: int = 0
    ) -> Sequence[EventCurated]:
        stmt = (
            select(EventCurated)
            .where(EventCurated.status == EventStatus.approved)
            .order_by(EventCurated.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.s.execute(stmt)
        return result.scalars().all()

    async def get(self, event_id: int) -> EventCurated | None:
        return await self.s.get(EventCurated, event_id)


class ModerationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def enqueue(self, event_id: int) -> ModerationQueue:
        mq = ModerationQueue(event_id=event_id, status=EventStatus.manual_review)
        self.s.add(mq)
        await self.s.flush()
        return mq

    async def list_pending(self, limit: int = 50, offset: int = 0) -> Sequence[tuple]:
        from app.models import PostRaw, Channel
        stmt = (
            select(EventCurated, PostRaw, Channel)
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .join(Channel, Channel.id == PostRaw.channel_id)
            .where(EventCurated.status == EventStatus.manual_review)
            .order_by(EventCurated.filter_score.desc(), EventCurated.created_at.desc())
            .limit(limit).offset(offset)
        )
        return list((await self.s.execute(stmt)).all())

    async def list_events(
        self,
        status: EventStatus | None = None,
        limit: int = 30,
        offset: int = 0,
    ) -> Sequence[tuple]:
        """Browse curated events with their source post + channel, optionally
        filtered by status (None = all). Newest first."""
        from app.models import PostRaw, Channel
        stmt = (
            select(EventCurated, PostRaw, Channel)
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .join(Channel, Channel.id == PostRaw.channel_id)
        )
        if status is not None:
            stmt = stmt.where(EventCurated.status == status)
        stmt = stmt.order_by(EventCurated.created_at.desc()).limit(limit).offset(offset)
        return list((await self.s.execute(stmt)).all())

    async def approve(self, event_id: int, reviewed_by: int) -> EventCurated:
        ev = await self.s.get(EventCurated, event_id)
        if not ev:
            raise ValueError(f"event {event_id} not found")
        ev.status = EventStatus.approved
        # Update queue row if present
        mq = await self.s.get(ModerationQueue, event_id)
        if mq:
            mq.status = EventStatus.approved
            mq.reviewed_by = reviewed_by
            mq.reviewed_at = datetime.utcnow()
        await self.s.flush()
        return ev

    async def reject(self, event_id: int, reviewed_by: int, reason: str | None = None) -> EventCurated:
        ev = await self.s.get(EventCurated, event_id)
        if not ev:
            raise ValueError(f"event {event_id} not found")
        ev.status = EventStatus.rejected
        mq = await self.s.get(ModerationQueue, event_id)
        if mq:
            mq.status = EventStatus.rejected
            mq.reviewed_by = reviewed_by
            mq.reviewed_at = datetime.utcnow()
            mq.reject_reason = reason
        await self.s.flush()
        return ev


class IngestRunsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def log(
        self,
        channel_id: int,
        *,
        status: IngestStatus,
        posts_fetched: int = 0,
        posts_new: int = 0,
        events_extracted: int = 0,
        error: str | None = None,
        started_at: datetime | None = None,
    ) -> IngestRun:
        run = IngestRun(
            channel_id=channel_id,
            started_at=started_at or datetime.utcnow(),
            finished_at=datetime.utcnow(),
            status=status,
            posts_fetched=posts_fetched,
            posts_new=posts_new,
            events_extracted=events_extracted,
            error=error,
        )
        self.s.add(run)
        await self.s.flush()
        return run
