"""Per-channel processing pipeline.

Steps:
  1. fetch raw messages from services/telegram
  2. dedup against posts_raw (insert new ones)
  3. for each new post:
     a. detect_event() — score by rules
     b. if score < REVIEW_THRESHOLD → skip (rejected, not stored as event)
     c. enrich_event() — extract structure
     d. insert into events_curated with status:
        - score >= AUTO_THRESHOLD → approved
        - else → manual_review (also enqueued in moderation_queue)
  4. mark_polled on channel + log ingest_run
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.config import Settings
from app.db import session_scope
from app.models import Channel, EventStatus, IngestStatus
from app.pipeline.classifier import KeywordClassifier
from app.pipeline.detector import detect_event
from app.pipeline.enricher import enrich_event
from app.repositories.channels import ChannelsRepository
from app.repositories.posts import (
    EventsRepository,
    IngestRunsRepository,
    ModerationRepository,
    PostsRepository,
)
from app.repositories.tags import EventTagsRepository, TagsRepository
from app.services.tg_client import TelegramServiceClient

logger = logging.getLogger(__name__)


@dataclass
class ChannelRunResult:
    channel_handle: str
    posts_fetched: int
    posts_new: int
    events_approved: int
    events_review: int
    events_rejected: int
    error: Optional[str] = None


class PipelineProcessor:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        tg_client: TelegramServiceClient,
        settings: Settings,
    ) -> None:
        self.sf = session_factory
        self.tg = tg_client
        self.settings = settings
        self.classifier = KeywordClassifier()
        self.push_service: object | None = None  # set externally to enable fanout

    async def process_channel(self, channel_id: int, *, limit: int = 20) -> ChannelRunResult:
        started = datetime.utcnow()
        async with session_scope(self.sf) as s:
            channels = ChannelsRepository(s)
            ch = await channels.get_by_id(channel_id)
            if not ch:
                return ChannelRunResult("?", 0, 0, 0, 0, 0, error="channel not found")

        # 1) FETCH (separate session — long external call, no transaction held)
        try:
            raw = await self.tg.fetch(ch.handle, limit=limit)
        except Exception as e:
            logger.exception("fetch failed for %s", ch.handle)
            async with session_scope(self.sf) as s:
                runs = IngestRunsRepository(s)
                await runs.log(
                    channel_id, status=IngestStatus.failed,
                    error=f"fetch: {e!s}"[:500], started_at=started,
                )
            return ChannelRunResult(ch.handle, 0, 0, 0, 0, 0, error=str(e))

        # 2) DEDUP + STORE_RAW + 3) DETECT/ENRICH/STORE_EVENT + 4) CLASSIFY
        approved = review = rejected = 0
        last_msg_id: int | None = ch.last_message_id
        async with session_scope(self.sf) as s:
            posts_repo = PostsRepository(s)
            events_repo = EventsRepository(s)
            mod_repo = ModerationRepository(s)
            channels_repo = ChannelsRepository(s)
            tags_repo = TagsRepository(s)
            event_tags_repo = EventTagsRepository(s)

            # Load taxonomy once per run
            tags_list = list(await tags_repo.list_all())

            new_posts = await posts_repo.insert_unseen(channel_id, raw)
            for p in new_posts:
                if p.message_id and (last_msg_id is None or p.message_id > last_msg_id):
                    last_msg_id = p.message_id

                detection = detect_event(p.text)
                if not detection.is_event_review:
                    rejected += 1
                    continue
                enrichment = enrich_event(
                    p.text, detection.hits, published_at=p.published_at, channel_handle=ch.handle
                )
                status = (
                    EventStatus.approved
                    if detection.is_event_auto
                    else EventStatus.manual_review
                )
                ev = await events_repo.insert(p, detection, enrichment, status)
                if status == EventStatus.manual_review:
                    await mod_repo.enqueue(ev.id)
                    review += 1
                else:
                    approved += 1

                # Classify
                assignments = self.classifier.classify(p.text, tags_list)
                if assignments:
                    await event_tags_repo.attach_many(
                        ev.id,
                        [(a.tag_id, a.confidence) for a in assignments],
                    )

                # Schedule push fanout for auto-approved events
                if status == EventStatus.approved and self.push_service is not None:
                    import asyncio as _asyncio
                    _asyncio.create_task(self.push_service.fanout_for_event(ev.id))

            await channels_repo.mark_polled(channel_id, last_msg_id)

            runs = IngestRunsRepository(s)
            await runs.log(
                channel_id,
                status=IngestStatus.success,
                posts_fetched=len(raw),
                posts_new=len(new_posts),
                events_extracted=approved + review,
                started_at=started,
            )

        result = ChannelRunResult(
            channel_handle=ch.handle,
            posts_fetched=len(raw),
            posts_new=len(new_posts),
            events_approved=approved,
            events_review=review,
            events_rejected=rejected,
        )
        logger.info(
            "channel %s: fetched=%d new=%d approved=%d review=%d rejected=%d",
            ch.handle, result.posts_fetched, result.posts_new,
            result.events_approved, result.events_review, result.events_rejected,
        )
        return result
