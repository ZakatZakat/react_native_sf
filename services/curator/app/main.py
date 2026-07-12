from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.db import bootstrap_schema, create_engine, create_session_maker, session_scope
from app.pipeline.processor import PipelineProcessor
from app.repositories.channels import ChannelsRepository
from app.repositories.tags import TagsRepository
from app.routers import admin as admin_router
from app.routers import channels as channels_router
from app.routers import me as me_router
from app.routers import push as push_router
from app.routers import scheduler as scheduler_router
from app.routers import sync as sync_router
from app.routers import tags as tags_router
from app.seed import INITIAL_TAGS
from app.klursi_tags import KLURSI_TAGS
from app.services.push import PushService, set_push_service
from app.services.scheduler import CuratorScheduler, set_scheduler
from app.services.tg_client import TelegramServiceClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

settings = Settings()
app = FastAPI(title="Event Curator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(channels_router.router)
app.include_router(sync_router.router)
app.include_router(scheduler_router.router)
app.include_router(tags_router.router)
app.include_router(me_router.router)
app.include_router(admin_router.router)
app.include_router(push_router.router)


@app.on_event("startup")
async def on_startup() -> None:
    engine = create_engine(settings.postgres_dsn)
    session_factory = create_session_maker(engine)
    await bootstrap_schema(engine, schema=settings.curator_schema)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory

    # Seed initial taxonomy (idempotent — uses ON CONFLICT). INITIAL_TAGS = the
    # 12 coarse categories; KLURSI_TAGS = 177 fine tags mined from the КЛЮРСИ
    # corpus (артхаус, техно-рейв, нойз…). Both are keyword-classified.
    async with session_scope(session_factory) as s:
        n_tags = await TagsRepository(s).upsert_many(INITIAL_TAGS + KLURSI_TAGS)
    logger.info("seeded tags: %d", n_tags)

    app.state.tg_client = TelegramServiceClient(
        settings.telegram_service_url,
        token=settings.telegram_service_token or None,
        media_dir=settings.media_root or None,
    )
    app.state.processor = PipelineProcessor(
        session_factory=session_factory,
        tg_client=app.state.tg_client,
        settings=settings,
    )

    # Push service
    push_svc = PushService(session_factory=session_factory, settings=settings)
    app.state.push_service = push_svc
    set_push_service(push_svc)
    app.state.processor.push_service = push_svc  # let pipeline trigger fanout

    # Scheduler — start with current enabled channels
    scheduler = CuratorScheduler(processor=app.state.processor, settings=settings)
    async with session_scope(session_factory) as s:
        chans = await ChannelsRepository(s).list_all(only_enabled=True)
    await scheduler.start(list(chans))
    app.state.scheduler = scheduler
    set_scheduler(scheduler)

    logger.info("curator started, schema=%s, scheduled=%d", settings.curator_schema, len(chans))


@app.on_event("shutdown")
async def on_shutdown() -> None:
    sch = getattr(app.state, "scheduler", None)
    if sch is not None:
        await sch.shutdown()
    engine = getattr(app.state, "engine", None)
    if engine is not None:
        await engine.dispose()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "curator"}
