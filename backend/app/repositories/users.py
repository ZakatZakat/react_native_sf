from __future__ import annotations

from datetime import datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import User
from app.schemas import UserProfile, UserProfileUpdate, TelegramAuthUser


class UsersRepository(Protocol):
    async def upsert_from_auth(self, payload: TelegramAuthUser) -> UserProfile: ...

    async def get(self, telegram_id: int) -> UserProfile | None: ...

    async def update_profile(self, telegram_id: int, update: UserProfileUpdate) -> UserProfile: ...


class InMemoryUsersRepository(UsersRepository):
    def __init__(self) -> None:
        self._store: dict[int, UserProfile] = {}

    async def upsert_from_auth(self, payload: TelegramAuthUser) -> UserProfile:
        existing = self._store.get(payload.telegram_id)
        profile = UserProfile(
            telegram_id=payload.telegram_id,
            username=payload.username,
            first_name=payload.first_name,
            last_name=payload.last_name,
            photo_url=payload.photo_url,
            language_code=payload.language_code,
            city=existing.city if existing else None,
            interests=existing.interests if existing else [],
            created_at=existing.created_at if existing else datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self._store[payload.telegram_id] = profile
        return profile

    async def get(self, telegram_id: int) -> UserProfile | None:
        return self._store.get(telegram_id)

    async def update_profile(self, telegram_id: int, update: UserProfileUpdate) -> UserProfile:
        current = await self.get(telegram_id)
        if current is None:
            raise ValueError("User not found")
        merged = current.model_copy(
            update={
                "city": update.city if update.city is not None else current.city,
                "interests": update.interests if update.interests is not None else current.interests,
                "updated_at": datetime.utcnow(),
            }
        )
        self._store[telegram_id] = merged
        return merged


class PostgresUsersRepository(UsersRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def upsert_from_auth(self, payload: TelegramAuthUser) -> UserProfile:
        async with self._session_factory() as session:
            existing = await self._get_user(session, payload.telegram_id)
            if existing:
                existing.username = payload.username
                existing.first_name = payload.first_name
                existing.last_name = payload.last_name
                existing.photo_url = payload.photo_url
                existing.language_code = payload.language_code
                await session.commit()
                await session.refresh(existing)
                return self._to_profile(existing)

            user = User(
                telegram_id=payload.telegram_id,
                username=payload.username,
                first_name=payload.first_name,
                last_name=payload.last_name,
                photo_url=payload.photo_url,
                language_code=payload.language_code,
                city=None,
                interests=[],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return self._to_profile(user)

    async def get(self, telegram_id: int) -> UserProfile | None:
        async with self._session_factory() as session:
            user = await self._get_user(session, telegram_id)
            return self._to_profile(user) if user else None

    async def update_profile(self, telegram_id: int, update: UserProfileUpdate) -> UserProfile:
        async with self._session_factory() as session:
            user = await self._get_user(session, telegram_id)
            if user is None:
                raise ValueError("User not found")
            if update.city is not None:
                user.city = update.city
            if update.interests is not None:
                user.interests = update.interests
            user.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(user)
            return self._to_profile(user)

    async def _get_user(self, session: AsyncSession, telegram_id: int) -> User | None:
        return await session.scalar(select(User).where(User.telegram_id == telegram_id).limit(1))

    @staticmethod
    def _to_profile(user: User) -> UserProfile:
        return UserProfile(
            telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            photo_url=user.photo_url,
            language_code=user.language_code,
            city=user.city,
            interests=user.interests,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )



