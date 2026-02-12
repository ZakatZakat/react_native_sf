#!/usr/bin/env python3
"""Fetch posts from @rep_des_art, extract channel links, optionally ingest to DB. Run from backend: python scripts/fetch_rep_des_art.py [options]."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings
from app.db import create_engine, create_session_maker
from app.ingest.telegram import TelegramIngestor
from app.models import Base
from app.repositories.events import InMemoryEventsRepository
from app.repositories.postgres import PostgresEventsRepository
from sqlalchemy.ext.asyncio import async_sessionmaker


async def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch @rep_des_art (or other channel), extract links, ingest to DB")
    parser.add_argument("--channel", default="rep_des_art", help="Channel username without @")
    parser.add_argument("--limit", type=int, default=100, help="Max messages to fetch (1-500)")
    parser.add_argument("--no-ingest", action="store_true", help="Do not write posts to DB")
    parser.add_argument("--no-db", action="store_true", help="Do not connect to Postgres (use in-memory; useful when DB host is unreachable, e.g. Docker)")
    parser.add_argument("--output", "-o", metavar="FILE", help="Write channels list (one per line) to FILE")
    parser.add_argument("--json", metavar="FILE", help="Write full result JSON to FILE")
    args = parser.parse_args()

    limit = max(1, min(500, args.limit))
    settings = Settings()

    use_db = settings.postgres_dsn and not args.no_db
    engine = None
    if use_db:
        try:
            engine = create_engine(settings.postgres_dsn)
            session_factory = create_session_maker(engine)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            repo = PostgresEventsRepository(session_factory)
        except Exception as e:
            print(f"Warning: could not connect to Postgres ({e}), using in-memory (no persist).", file=sys.stderr)
            if engine is not None:
                await engine.dispose()
                engine = None
            repo = InMemoryEventsRepository()
    else:
        repo = InMemoryEventsRepository()
        if not args.no_ingest and args.no_db:
            print("Note: --no-db set, ingest will not be persisted.", file=sys.stderr)

    try:
        ingestor = TelegramIngestor(settings=settings, repo=repo)
        result = await ingestor.fetch_from_channel(
            source_channel=args.channel,
            limit=limit,
            ingest_to_db=not args.no_ingest,
        )
    finally:
        if engine is not None:
            await engine.dispose()

    print(f"Source: {result['source_channel']}")
    print(f"Messages seen: {result['messages_seen']}, ingested: {result['ingested']}")
    print(f"Channels found: {len(result['channels'])}")
    for ch in result["channels"]:
        print(f"  {ch}")

    if args.output:
        Path(args.output).write_text("\n".join(result["channels"]) + "\n", encoding="utf-8")
        print(f"Channels written to {args.output}")

    if args.json:
        out = {k: v for k, v in result.items() if k != "messages"}
        out["messages_count"] = len(result.get("messages", []))
        Path(args.json).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Result JSON written to {args.json}")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
