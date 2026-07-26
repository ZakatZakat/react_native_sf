"""Приватная аналитика владельца — активность пользователей/дней/действий.

Источник — аналитическая БД analytics-platform (таблица public.events, куда
мини-апп шлёт телеметрию). Курэйтор ходит туда read-only по отдельному engine
(app.state.analytics_engine), который поднимается на старте ТОЛЬКО если задан
ANALYTICS_DSN. Нет DSN или БД недоступна → раздел отдаёт 503, остальной курэйтор
работает как обычно.

Гейт — require_owner (валидный Telegram-initData владельца ИЛИ секрет ?k=…),
без ?as_user-обхода. См. app/auth.py.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.auth import require_owner

router = APIRouter(prefix="/insights", tags=["insights"])

SERVICE = "citysignal"

# scenario-пути в payload (jsonb) — вынесены, чтобы SQL читался.
_UID = "payload->'scenario'->>'user_id'"
_DEV = "payload->'scenario'->>'device_id'"
_PLAT = "payload->'scenario'->>'platform'"
_ROUTE = "payload->'scenario'->>'route'"
_EVID = "payload->'scenario'->>'event_id'"
_USERNAME = "payload->'scenario'->'tg'->>'username'"
_FIRSTNAME = "payload->'scenario'->'tg'->>'first_name'"

# Ручной маппинг известных tg-id без публичного @username → имя (тестеры и т.п.).
# Показывается, когда в аналитике нет ни username, ни first_name. Дополнять сюда.
KNOWN_NAMES: dict[str, str] = {
    "6858954895": "Simon",
    "38146919": "healingdamage",
}


def _display_name(uid: str, first_name: str | None) -> str | None:
    return first_name or KNOWN_NAMES.get(uid)


def get_analytics_engine(request: Request) -> AsyncEngine:
    eng = getattr(request.app.state, "analytics_engine", None)
    if eng is None:
        raise HTTPException(503, "analytics source not configured")
    return eng


@router.get("")
async def insights(
    days: int = Query(30, ge=1, le=90, description="длина ряда «по дням»"),
    _owner: int = Depends(require_owner),
    engine: AsyncEngine = Depends(get_analytics_engine),
) -> dict[str, Any]:
    p = {"svc": SERVICE, "days": days}
    async with engine.connect() as conn:
        # ── Итоги + диапазон ──────────────────────────────────────────
        totals = (await conn.execute(text(f"""
            SELECT
              count(*)                                           AS events,
              count(DISTINCT {_UID}) FILTER (WHERE {_UID} IS NOT NULL) AS tg_users,
              count(DISTINCT {_DEV})                             AS devices,
              count(DISTINCT request_id)                         AS sessions,
              count(*) FILTER (WHERE type = 'cs.event.going')    AS rsvps,
              count(*) FILTER (WHERE status = 'error' OR type LIKE 'error.%') AS errors,
              min(received_at) AS first_at,
              max(received_at) AS last_at
            FROM events WHERE service = :svc
        """), p)).mappings().one()

        # ── Активные за 1 / 7 / 30 дней (по TG-юзерам) ────────────────
        active = (await conn.execute(text(f"""
            SELECT
              count(DISTINCT {_UID}) FILTER (WHERE received_at >= now() - interval '1 day')  AS dau,
              count(DISTINCT {_UID}) FILTER (WHERE received_at >= now() - interval '7 days')  AS wau,
              count(DISTINCT {_UID}) FILTER (WHERE received_at >= now() - interval '30 days') AS mau
            FROM events WHERE service = :svc AND {_UID} IS NOT NULL
        """), p)).mappings().one()

        # ── Ряд «по дням» (московское время, без пропусков) ───────────
        per_day = (await conn.execute(text(f"""
            WITH days AS (
              SELECT generate_series(
                (now() AT TIME ZONE 'Europe/Moscow')::date - (:days - 1),
                (now() AT TIME ZONE 'Europe/Moscow')::date,
                interval '1 day')::date AS day
            ),
            ev AS (
              SELECT (received_at AT TIME ZONE 'Europe/Moscow')::date AS day,
                     count(*)                    AS events,
                     count(DISTINCT {_UID}) FILTER (WHERE {_UID} IS NOT NULL) AS users,
                     count(DISTINCT {_DEV})      AS devices,
                     count(DISTINCT request_id)  AS sessions
              FROM events
              WHERE service = :svc AND received_at >= now() - (:days * interval '1 day')
              GROUP BY 1
            )
            SELECT d.day::text AS day,
                   COALESCE(ev.events, 0)   AS events,
                   COALESCE(ev.users, 0)    AS users,
                   COALESCE(ev.devices, 0)  AS devices,
                   COALESCE(ev.sessions, 0) AS sessions
            FROM days d LEFT JOIN ev ON ev.day = d.day
            ORDER BY d.day
        """), p)).mappings().all()

        # ── Таблица «по пользователям» (только TG, user_id известен) ──
        urows = (await conn.execute(text(f"""
            SELECT {_UID} AS uid,
                   count(*)                    AS events,
                   count(DISTINCT request_id)  AS sessions,
                   count(*) FILTER (WHERE type = 'cs.event.open')   AS opens,
                   count(DISTINCT {_EVID}) FILTER (WHERE type = 'cs.event.going') AS rsvps,
                   count(*) FILTER (WHERE type = 'cs.feed.filter')  AS filters,
                   min(received_at) AS first_seen,
                   max(received_at) AS last_seen,
                   (array_agg({_PLAT} ORDER BY received_at DESC))[1] AS platform
            FROM events
            WHERE service = :svc AND {_UID} IS NOT NULL
            GROUP BY uid
            ORDER BY last_seen DESC
        """), p)).mappings().all()
        # Свежайшие username/first_name по каждому uid (tg может быть null в части событий).
        names = (await conn.execute(text(f"""
            SELECT DISTINCT ON ({_UID}) {_UID} AS uid,
                   {_USERNAME} AS username, {_FIRSTNAME} AS first_name
            FROM events
            WHERE service = :svc AND {_UID} IS NOT NULL AND {_USERNAME} IS NOT NULL
            ORDER BY {_UID}, received_at DESC
        """), p)).mappings().all()
        name_by_uid = {r["uid"]: r for r in names}
        users = []
        for r in urows:
            nm = name_by_uid.get(r["uid"])
            users.append({
                "user_id": r["uid"],
                "username": nm["username"] if nm else None,
                "name": _display_name(r["uid"], nm["first_name"] if nm else None),
                "events": r["events"],
                "sessions": r["sessions"],
                "opens": r["opens"],
                "rsvps": r["rsvps"],
                "filters": r["filters"],
                "platform": r["platform"],
                "first_seen": r["first_seen"].isoformat() if r["first_seen"] else None,
                "last_seen": r["last_seen"].isoformat() if r["last_seen"] else None,
            })

        # ── Кто и когда: активность TG-юзеров по дням (МСК) ───────────
        du_rows = (await conn.execute(text(f"""
            SELECT (received_at AT TIME ZONE 'Europe/Moscow')::date AS day,
                   {_UID} AS uid,
                   count(*)                   AS events,
                   count(DISTINCT request_id) AS sessions,
                   to_char(min(received_at) AT TIME ZONE 'Europe/Moscow', 'HH24:MI') AS first_hm,
                   to_char(max(received_at) AT TIME ZONE 'Europe/Moscow', 'HH24:MI') AS last_hm
            FROM events
            WHERE service = :svc AND {_UID} IS NOT NULL
              AND received_at >= now() - (:days * interval '1 day')
            GROUP BY day, uid
            ORDER BY day DESC, events DESC
        """), p)).mappings().all()
        day_map: dict[str, dict[str, Any]] = {}
        for r in du_rows:
            day = r["day"].isoformat()
            d = day_map.setdefault(day, {"day": day, "events": 0, "users": []})
            nm = name_by_uid.get(r["uid"])
            d["users"].append({
                "user_id": r["uid"],
                "username": nm["username"] if nm else None,
                "name": _display_name(r["uid"], nm["first_name"] if nm else None),
                "events": r["events"],
                "sessions": r["sessions"],
                "first": r["first_hm"],
                "last": r["last_hm"],
            })
            d["events"] += r["events"]
        day_users = sorted(day_map.values(), key=lambda x: x["day"], reverse=True)

        # ── Топ действий (cs.*) ───────────────────────────────────────
        actions = (await conn.execute(text("""
            SELECT type, count(*) AS n
            FROM events WHERE service = :svc AND type LIKE 'cs.%'
            GROUP BY type ORDER BY n DESC
        """), p)).mappings().all()

        # ── Воронка: охват (уник. TG-юзеров) по шагам ─────────────────
        funnel = (await conn.execute(text(f"""
            SELECT
              count(DISTINCT {_UID}) FILTER (WHERE {_UID} IS NOT NULL)                          AS reach,
              count(DISTINCT {_UID}) FILTER (WHERE type = 'cs.landing.enter')                    AS landing,
              count(DISTINCT {_UID}) FILTER (WHERE type = 'cs.week.view')                         AS week,
              count(DISTINCT {_UID}) FILTER (WHERE type = 'page.view' AND {_ROUTE} = '/cs/feed')  AS feed,
              count(DISTINCT {_UID}) FILTER (WHERE type = 'cs.event.open')                        AS opened,
              count(DISTINCT {_UID}) FILTER (WHERE type = 'cs.event.going')                       AS going
            FROM events WHERE service = :svc AND {_UID} IS NOT NULL
        """), p)).mappings().one()

        # ── Активность по часам (московское время) ────────────────────
        hours = (await conn.execute(text("""
            SELECT extract(hour FROM received_at AT TIME ZONE 'Europe/Moscow')::int AS h,
                   count(*) AS n
            FROM events WHERE service = :svc GROUP BY h ORDER BY h
        """), p)).mappings().all()
        by_hour = [0] * 24
        for r in hours:
            h = int(r["h"])
            if 0 <= h < 24:
                by_hour[h] = r["n"]

    return {
        "service": SERVICE,
        "range": {
            "first": totals["first_at"].isoformat() if totals["first_at"] else None,
            "last": totals["last_at"].isoformat() if totals["last_at"] else None,
        },
        "totals": {
            "events": totals["events"],
            "tg_users": totals["tg_users"],
            "devices": totals["devices"],
            "sessions": totals["sessions"],
            "rsvps": totals["rsvps"],
            "errors": totals["errors"],
        },
        "active": {"dau": active["dau"], "wau": active["wau"], "mau": active["mau"]},
        "per_day": [dict(r) for r in per_day],
        "day_users": day_users,
        "users": users,
        "actions": [dict(r) for r in actions],
        "funnel": {
            "reach": funnel["reach"], "landing": funnel["landing"], "week": funnel["week"],
            "feed": funnel["feed"], "opened": funnel["opened"], "going": funnel["going"],
        },
        "by_hour": by_hour,
    }
