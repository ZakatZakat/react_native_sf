# Migration Inventory (Web -> Mobile)

## Screens and Routes
- `/` -> `src/pages/Landing.tsx`
- `/landing-2` -> `src/pages/Landing2.tsx`
- `/landing-3` -> `src/pages/Landing3.tsx`
- `/landing-5` -> `src/pages/Landing5.tsx`
- `/landing-6` -> `src/pages/Landing6.tsx`
- `/feed` -> `src/pages/Feed.tsx`
- `/profile` -> `src/pages/Profile.tsx`
- `/about` -> `src/pages/About.tsx`
- `RouteError` -> `src/pages/RouteError.tsx`

## Frontend API Calls (current)
- `GET /events?limit=20|60|120` (Feed + Landing variants)
- `POST /debug/telegram-fetch-recent` (Feed manual sync)
- `GET /debug/telegram-creds` (Feed debug)
- `POST /debug/client-error` (RouteError, main.tsx)
- `POST /me/auth` (Profile load, Telegram initData auth)
- `PUT /me/auth` (Profile save, Telegram initData auth)

## Backend Endpoints (FastAPI)
- `GET /health`
- `GET /events` (query: `limit`)
- `POST /events/ingest`
- `GET /debug/telegram-creds`
- `POST /debug/client-error`
- `POST /debug/telegram-fetch-recent`
- `GET /me` (Telegram header auth)
- `POST /me/auth` (Telegram initData auth)
- `PUT /me` (Telegram header auth)
- `PUT /me/auth` (Telegram initData auth)

## Data Models
### EventCard
- `id: str`
- `title: str`
- `description?: str`
- `channel: str`
- `message_id: int`
- `event_time?: datetime`
- `media_urls?: str[]`
- `location?: str`
- `price?: str`
- `category?: str`
- `source_link?: url`
- `created_at: datetime`

### UserProfile (Telegram-based)
- `telegram_id: int`
- `username?: str`
- `first_name?: str`
- `last_name?: str`
- `photo_url?: str`
- `language_code?: str`
- `city?: str`
- `interests: str[]`
- `created_at: datetime`
- `updated_at: datetime`

## Telegram Dependencies (to remove/refactor)
- `src/hooks/useTelegramInitData.ts`
- `src/tg.ts`
- `/me/auth` initData flow on backend
- UI references in `Profile` and `Feed`

## Notes for Mobile
- Web uses Chakra UI + CSS animations. RN needs new components/styles.
- Feed uses 2-column layout and dialog details.
- Landing pages are mostly marketing layouts and can be simplified for mobile.
