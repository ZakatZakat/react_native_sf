"""REST endpoints for channels management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db import session_scope
from app.repositories.channels import (
    ChannelsRepository,
    ChannelNotFoundError,
    DuplicateChannelError,
)
from app.schemas import ChannelCreate, ChannelOut, ChannelUpdate, normalize_handle
from app.services.scheduler import get_scheduler

router = APIRouter(prefix="/channels", tags=["channels"])


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


@router.get("", response_model=list[ChannelOut])
async def list_channels(
    only_enabled: bool = Query(False),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[ChannelOut]:
    async with session_scope(sf) as s:
        repo = ChannelsRepository(s)
        rows = await repo.list_all(only_enabled=only_enabled)
        return [ChannelOut.model_validate(r) for r in rows]


@router.post("", response_model=ChannelOut, status_code=201)
async def create_channel(
    payload: ChannelCreate,
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> ChannelOut:
    async with session_scope(sf) as s:
        repo = ChannelsRepository(s)
        try:
            row = await repo.create(payload)
        except DuplicateChannelError:
            raise HTTPException(status_code=409, detail=f"channel {payload.handle} already exists")
        snap = ChannelOut.model_validate(row)
        # schedule a polling job for the new channel
        if (sch := get_scheduler()) is not None:
            sch.add_or_update_channel(row)
        return snap


@router.get("/{handle}", response_model=ChannelOut)
async def get_channel(
    handle: str,
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> ChannelOut:
    norm = normalize_handle(handle)
    async with session_scope(sf) as s:
        repo = ChannelsRepository(s)
        row = await repo.get_by_handle(norm)
        if not row:
            raise HTTPException(status_code=404, detail=f"channel {norm} not found")
        return ChannelOut.model_validate(row)


@router.patch("/{handle}", response_model=ChannelOut)
async def update_channel(
    handle: str,
    payload: ChannelUpdate,
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> ChannelOut:
    norm = normalize_handle(handle)
    async with session_scope(sf) as s:
        repo = ChannelsRepository(s)
        try:
            row = await repo.update_by_handle(norm, payload)
        except ChannelNotFoundError:
            raise HTTPException(status_code=404, detail=f"channel {norm} not found")
        snap = ChannelOut.model_validate(row)
        if (sch := get_scheduler()) is not None:
            sch.add_or_update_channel(row)  # handles enable→disable internally
        return snap


@router.delete("/{handle}", status_code=204, response_class=Response)
async def delete_channel(
    handle: str,
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> Response:
    norm = normalize_handle(handle)
    async with session_scope(sf) as s:
        repo = ChannelsRepository(s)
        try:
            await repo.delete_by_handle(norm)
        except ChannelNotFoundError:
            raise HTTPException(status_code=404, detail=f"channel {norm} not found")
    if (sch := get_scheduler()) is not None:
        sch.remove_channel(norm)
    return Response(status_code=204)


@router.post("/bulk", response_model=dict, status_code=201)
async def bulk_create_channels(
    handles: list[str],
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    """Add many channels at once. Skips duplicates silently. Returns counts."""
    created: list[str] = []
    skipped: list[str] = []
    sch = get_scheduler()
    async with session_scope(sf) as s:
        repo = ChannelsRepository(s)
        for raw in handles:
            try:
                payload = ChannelCreate(handle=raw)
            except Exception:
                skipped.append(raw)
                continue
            try:
                row = await repo.create(payload)
                created.append(payload.handle)
                if sch is not None:
                    sch.add_or_update_channel(row)
            except DuplicateChannelError:
                skipped.append(payload.handle)
    return {"created": created, "skipped": skipped, "created_count": len(created), "skipped_count": len(skipped)}
