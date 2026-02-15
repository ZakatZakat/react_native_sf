#!/usr/bin/env python3
"""Fetch avatars (cache to media/) and subs for eco card channels. Run from backend: python scripts/fetch_eco_channels_info.py [options]."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings
from app.ingest.telegram import TelegramIngestor
from app.repositories.events import InMemoryEventsRepository

ECO_CHANNELS = [
    "beindvz",
    "constructor_brand",
    "dmsk_bag",
    "exclusive_art_upcycling",
    "hodveshey",
    "melme",
    "skrvshch",
    "swop_market_msk",
    "syyyyyyyr",
    "tutryadom",
    "yergaworkshop",
    "zelenyy_syr",
]

ECO_INTEREST_CHANNELS = [
    "upcycle_msk",
    "secondhand_finds",
    "rework_studio",
    "swap_community",
    "thrift_moscow",
    "vintage_styling",
    "recycling_fashion",
    "preloved_moscow",
    "upcycle_diy",
    "slow_wardrobe",
    "consignment_events",
    "fashion_swap",
    "fair_moscow",
    "market_weekly",
    "flea_culture",
    "lambada_market",
    "design_markets",
    "antique_markets",
    "handmade_markets",
    "vinyl_community",
    "book_fairs_msk",
    "collectors_swap",
    "craft_markets",
    "weekend_bazaars",
    "local_brands_msk",
    "handmade_digest",
    "slow_fashion_ru",
    "ethical_fashion",
    "craft_moscow",
    "independent_designers",
    "artisan_market",
    "small_batch_brands",
    "maker_community",
    "boutique_digest",
    "unique_fashion",
    "designer_stories",
]


async def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch avatars and subs for eco card + interest cards channels")
    parser.add_argument("--eco-only", action="store_true", help="Only main eco card channels (skip interest cards)")
    parser.add_argument("--json", metavar="FILE", help="Write result JSON to FILE")
    parser.add_argument("--ts", metavar="FILE", help="Write PipeRotate channels snippet (TS) to FILE")
    args = parser.parse_args()

    channels = ECO_CHANNELS + ([] if args.eco_only else ECO_INTEREST_CHANNELS)
    seen: set[str] = set()
    unique = [c for c in channels if c not in seen and not seen.add(c)]

    settings = Settings()
    repo = InMemoryEventsRepository()
    ingestor = TelegramIngestor(settings=settings, repo=repo)
    result = await ingestor.fetch_channels_info(unique)

    print("Channels (name, subs, avatar):")
    for r in result:
        print(f"  {r['name']}  subs={r['subs']}  avatar={r['avatar'] or '—'}")

    if args.json:
        Path(args.json).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"JSON written to {args.json}")

    if args.ts:
        lines = ["    channels: ["]
        for r in result:
            lines.append(f"      {{ name: \"{r['name']}\", subs: \"{r['subs']}\" }},")
        lines.append("    ],")
        Path(args.ts).write_text("\n".join(lines), encoding="utf-8")
        print(f"TS snippet written to {args.ts}")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
