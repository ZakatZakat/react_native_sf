"""Снять ложный тег «театр» с событий, где он повесился ТОЛЬКО из-за слова
«режиссёр» (кинопоказ, ретроспектива, встреча с режиссёром фильма).

Причина: у keyword-классификатора «режисс» стоял и в кино, и в театре, поэтому
каждый пост про фильм с упоминанием режиссёра получал «театр» ложным чипом — а на
части событий (~24) театр ещё и перебивал кино по confidence и становился главной
категорией карточки. Ключевое слово из театра убрано (см. seed.py); этот backfill
чистит уже размеченные события.

Критерий (точный инверс правки в seed.py): если у события есть тег «театр», но в
тексте НЕТ ни одного надёжного театрального слова из нового списка
(театр/спектакль/постановка/пьеса/«сцена »/«сцены ») — значит театр держался лишь
на «режисс». Такой EventTag удаляем. Идемпотентно, дефолт — dry-run.

    docker exec <curator> python -m app.backfill_retag_theatre           # dry-run
    docker exec <curator> python -m app.backfill_retag_theatre --apply
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import delete, select

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated, EventTag, PostRaw, Tag
from app.seed import INITIAL_TAGS

# Надёжные театральные слова = ключевые слова театра ПОСЛЕ снятия «режисс».
_THEATRE_KWS: tuple[str, ...] = tuple(
    kw.lower() for t in INITIAL_TAGS if t["key"] == "theatre" for kw in t["keywords"]
)


async def main(apply: bool) -> None:
    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    scanned = removed = 0
    async with session_scope(sf) as s:
        theatre = (await s.execute(select(Tag).where(Tag.key == "theatre"))).scalar_one_or_none()
        if theatre is None:
            print("no theatre tag — nothing to do")
            await engine.dispose()
            return

        rows = (
            await s.execute(
                select(EventCurated.id, PostRaw.text)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .join(EventTag, EventTag.event_id == EventCurated.id)
                .where(EventTag.tag_id == theatre.id)
            )
        ).all()

        victims: list[int] = []
        for eid, text in rows:
            scanned += 1
            tl = (text or "").lower()
            if not any(kw in tl for kw in _THEATRE_KWS):
                victims.append(eid)

        if apply and victims:
            res = await s.execute(
                delete(EventTag).where(
                    EventTag.tag_id == theatre.id, EventTag.event_id.in_(victims)
                )
            )
            removed = res.rowcount or 0
        else:
            removed = len(victims)

    await engine.dispose()
    verb = "removed" if apply else "would_remove"
    print(f"scanned_theatre={scanned} {verb}={removed} (dry_run={not apply})")


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv[1:]))
