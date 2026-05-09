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
        self._scheduler.start()
        self._started = True
        logger.info("scheduler: started with %d channels", len(channels))

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
