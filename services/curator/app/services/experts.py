"""Экспертный гейт оценок — алгоритмический, по телеметрии.

Право ставить звёзды/комменты получает вовлечённый пользователь: за окно
`expert_window_days` он сохранил ≥ `expert_min_saves` событий («иду») И был
активен ≥ `expert_min_days` дней. Самозатухает — окно съезжает, забил →
условие ломается, статус пропадает. Владелец (ADMIN_USER_IDS) — эксперт всегда
(тест + роль верховного куратора).

Данные берём из аналитической БД (тот же engine, что у /insights). Нет engine
(ANALYTICS_DSN не задан) → только владелец эксперт (fail-safe, не роняем).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings

SERVICE = "citysignal"
_UID = "payload->'scenario'->>'user_id'"
_EVID = "payload->'scenario'->>'event_id'"


async def expert_stats(
    engine: AsyncEngine | None, tg_id: int, settings: Settings, *, is_owner: bool = False
) -> dict[str, Any]:
    """Прогресс + статус эксперта для юзера. saves/active_days за окно."""
    min_saves = settings.expert_min_saves
    min_days = settings.expert_min_days
    win = settings.expert_window_days
    saves = 0
    active_days = 0
    if engine is not None:
        try:
            async with engine.connect() as conn:
                row = (await conn.execute(text(f"""
                    SELECT
                      count(DISTINCT {_EVID}) FILTER (
                        WHERE type = 'cs.event.going'
                          AND received_at >= now() - (:win * interval '1 day')) AS saves,
                      count(DISTINCT (received_at AT TIME ZONE 'Europe/Moscow')::date) FILTER (
                        WHERE received_at >= now() - (:win * interval '1 day')) AS active_days
                    FROM public.events
                    WHERE service = :svc AND {_UID} = :uid
                """), {"svc": SERVICE, "uid": str(tg_id), "win": win})).mappings().first()
            if row:
                saves = int(row["saves"] or 0)
                active_days = int(row["active_days"] or 0)
        except Exception:  # noqa: BLE001 — аналитика недоступна → пороги не выполнены
            saves = active_days = 0

    qualifies = saves >= min_saves and active_days >= min_days
    return {
        "is_expert": bool(is_owner or qualifies),
        "owner": is_owner,
        "saves": saves,
        "active_days": active_days,
        "min_saves": min_saves,
        "min_days": min_days,
        "window_days": win,
    }


async def is_expert(
    engine: AsyncEngine | None, tg_id: int, settings: Settings, *, is_owner: bool = False
) -> bool:
    return bool((await expert_stats(engine, tg_id, settings, is_owner=is_owner))["is_expert"])
