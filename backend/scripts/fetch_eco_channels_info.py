#!/usr/bin/env python3
"""Fetch avatars (cache to media/) and subs for configured channels."""

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

async def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch avatars and subs for configured channels")
    parser.add_argument("--json", metavar="FILE", help="Write result JSON to FILE")
    parser.add_argument("--ts", metavar="FILE", help="Write PipeRotate channels snippet (TS) to FILE")
    args = parser.parse_args()

    settings = Settings()
    channels = settings.telegram_channel_ids or []
    if not channels:
        print("No TELEGRAM_CHANNEL_IDS configured", file=sys.stderr)
        return 1
    seen: set[str] = set()
    unique = [c for c in channels if c not in seen and not seen.add(c)]
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
