"""Delete media files no longer needed by the app.

The poller mirrors media for EVERY fetched post, but only events are ever shown.
Media of past events, of non-event posts, and true orphans (files no DB row
references) just pile up on disk. This sweep reclaims them.

KEEP a file iff it is referenced by:
  · an upcoming / today / undated EVENT (any status)  — the app might show it, or
  · a post fetched within the last CLEANUP_KEEP_DAYS days — safety for freshly
    fetched, not-yet-classified posts.
DELETE everything else on disk (past events, old non-event media, orphans).

Runs DISK-driven (iterates the media dir), so it also catches orphan files that
no `posts_raw` row references anymore. Dry-run by default; --apply to delete.

Safety: if the DB keep-set comes back suspiciously small (empty / < FLOOR), the
sweep ABORTS without deleting — guards against wiping the whole disk on a DB error.

    docker run --rm -v react_native_sf_citysignal_media:/srv/media \\
        --env-file .env -e MEDIA_DIR=/srv/media --network <net> \\
        react_native_sf-curator python -m app.cleanup_media            # dry-run
    ... python -m app.cleanup_media --apply                             # delete
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from sqlalchemy import text

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope

# Below this many kept references we assume the query/DB is broken and refuse to
# delete (a healthy keep-set is thousands of files).
KEEP_FLOOR = 200

KEEP_SQL = text(
    """
    WITH cutoff AS (SELECT date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AS c)
    SELECT DISTINCT replace(f, '/media/', '') AS name
    FROM curator.posts_raw pr
    LEFT JOIN curator.events_curated ec ON ec.post_id = pr.id,
    LATERAL json_array_elements_text(pr.media_urls) AS f
    WHERE f LIKE '/media/%'
      AND (
        (ec.id IS NOT NULL AND (ec.event_time >= (SELECT c FROM cutoff) OR ec.event_time IS NULL))
        OR pr.fetched_at >= now() - make_interval(days => :buffer_days)
      )
    """
)


async def load_keep(sf, buffer_days: int) -> set[str]:
    async with session_scope(sf) as s:
        rows = (await s.execute(KEEP_SQL, {"buffer_days": buffer_days})).all()
    return {r[0] for r in rows if r[0]}


def sweep(media_dir: Path, keep: set[str], apply: bool) -> dict:
    deleted = kept = errors = 0
    freed = 0
    for p in media_dir.iterdir():
        if not p.is_file():
            continue
        if p.name in keep:
            kept += 1
            continue
        try:
            size = p.stat().st_size
        except OSError:
            continue
        if apply:
            try:
                p.unlink()
                deleted += 1
                freed += size
            except OSError:
                errors += 1
        else:
            deleted += 1
            freed += size
    return {"kept": kept, "deleted": deleted, "freed_bytes": freed, "errors": errors}


async def main(apply: bool) -> None:
    buffer_days = int(os.getenv("CLEANUP_KEEP_DAYS", "3"))
    media_dir = Path(os.getenv("MEDIA_DIR", "/srv/media"))
    if not media_dir.is_dir():
        print(f"[cleanup_media] ABORT: media dir not found: {media_dir}")
        return

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)
    try:
        keep = await load_keep(sf, buffer_days)
    finally:
        await engine.dispose()

    if len(keep) < KEEP_FLOOR:
        print(f"[cleanup_media] ABORT: keep-set too small ({len(keep)} < {KEEP_FLOOR}) — DB error? nothing deleted.")
        return

    res = sweep(media_dir, keep, apply)
    mode = "APPLIED" if apply else "DRY-RUN"
    verb = "deleted" if apply else "would_delete"
    print(
        f"[cleanup_media {mode}] dir={media_dir} buffer={buffer_days}d "
        f"keep_refs={len(keep)} kept={res['kept']} {verb}={res['deleted']} "
        f"freed={res['freed_bytes'] / 1073741824:.2f}GB errors={res['errors']}"
    )


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv[1:]))
