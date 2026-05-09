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


async def bootstrap_schema(engine: AsyncEngine, schema: str = SCHEMA) -> None:
    """Create the curator schema (if missing) + all ORM-defined tables."""
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        await conn.run_sync(Base.metadata.create_all)
    logger.info("curator schema bootstrap done (schema=%s, tables=%d)", schema, len(Base.metadata.tables))
