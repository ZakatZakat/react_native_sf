"""Ночная + разовая чистка очереди модерации: прошедшие manual_review → rejected.

Прошедшие события на ручной модерации никто уже не покажет (лента — только
будущее + approved), но они висят в очереди мёртвым грузом и создают иллюзию
огромного бэклога. Помечаем их rejected, чтобы очередь показывала реальный
actionable-остаток.

НЕ удаляет строки/посты; обратимо (`SET status='manual_review'` обратно).
События БЕЗ даты (event_time IS NULL) не трогает — `NULL < now` = NULL, не TRUE.

    docker exec <curator> python -m app.cleanup_moderation            # dry-run
    docker exec <curator> python -m app.cleanup_moderation --apply    # запись
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated, EventStatus


async def reject_past_manual_review(session: AsyncSession, *, apply: bool = True) -> int:
    """Помечает rejected прошедшие (event_time < now) события на manual_review.
    Возвращает число затронутых строк."""
    now = datetime.utcnow()
    cond = and_(
        EventCurated.status == EventStatus.manual_review,
        EventCurated.event_time < now,
    )
    count = (
        await session.execute(select(func.count()).select_from(EventCurated).where(cond))
    ).scalar_one()
    if apply and count:
        await session.execute(update(EventCurated).where(cond).values(status=EventStatus.rejected))
    return int(count)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="записать (иначе dry-run)")
    args = ap.parse_args()

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    session_factory = create_session_maker(engine)
    async with session_scope(session_factory) as s:
        n = await reject_past_manual_review(s, apply=args.apply)
    await engine.dispose()

    mode = "APPLIED" if args.apply else "DRY-RUN (no writes)"
    print(f"[{mode}] прошедших manual_review → rejected: {n}")
    if not args.apply and n:
        print("Re-run with --apply to write.")


if __name__ == "__main__":
    asyncio.run(main())
