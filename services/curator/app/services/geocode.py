"""Geocoding — resolve event venues to lat/lng via Nominatim (OSM).

Strategy per event:
  1. If `location_text` is a usable venue (not a generic single word),
     geocode "<location_text>, Москва".
  2. Otherwise, if the source channel is a known physical venue, geocode
     that venue's address (CHANNEL_VENUE map).
  3. Otherwise skip — nothing to place confidently.

Every distinct query is cached in geocode_cache (incl. negative results),
so we never call the geocoder twice for the same place. Nominatim's usage
policy caps us at ~1 req/sec — enforced by a module-level semaphore + sleep.

Results are written to EventCurated.location_meta as
{lat, lng, geo_source, geo_query}.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EventCurated, GeocodeCache

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "CitySignal/1.0 (admin@digital-assistant.tech)"

# Generic single words that aren't a real venue — fall through to the
# channel venue instead of geocoding "клуб" (which lands anywhere).
_WEAK_LOCATIONS = {
    "парк", "клуб", "дом", "ресторан", "бар", "сцена", "зал", "музей",
    "театр", "галерея", "кафе", "центр", "площадка", "лекторий", "кинотеатр",
    "библиотека", "пространство", "студия", "двор",
}

# Channels that ARE a physical venue — used when the event has no usable
# location_text. Values are geocoder-friendly addresses (city included).
# Extend as more channels are confirmed to be single-venue.
CHANNEL_VENUE: dict[str, str] = {
    "@garagemca": "Музей современного искусства Гараж, Крымский Вал 9, Москва",
    "@vacges2": "Дом культуры ГЭС-2, Болотная набережная 15, Москва",
    "@cci_fabrika": "ЦТИ Фабрика, Переведеновский переулок 18, Москва",
    "@nekrasovkalibrary": "Библиотека имени Некрасова, Бауманская улица 58, Москва",
    "@lavrushinsk": "Третьяковская галерея, Лаврушинский переулок 10, Москва",
    "@teatrtruda_10": "Театр Труда, Москва",
    "@ges2_moscow": "Дом культуры ГЭС-2, Болотная набережная 15, Москва",
    "@strelka": "Институт Стрелка, Берсеневская набережная 14, Москва",
}

# Nominatim asks for ≤1 request/second.
_sem = asyncio.Semaphore(1)


def _normalize_handle(handle: str) -> str:
    h = (handle or "").strip().lower()
    return h if h.startswith("@") else f"@{h}"


def build_query(location_text: Optional[str], channel_handle: str) -> Optional[str]:
    """Pick the best geocoder query for an event, or None if we can't place it."""
    loc = (location_text or "").strip()
    if loc and len(loc) >= 4 and loc.lower() not in _WEAK_LOCATIONS:
        return f"{loc}, Москва"
    venue = CHANNEL_VENUE.get(_normalize_handle(channel_handle))
    if venue:
        return venue
    # Weak/empty location and no known channel venue → don't guess
    # (a pin for "клуб, Москва" would land somewhere random). Skip; it
    # keeps the map honest and shows up as not-yet-placed in the stats.
    return None


async def geocode_query(session: AsyncSession, query: str) -> Optional[tuple[float, float]]:
    """Resolve a query string to (lat, lng), using/filling the cache."""
    cached = await session.get(GeocodeCache, query)
    if cached is not None:
        return (cached.lat, cached.lng) if cached.lat is not None else None

    lat = lng = None
    name = None
    try:
        async with _sem:
            await asyncio.sleep(1.1)  # rate limit
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    NOMINATIM_URL,
                    params={"q": query, "format": "json", "limit": 1, "accept-language": "ru"},
                    headers={"User-Agent": USER_AGENT},
                )
                data = r.json() if r.status_code == 200 else []
        if data:
            lat = float(data[0]["lat"])
            lng = float(data[0]["lon"])
            name = data[0].get("display_name")
    except Exception:
        logger.exception("geocode failed for %r", query)
        return None  # don't cache transient failures

    session.add(GeocodeCache(query=query, lat=lat, lng=lng, display_name=name))
    await session.commit()
    return (lat, lng) if lat is not None else None


async def geocode_event(session: AsyncSession, ev: EventCurated, channel_handle: str) -> bool:
    """Resolve + store coordinates for one event. Returns True if placed."""
    query = build_query(ev.location_text, channel_handle)
    if not query:
        return False
    coords = await geocode_query(session, query)
    if not coords:
        return False
    lat, lng = coords
    meta = dict(ev.location_meta or {})
    meta.update({"lat": lat, "lng": lng, "geo_query": query})
    ev.location_meta = meta
    await session.commit()
    return True
