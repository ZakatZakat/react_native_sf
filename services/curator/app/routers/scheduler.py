"""Scheduler introspection endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.scheduler import get_scheduler

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


@router.get("/jobs")
def list_jobs() -> list[dict]:
    sch = get_scheduler()
    if sch is None:
        raise HTTPException(503, "scheduler not initialized")
    return sch.list_jobs()
