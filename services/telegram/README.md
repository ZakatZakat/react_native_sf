# Telegram Channel Service

Микросервис: подкачка каналов и инфы из Telegram (аватарки, subs, посты). Без БД.

## Env

Из корня репо `.env`: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_BOT_TOKEN` или `TELEGRAM_SESSION_STRING`, `TELEGRAM_LOGIN_MODE`. Опционально `MEDIA_ROOT` (по умолчанию `services/telegram/media`).

## Запуск

**Через Docker (рекомендуется):** из корня репо добавлен сервис `telegram` в `docker-compose.local.yml`:

```bash
docker compose -f docker-compose.local.yml up -d telegram
```

Порт 8002. Медиа монтируется из `./backend/media`.

**Локально:**

```bash
cd services/telegram
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## API

- `GET /health` — ок
- `GET /media/{path}` — статика (аватарки, медиа постов)
- `GET /channel-avatar?channel=username` — 302 на `/media/channel_avatar_xxx.jpg` или 404
- `POST /channels-info` — тело `{"channels": ["@a", "b"]}` → `[{ "name", "subs", "avatar" }, ...]`
- `POST /ingest` — тело `{"channel_ids": ["@ch"], "per_channel_limit": 5, ...}` → `{ "events": [...], "channels_ok", "channels_failed" }`
- `POST /fetch-channel` — тело `{"source_channel": "rep_des_art", "limit": 100, "return_posts": true, "extract_channel_links": true}` → `{ "channels", "posts" }`
