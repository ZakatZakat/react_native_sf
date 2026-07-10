#!/bin/sh
# Backfill / refresh curator.posts_raw.media_hash — the sha256 of each post's
# first media file. Cross-posts of one event carry a BYTE-IDENTICAL poster under
# different URLs (each channel downloads its own copy), so the image hash is the
# only reliable de-dupe key. The feed API exposes media_hash and the frontend
# collapses events sharing (media_hash, event_time).
#
# The curator container has no media mount, so this runs on the HOST via
# `docker exec` into the db + media containers. Idempotent: hashes ONLY files
# whose post has no hash yet, so it's cheap to re-run.
#
# Usage:
#   deploy/hash_media.sh              # backfill + incremental
#   (cron) 7 * * * * /root/react_native_sf/deploy/hash_media.sh >> /var/log/hash_media.log 2>&1
set -eu

DB=react_native_sf-db-1
MEDIA=react_native_sf-media-1
PSQL="docker exec -i $DB psql -U postgres -d tg_events -q -t -A"

# 1. ensure the column exists (no-op after the first run)
echo "ALTER TABLE curator.posts_raw ADD COLUMN IF NOT EXISTS media_hash varchar;" | $PSQL >/dev/null

# 2. filenames of posts that still need a hash (first media file only)
NEED=$(echo "SELECT split_part(media_urls->>0, chr(47), -1) FROM curator.posts_raw WHERE media_hash IS NULL AND json_array_length(media_urls) > 0;" | $PSQL)
if [ -z "$NEED" ]; then
  echo "$(date -u +%FT%TZ) media_hash: nothing to hash"
  exit 0
fi
COUNT=$(printf '%s\n' "$NEED" | grep -c . || true)
echo "$(date -u +%FT%TZ) media_hash: hashing $COUNT file(s)"

# 3. hash only those files inside the media container, stage, and update
echo "DROP TABLE IF EXISTS curator.media_hash_stage; CREATE TABLE curator.media_hash_stage(fn text, h text);" | $PSQL >/dev/null
printf '%s\n' "$NEED" \
  | docker exec -i "$MEDIA" sh -c 'cd /srv/media && xargs sha256sum 2>/dev/null' \
  | awk '{print $2"\t"$1}' \
  | docker exec -i "$DB" psql -U postgres -d tg_events -q -c "COPY curator.media_hash_stage(fn,h) FROM STDIN"
docker exec "$DB" psql -U postgres -d tg_events -q -c \
  "UPDATE curator.posts_raw p SET media_hash=s.h FROM curator.media_hash_stage s WHERE p.media_hash IS NULL AND json_array_length(p.media_urls)>0 AND split_part(p.media_urls->>0, chr(47), -1)=s.fn;"
docker exec "$DB" psql -U postgres -d tg_events -q -c "DROP TABLE curator.media_hash_stage;" >/dev/null
echo "$(date -u +%FT%TZ) media_hash: done"
