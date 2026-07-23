"""APScheduler wrapper.

- Один job на канал, fires every `channel.poll_interval_minutes`.
- Stagger при старте (раскладываем next_run_time с шагом, чтобы не было пика).
- Глобальный Semaphore ограничивает параллелизм исходящих fetch'ей.
- Hooks для channel CRUD (add_or_update / remove).
"""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import Settings
from app.models import Channel
from app.pipeline.processor import PipelineProcessor

logger = logging.getLogger(__name__)


def _job_id(handle: str) -> str:
    return f"poll:{handle}"


class CuratorScheduler:
    def __init__(self, processor: PipelineProcessor, settings: Settings) -> None:
        self.processor = processor
        self.settings = settings
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        self._sem = asyncio.Semaphore(settings.poll_concurrency)
        self._started = False

    async def _run_channel(self, channel_id: int, handle: str) -> None:
        async with self._sem:
            try:
                result = await self.processor.process_channel(channel_id, limit=5)
                if result.error:
                    logger.warning("scheduler: %s failed: %s", handle, result.error)
            except Exception:  # noqa: BLE001
                logger.exception("scheduler: unhandled error for %s", handle)

    async def _run_recompute(self) -> None:
        """Периодический пересчёт дедуп-групп + rank_score ленты. Изолирован:
        любая ошибка логируется, но не трогает поллинг каналов."""
        try:
            from app.db import create_engine, create_session_maker, session_scope
            from app.ranking import recompute_feed_ranks

            engine = create_engine(self.settings.postgres_dsn)
            try:
                sf = create_session_maker(engine)
                async with session_scope(sf) as s:
                    res = await recompute_feed_ranks(s, apply=True)
                logger.info("scheduler: rank recompute %d rows → %d events (dedup −%d)", res.rows, res.groups, res.collapsed)
            finally:
                await engine.dispose()
        except Exception:  # noqa: BLE001
            logger.exception("scheduler: rank recompute failed")

    async def _run_moderation_cleanup(self) -> None:
        """Ночная чистка: прошедшие manual_review → rejected. Изолировано —
        ошибка логируется, но не трогает поллинг."""
        try:
            from app.cleanup_moderation import reject_past_manual_review
            from app.db import create_engine, create_session_maker, session_scope

            engine = create_engine(self.settings.postgres_dsn)
            try:
                sf = create_session_maker(engine)
                async with session_scope(sf) as s:
                    n = await reject_past_manual_review(s, apply=True)
                logger.info("scheduler: moderation cleanup — past manual_review → rejected: %d", n)
            finally:
                await engine.dispose()
        except Exception:  # noqa: BLE001
            logger.exception("scheduler: moderation cleanup failed")

    def add_or_update_channel(self, channel: Channel) -> None:
        if not channel.poll_enabled:
            self.remove_channel(channel.handle)
            return
        # Stagger first run: random offset in [10s, interval/2] so initial bursts spread
        max_offset = max(30, channel.poll_interval_minutes * 60 // 2)
        offset = random.randint(10, max_offset)
        next_run = datetime.utcnow() + timedelta(seconds=offset)
        self._scheduler.add_job(
            self._run_channel,
            trigger=IntervalTrigger(minutes=channel.poll_interval_minutes),
            args=(channel.id, channel.handle),
            id=_job_id(channel.handle),
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
            next_run_time=next_run,
        )
        logger.info(
            "scheduler: scheduled %s every %d min, next run at %s",
            channel.handle, channel.poll_interval_minutes, next_run.isoformat(timespec="seconds"),
        )

    def remove_channel(self, handle: str) -> None:
        try:
            self._scheduler.remove_job(_job_id(handle))
            logger.info("scheduler: removed %s", handle)
        except Exception:
            pass

    async def start(self, channels: list[Channel]) -> None:
        if self._started:
            return
        for ch in channels:
            self.add_or_update_channel(ch)
        # Периодический пересчёт ранга ленты (дедуп + rank_score). Первый прогон —
        # через 90с после старта, дальше каждые rank_recompute_minutes.
        self._scheduler.add_job(
            self._run_recompute,
            trigger=IntervalTrigger(minutes=self.settings.rank_recompute_minutes),
            id="rank:recompute",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
            next_run_time=datetime.utcnow() + timedelta(seconds=90),
        )
        # Ночная чистка очереди модерации: прошедшие manual_review → rejected (03:30 UTC).
        self._scheduler.add_job(
            self._run_moderation_cleanup,
            trigger=CronTrigger(hour=3, minute=30),
            id="moderation:cleanup",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=3600,
        )
        self._scheduler.start()
        self._started = True
        logger.info("scheduler: started with %d channels + rank recompute every %d min", len(channels), self.settings.rank_recompute_minutes)

    async def shutdown(self) -> None:
        if self._started:
            self._scheduler.shutdown(wait=False)
            self._started = False

    def list_jobs(self) -> list[dict]:
        return [
            {
                "id": j.id,
                "next_run_time": j.next_run_time.isoformat() if j.next_run_time else None,
                "interval_minutes": (
                    j.trigger.interval.total_seconds() / 60
                    if isinstance(j.trigger, IntervalTrigger) else None
                ),
            }
            for j in self._scheduler.get_jobs()
        ]

    async def trigger_now(self, channel_id: int, handle: str) -> None:
        """Force a one-off run NOW (independent of schedule)."""
        await self._run_channel(channel_id, handle)


_instance: Optional[CuratorScheduler] = None


def get_scheduler() -> CuratorScheduler | None:
    return _instance


def set_scheduler(s: CuratorScheduler) -> None:
    global _instance
    _instance = s
