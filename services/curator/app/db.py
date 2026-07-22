"""Async SQLAlchemy engine + session factory + schema bootstrap."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base, SCHEMA

logger = logging.getLogger(__name__)


def create_engine(dsn: str) -> AsyncEngine:
    return create_async_engine(dsn, future=True, pool_pre_ping=True)


def create_session_maker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def session_scope(session_factory: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncSession]:
    session = session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


# Аддитивные миграции: create_all создаёт недостающие ТАБЛИЦЫ, но не колонки.
# Alembic в проекте нет, поэтому новые колонки добавляем идемпотентно на старте.
# ADD COLUMN IF NOT EXISTS безопасно гоняется каждый запуск.
_ADDITIVE_MIGRATIONS: list[str] = [
    'ALTER TABLE "{s}".channels ADD COLUMN IF NOT EXISTS ctype varchar(24)',
    'ALTER TABLE "{s}".events_curated ADD COLUMN IF NOT EXISTS dup_group_id bigint',
    'ALTER TABLE "{s}".events_curated ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true',
    'ALTER TABLE "{s}".events_curated ADD COLUMN IF NOT EXISTS crosspost_count integer NOT NULL DEFAULT 1',
    'ALTER TABLE "{s}".events_curated ADD COLUMN IF NOT EXISTS rank_score double precision',
    'CREATE INDEX IF NOT EXISTS ix_events_rank_score ON "{s}".events_curated (rank_score)',
    'CREATE INDEX IF NOT EXISTS ix_events_dup_group ON "{s}".events_curated (dup_group_id)',
]


async def bootstrap_schema(engine: AsyncEngine, schema: str = SCHEMA) -> None:
    """Create the curator schema (if missing) + all ORM-defined tables + additive column migrations."""
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _ADDITIVE_MIGRATIONS:
            await conn.execute(text(stmt.format(s=schema)))
    logger.info("curator schema bootstrap done (schema=%s, tables=%d)", schema, len(Base.metadata.tables))
