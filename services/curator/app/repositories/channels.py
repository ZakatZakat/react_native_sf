"""Channel CRUD operations."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Channel
from app.schemas import ChannelCreate, ChannelUpdate


class DuplicateChannelError(Exception):
    pass


class ChannelNotFoundError(Exception):
    pass


class ChannelsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def list_all(self, *, only_enabled: bool = False) -> Sequence[Channel]:
        stmt = select(Channel).order_by(Channel.handle)
        if only_enabled:
            stmt = stmt.where(Channel.poll_enabled.is_(True))
        result = await self.s.execute(stmt)
        return result.scalars().all()

    async def get_by_handle(self, handle: str) -> Channel | None:
        stmt = select(Channel).where(Channel.handle == handle)
        result = await self.s.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, channel_id: int) -> Channel | None:
        return await self.s.get(Channel, channel_id)

    async def create(self, payload: ChannelCreate) -> Channel:
        ch = Channel(
            handle=payload.handle,
            poll_enabled=payload.poll_enabled,
            poll_interval_minutes=payload.poll_interval_minutes,
            weight=payload.weight,
        )
        self.s.add(ch)
        try:
            await self.s.flush()
        except IntegrityError as e:
            raise DuplicateChannelError(payload.handle) from e
        return ch

    async def update_by_handle(self, handle: str, payload: ChannelUpdate) -> Channel:
        ch = await self.get_by_handle(handle)
        if not ch:
            raise ChannelNotFoundError(handle)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(ch, field, value)
        await self.s.flush()
        return ch

    async def delete_by_handle(self, handle: str) -> None:
        ch = await self.get_by_handle(handle)
        if not ch:
            raise ChannelNotFoundError(handle)
        await self.s.delete(ch)
        await self.s.flush()

    async def mark_polled(self, channel_id: int, last_message_id: int | None) -> None:
        stmt = (
            update(Channel)
            .where(Channel.id == channel_id)
            .values(last_polled_at=datetime.utcnow(), last_message_id=last_message_id)
        )
        await self.s.execute(stmt)
