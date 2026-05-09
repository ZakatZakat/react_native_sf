"""Push subscriptions + log repositories."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PushLog, PushStatus, PushSubscription


class PushSubscriptionsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def upsert(
        self, *, user_id: int, endpoint: str, p256dh: str, auth: str,
        user_agent: str | None = None,
    ) -> PushSubscription:
        stmt = pg_insert(PushSubscription).values(
            user_id=user_id, endpoint=endpoint, p256dh=p256dh, auth=auth,
            user_agent=user_agent,
        ).on_conflict_do_update(
            index_elements=["user_id", "endpoint"],
            set_={"p256dh": p256dh, "auth": auth, "user_agent": user_agent},
        ).returning(PushSubscription)
        return (await self.s.execute(stmt)).scalar_one()

    async def list_for_users(self, user_ids: Sequence[int]) -> list[PushSubscription]:
        if not user_ids:
            return []
        stmt = select(PushSubscription).where(PushSubscription.user_id.in_(user_ids))
        return list((await self.s.execute(stmt)).scalars().all())

    async def list_for_user(self, user_id: int) -> list[PushSubscription]:
        return await self.list_for_users([user_id])

    async def delete_by_id(self, sub_id: int, user_id: int) -> bool:
        stmt = delete(PushSubscription).where(
            PushSubscription.id == sub_id, PushSubscription.user_id == user_id
        )
        return (await self.s.execute(stmt)).rowcount > 0


class PushLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def log(
        self, *, user_id: int, event_id: int, status: PushStatus, error: str | None = None,
    ) -> None:
        self.s.add(PushLog(user_id=user_id, event_id=event_id, status=status, error=error))
        await self.s.flush()

    async def count_recent(self, user_id: int, since: datetime) -> int:
        stmt = (
            select(func.count())
            .select_from(PushLog)
            .where(
                PushLog.user_id == user_id,
                PushLog.sent_at >= since,
                PushLog.status == PushStatus.sent,
            )
        )
        return (await self.s.execute(stmt)).scalar_one()
