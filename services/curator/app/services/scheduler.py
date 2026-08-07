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

_RU_MONTHS = (
    "", "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
)


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _reminder_text(title: str, venue: str | None, event_time, url: str, now, when_text: str | None = None) -> str:
    """HTML-текст напоминания. «когда» берём из when_text (готовая строка с фронта,
    локальное время юзера) — иначе фолбэк по event_time (UTC, может быть неточно)."""
    if when_text:
        when = when_text
    else:
        days = (event_time.date() - now.date()).days
        hhmm = event_time.strftime("%H:%M")
        if days <= 0:
            when = f"сегодня в {hhmm}"
        elif days == 1:
            when = f"завтра в {hhmm}"
        else:
            when = f"{event_time.day} {_RU_MONTHS[event_time.month]} в {hhmm}"
    when = _esc(when)
    place = f" · {_esc(venue)}" if venue else ""
    return (
        f"⏰ <b>Напоминание</b>\n\n"
        f"<b>{_esc(title)}</b>\n{when}{place}\n\n"
        f"Открыть афишу: {url}"
    )


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
                result = await self.processor.process_channel(channel_id, limit=25)
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

            on = self.settings.phash_dedup_enabled
            ham = self.settings.phash_max_hamming if on else None
            corrob = self.settings.phash_corrob_hamming if on else None
            engine = create_engine(self.settings.postgres_dsn)
            try:
                sf = create_session_maker(engine)
                async with session_scope(sf) as s:
                    res = await recompute_feed_ranks(s, apply=True, phash_hamming=ham, phash_corrob=corrob)
                logger.info("scheduler: rank recompute %d rows → %d events (dedup −%d)", res.rows, res.groups, res.collapsed)
            finally:
                await engine.dispose()
        except Exception:  # noqa: BLE001
            logger.exception("scheduler: rank recompute failed")

    async def _run_phash_refresh(self) -> None:
        """Досчитать dHash новых постеров (media_phash IS NULL) для дедупа по
        картинке. Инкрементально по ленте. Изолировано: ошибка логируется."""
        media_dir = self.settings.media_local_dir
        if not media_dir:
            return
        try:
            from app.backfill_phash import refresh_phashes
            from app.db import create_engine, create_session_maker, session_scope

            engine = create_engine(self.settings.postgres_dsn)
            try:
                sf = create_session_maker(engine)
                async with session_scope(sf) as s:
                    res = await refresh_phashes(s, media_dir, only_feed=True)
                logger.info("scheduler: phash refresh — %s", res)
            finally:
                await engine.dispose()
        except Exception:  # noqa: BLE001
            logger.exception("scheduler: phash refresh failed")

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

    async def _run_media_retry(self) -> None:
        """Периодический ретрай битых постеров (медиа, упавшее на FLOOD_PREMIUM_WAIT).
        Изолировано — ошибка логируется, поллинг не трогает."""
        try:
            from app.backfill_media_retry import retry_broken_posters
            from app.db import create_engine, create_session_maker

            engine = create_engine(self.settings.postgres_dsn)
            try:
                sf = create_session_maker(engine)
                res = await retry_broken_posters(sf, self.processor.tg, days=1, apply=True, limit=300)
                logger.info("scheduler: media retry — %s", res)
            finally:
                await engine.dispose()
        except Exception:  # noqa: BLE001
            logger.exception("scheduler: media retry failed")

    async def _run_reminders(self) -> None:
        """Разослать созревшие персональные напоминания в ЛС бота. Берём pending
        с наступившим fire_at (окно 12ч, чтобы не слать протухшее), шлём DM,
        помечаем sent/failed. «chat not found» = юзер не нажал /start → failed,
        не ретраим. Изолировано: ошибка логируется, поллинг не трогает."""
        token = self.settings.bot_token
        if not token:
            return
        try:
            import httpx
            from sqlalchemy import select, update

            from app.db import create_engine, create_session_maker, session_scope
            from app.models import Reminder

            now = datetime.utcnow()
            engine = create_engine(self.settings.postgres_dsn)
            try:
                sf = create_session_maker(engine)
                async with session_scope(sf) as s:
                    due = (await s.execute(
                        select(Reminder)
                        .where(
                            Reminder.status == "pending",
                            Reminder.fire_at <= now,
                            Reminder.fire_at > now - timedelta(hours=12),
                        )
                        .limit(200)
                    )).scalars().all()
                if not due:
                    return
                url = self.settings.cs_webapp_url
                sent = failed = 0
                async with httpx.AsyncClient(timeout=20) as http:
                    for r in due:
                        text = _reminder_text(r.title, r.venue, r.event_time, url, now, r.when_text)
                        err: Optional[str] = None
                        try:
                            resp = await http.post(
                                f"https://api.telegram.org/bot{token}/sendMessage",
                                json={"chat_id": r.chat_id, "text": text,
                                      "parse_mode": "HTML", "disable_web_page_preview": True},
                            )
                            ok = resp.status_code == 200 and bool(resp.json().get("ok"))
                            if not ok:
                                err = resp.text[:250]
                        except Exception as e:  # noqa: BLE001
                            ok = False
                            err = str(e)[:250]
                        async with session_scope(sf) as s:
                            await s.execute(update(Reminder).where(Reminder.id == r.id).values(
                                status="sent" if ok else "failed",
                                sent_at=now if ok else None,
                                error=None if ok else err,
                            ))
                        sent += 1 if ok else 0
                        failed += 0 if ok else 1
                        await asyncio.sleep(0.06)  # ~16 msg/s под лимит Telegram
                logger.info("scheduler: reminders — due=%d sent=%d failed=%d", len(due), sent, failed)
            finally:
                await engine.dispose()
        except Exception:  # noqa: BLE001
            logger.exception("scheduler: reminders failed")

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
        # Досчёт dHash новых постеров (дедуп по картинке) — каждые phash_refresh_minutes,
        # первый через 60с (до первого rank recompute на 90с, чтобы phash был свежим).
        if self.settings.media_local_dir:
            self._scheduler.add_job(
                self._run_phash_refresh,
                trigger=IntervalTrigger(minutes=self.settings.phash_refresh_minutes),
                id="phash:refresh",
                replace_existing=True,
                max_instances=1,
                coalesce=True,
                misfire_grace_time=600,
                next_run_time=datetime.utcnow() + timedelta(seconds=60),
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
        # Ретрай битых постеров (медиа-флуд) — каждые 30 мин, первый через 5 мин.
        self._scheduler.add_job(
            self._run_media_retry,
            trigger=IntervalTrigger(minutes=30),
            id="media:retry",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
            next_run_time=datetime.utcnow() + timedelta(seconds=300),
        )
        # Рассылка персональных напоминаний в ЛС — каждые 10 мин, первый через 2 мин.
        self._scheduler.add_job(
            self._run_reminders,
            trigger=IntervalTrigger(minutes=10),
            id="reminders:send",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=600,
            next_run_time=datetime.utcnow() + timedelta(seconds=120),
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
