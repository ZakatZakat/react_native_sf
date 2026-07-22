"""Ранжирование ленты: кросс-пост дедуп (канонические группы) + rank_score.

Матчинг дублей портирован 1:1 из фронтового `buildDerived.ts`, чтобы бэкенд и
клиент одинаково понимали, что такое дубль. На каждое фид-событие пишем:
  • dup_group_id / is_primary / crosspost_count — сворачивание кросс-постов
  • rank_score                                  — порядок «самое интересное вверх»

rank_score (v1, без LLM):
  0.35·venue_authority + 0.25·crosspost(distinct, −aggregator)
  + 0.25·time_proximity + 0.15·quality
Отменённые (по стоп-списку имён) — вниз. LLM interest_score и engagement — след. слои.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime

from sqlalchemy import String, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Channel, EventCurated, EventStatus, PostRaw

# ── стоп-список отменённых (временный, пока нет news-линкера отмен) ──
CANCELLED_NAME_TOKENS: set[str] = {"outline"}

_TITLE_STOP = set(
    "январь января февраль февраля март марта апрель апреля май мая июнь июня июль июля "
    "август августа сентябрь сентября октябрь октября ноябрь ноября декабрь декабря "
    "понедельник вторник среда среду четверг пятница пятницу суббота субботу воскресенье "
    "для что как это все уже при под над без про или где там так the and for with".split()
)
_TOK_RE = re.compile(r"[^0-9a-zA-Zа-яёА-ЯЁ\s]")


def _tokenize(s: str | None) -> list[str]:
    s = _TOK_RE.sub(" ", (s or "").lower())
    return [w for w in s.split() if len(w) >= 3 and not w.isdigit() and w not in _TITLE_STOP]


def _name_tokens(title: str | None, descr: str | None) -> set[str]:
    toks = _tokenize(title)
    if len(toks) < 4:
        toks = _tokenize(f"{title or ''} {(descr or '')[:80]}")
    return set(toks)


def _overlap(a: set[str], b: set[str]) -> float:
    s, l = (a, b) if len(a) <= len(b) else (b, a)
    return (sum(1 for x in s if x in l) / len(s)) if s else 0.0


def _title_score(title: str | None) -> int:
    return len(_tokenize(title))


def _quote_key(title: str | None, descr: str | None) -> str:
    src = f"{title or ''} {(descr or '')[:60]}"
    m = re.search(r"«([^»]{5,80})»", src) or re.search(r'"([^"]{5,80})"', src)
    return re.sub(r"\s+", " ", m.group(1).lower()).strip() if m else ""


_URL_RE = re.compile(r"(?:https?://)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/[^\s)<>\"'»]+", re.I)
_URL_SKIP = re.compile(r"^(t\.me/|telegram\.|instagram\.|vk\.(com|ru)/|facebook\.|youtu|\S+\.jpe?g)")


def _url_key(descr: str | None) -> str:
    for u in _URL_RE.findall(descr or ""):
        low = re.sub(r"^https?://", "", u.lower())
        if _URL_SKIP.match(low):
            continue
        norm = re.sub(r"/+$", "", re.sub(r"[?#].*$", "", low))
        if norm:
            return norm
    return ""


def _tkey(dt: datetime | None) -> str:
    return dt.strftime("%d.%m %H:%M") if dt else ""


# ────────────────────────────────────────────────────────────────────
# Кластеризация (порт buildDerived.ts)
# ────────────────────────────────────────────────────────────────────
@dataclass
class _Row:
    id: int
    title: str
    descr: str
    event_time: datetime | None
    media_hash: str | None
    filter_score: int
    channel: str
    ctype: str | None
    authority: float


def cluster(rows: list[_Row]) -> list[list[_Row]]:
    """Схлопывает кросс-посты в группы. Возвращает список групп (списков строк)."""
    groups: list[list[_Row]] = []
    reps: list[_Row] = []  # представитель группы (лучший титул), индекс = группа
    exact_to_idx: dict[str, int] = {}
    name_buckets: dict[str, list[tuple[set[str], int]]] = {}

    for e in rows:
        t = _tkey(e.event_time)
        exact: list[str] = []
        if e.media_hash:
            exact.append(f"img:{e.media_hash}|{t}")
        if t:
            u = _url_key(e.descr)
            if u:
                exact.append(f"url:{u}|{t}")
            q = _quote_key(e.title, e.descr)
            if q:
                exact.append(f"name:{q}|{t}")
        body = re.sub(r"\s+", " ", (e.descr or "").strip().lower())
        if body:
            exact.append(f"txt:{body}|{t}")
        nm = _name_tokens(e.title, e.descr) if t else set()

        dup = -1
        for k in exact:
            if k in exact_to_idx:
                dup = exact_to_idx[k]
                break
        if dup < 0 and len(nm) >= 4:
            for bnm, bidx in name_buckets.get(t, []):
                if len(bnm) >= 4 and _overlap(nm, bnm) >= 0.8:
                    dup = bidx
                    break

        if dup >= 0:
            groups[dup].append(e)
            if _title_score(e.title) > _title_score(reps[dup].title):
                reps[dup] = e
            for k in exact:
                exact_to_idx.setdefault(k, dup)
            if len(nm) >= 4:
                name_buckets.setdefault(t, []).append((nm, dup))
            continue

        idx = len(reps)
        reps.append(e)
        groups.append([e])
        for k in exact:
            exact_to_idx[k] = idx
        if len(nm) >= 4:
            name_buckets.setdefault(t, []).append((nm, idx))
    return groups


# ────────────────────────────────────────────────────────────────────
# Скоринг
# ────────────────────────────────────────────────────────────────────
_AUTH_NORM = {1: 0.2, 2: 0.6, 3: 1.0}
_X_NORM = {0: 0.0, 1: 0.35, 2: 0.7}


def _score(group: list[_Row], today: date) -> float:
    chans = {m.channel for m in group if m.channel}
    non_agg = {m.channel for m in group if m.channel and m.ctype != "aggregator"}
    auth = max((int(m.authority) for m in group), default=1)
    auth_norm = _AUTH_NORM.get(max(1, min(3, auth)), 0.2)
    x_norm = _X_NORM.get(len(non_agg), 1.0)

    dts = [m.event_time.date() for m in group if m.event_time]
    if not dts:
        prox = 0.45
    else:
        days = (min(dts) - today).days
        prox = 1.0 if days <= 0 else math.exp(-days / 21.0)

    fs = max((m.filter_score or 0) for m in group)
    fs_norm = max(0.0, min(1.0, (fs - 4) / 7.0))
    has_time = any(m.event_time and (m.event_time.hour or m.event_time.minute) for m in group)
    qual = 0.5 * (1.0 if has_time else 0.0) + 0.5 * fs_norm

    blob_tokens: set[str] = set()
    for m in group:
        blob_tokens |= _name_tokens(m.title, m.descr)
    cancelled = bool(blob_tokens & CANCELLED_NAME_TOKENS)

    score = 0.35 * auth_norm + 0.25 * x_norm + 0.25 * prox + 0.15 * qual
    if cancelled:
        score -= 5.0
    return round(score, 4)


def _primary(group: list[_Row]) -> _Row:
    # лучший титул; при равенстве — самый авторитетный источник, потом меньший id
    return max(group, key=lambda e: (_title_score(e.title), int(e.authority), -e.id))


@dataclass
class RankResult:
    rows: int = 0
    groups: int = 0
    collapsed: int = 0
    updates: list[tuple[int, int, bool, int, float]] = field(default_factory=list)  # id, group_id, primary, xcount, score


async def _load_rows(session: AsyncSession) -> list[_Row]:
    now = datetime.utcnow()
    q = (
        select(EventCurated, PostRaw, Channel)
        .join(PostRaw, PostRaw.id == EventCurated.post_id)
        .join(Channel, Channel.id == PostRaw.channel_id, isouter=True)
        .where(EventCurated.status == EventStatus.approved)
        .where(or_(EventCurated.event_time >= now, EventCurated.event_time.is_(None)))
        .where(func.coalesce(EventCurated.location_meta.op("->>")("region"), "moscow").notin_(["spb", "other"]))
        .where(func.cast(PostRaw.media_urls, String).ilike("%.jpg%"))
        .order_by(EventCurated.event_time.asc().nulls_last(), EventCurated.id.asc())
    )
    rows: list[_Row] = []
    for ev, post, ch in (await session.execute(q)).all():
        rows.append(
            _Row(
                id=ev.id,
                title=(ev.title or "").strip(),
                descr=post.text or "",
                event_time=ev.event_time,
                media_hash=post.media_hash,
                filter_score=ev.filter_score or 0,
                channel=(ch.handle.lstrip("@") if ch and ch.handle else ""),
                ctype=(ch.ctype if ch else None),
                authority=(ch.weight if ch and ch.weight else 1.0),
            )
        )
    return rows


async def recompute_feed_ranks(session: AsyncSession, *, apply: bool = True) -> RankResult:
    """Пересчитать дедуп-группы + rank_score для всех фид-событий."""
    rows = await _load_rows(session)
    groups = cluster(rows)
    today = datetime.utcnow().date()

    res = RankResult(rows=len(rows), groups=len(groups), collapsed=len(rows) - len(groups))
    for g in groups:
        prim = _primary(g)
        gid = prim.id
        xcount = len({m.channel for m in g if m.channel})
        s = _score(g, today)
        for m in g:
            res.updates.append((m.id, gid, m.id == prim.id, xcount, s))

    if apply:
        for eid, gid, is_prim, xc, s in res.updates:
            await session.execute(
                update(EventCurated)
                .where(EventCurated.id == eid)
                .values(dup_group_id=gid, is_primary=is_prim, crosspost_count=xc, rank_score=s)
            )
    return res
