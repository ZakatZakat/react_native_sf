"""Manual sync triggers (used until scheduler comes online in Phase 3)."""

from __future__ import annotations

import asyncio
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.db import session_scope
from app.pipeline.processor import PipelineProcessor
from app.repositories.channels import ChannelsRepository
from app.schemas import normalize_handle

router = APIRouter(tags=["sync"])


def get_processor(request: Request) -> PipelineProcessor:
    return request.app.state.processor


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


@router.post("/channels/{handle}/sync")
async def sync_channel(
    handle: str,
    limit: int = Query(20, ge=1, le=50),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
    proc: PipelineProcessor = Depends(get_processor),
) -> dict:
    norm = normalize_handle(handle)
    async with session_scope(sf) as s:
        ch = await ChannelsRepository(s).get_by_handle(norm)
        if not ch:
            raise HTTPException(404, f"channel {norm} not found")
        ch_id = ch.id
    result = await proc.process_channel(ch_id, limit=limit)
    return asdict(result)


@router.post("/sync/all")
async def sync_all(
    limit: int = Query(5, ge=1, le=20),
    only_enabled: bool = Query(True),
    concurrency: int = Query(3, ge=1, le=10),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
    proc: PipelineProcessor = Depends(get_processor),
) -> dict:
    async with session_scope(sf) as s:
        chans = await ChannelsRepository(s).list_all(only_enabled=only_enabled)
        ids = [c.id for c in chans]

    sem = asyncio.Semaphore(concurrency)

    async def run(cid: int):
        async with sem:
            return await proc.process_channel(cid, limit=limit)

    results = await asyncio.gather(*(run(cid) for cid in ids))
    return {
        "channels_processed": len(results),
        "totals": {
            "posts_fetched": sum(r.posts_fetched for r in results),
            "posts_new": sum(r.posts_new for r in results),
            "events_approved": sum(r.events_approved for r in results),
            "events_review": sum(r.events_review for r in results),
            "events_rejected": sum(r.events_rejected for r in results),
            "errors": [r.channel_handle for r in results if r.error],
        },
        "per_channel": [asdict(r) for r in results],
    }
