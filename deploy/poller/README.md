# CitySignal — вынос Telegram-поллера на отдельную машину

Цель: на **общем сервере** (где есть другие сотрудники) не держать Telegram
`api_hash` / `session_string`. Эти секреты переезжают на машину, которую
контролируешь только ты. Общий сервер обращается к поллеру по HTTPS с общим
токеном — и больше ничего про Telegram не знает.

```
┌─────────────────────────┐        HTTPS + Bearer token        ┌──────────────────────┐
│  ОБЩИЙ СЕРВЕР            │  ───────────────────────────────► │  ТВОЯ FREE-TIER МАШИНА│
│  app · api · curator    │   curator → /ingest                │  telegram (userbot)   │
│  db · redis             │                                    │  bot (опц.) · caddy   │
│  TG-секретов НЕТ         │                                    │  api_hash + session   │
└─────────────────────────┘                                    └──────────────────────┘
```

Почему это безопасно для твоей угрозы: curator **не использует session
напрямую** — он только ходит по HTTP в сервис `telegram`. Значит на общем
сервере TG-секреты не нужны вообще.

---

## 0. Где взять бесплатную машину

- **Oracle Cloud Always Free** — настоящая бесплатная ARM-VM навсегда (4 ядра /
  24 ГБ). Лучший вариант. Нужен публичный IP (есть) + домен.
- **Домашний комп / Raspberry Pi** — если есть белый IP или туннель.
- **fly.io** — даёт `*.fly.dev` с TLS из коробки (нужна карта на файле).

Дальше — инструкция под VM + Docker + домен (Oracle/любой VPS).

## 1. Домен (бесплатно)

Заведи бесплатный домен на **DuckDNS** (или подобном) и направь его на IP
машины, напр. `poller.example.duckdns.org`. Caddy сам получит на него
Let's Encrypt-сертификат.

## 2. Развернуть поллер

```bash
# на free-tier машине
git clone <repo> citysignal && cd citysignal/deploy/poller
cp .env.poller.example .env
# заполни .env: TELEGRAM_* из скачанного server .env, POLLER_DOMAIN, INGEST_TOKEN
openssl rand -hex 32        # ← это значение в INGEST_TOKEN (и потом на сервер)

docker compose up -d --build
curl https://<POLLER_DOMAIN>/health      # → {"status":"ok"}
# проверка токена (должно быть 401 без него, 200 с ним):
curl -X POST https://<POLLER_DOMAIN>/ingest -H 'Content-Type: application/json' -d '{"channel_ids":["@garagemca"],"per_channel_limit":1}'
curl -X POST https://<POLLER_DOMAIN>/ingest -H "Authorization: Bearer <INGEST_TOKEN>" -H 'Content-Type: application/json' -d '{"channel_ids":["@garagemca"],"per_channel_limit":1}'
```

## 3. Переключить общий сервер на поллер

На общем сервере в `.env` (или env curator/app):

```bash
# было: TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION_STRING / TELEGRAM_LOGIN_MODE
# УДАЛИТЬ все четыре — они больше не нужны на общем сервере.

# добавить:
TELEGRAM_SERVICE_URL=https://<POLLER_DOMAIN>
TELEGRAM_SERVICE_TOKEN=<INGEST_TOKEN>   # тот же, что на поллере
```

В `docker-compose.yml` общего сервера у сервиса `telegram` больше нет смысла —
убери блок `telegram:` (и `bot:`, если он переехал на поллер), и из env
curator/app убери `TELEGRAM_API_*` / `TELEGRAM_SESSION_STRING`. Оставь у curator:

```yaml
    environment:
      TELEGRAM_SERVICE_URL: ${TELEGRAM_SERVICE_URL}
      TELEGRAM_SERVICE_TOKEN: ${TELEGRAM_SERVICE_TOKEN}
```

Затем:

```bash
docker compose up -d --build curator app api
```

## 4. Проверка

После старта curator-планировщик начнёт опрашивать каналы через поллер.
В логах curator: `channel @...: fetched=N`. Если 401 — токены не совпали.

---

## Что это даёт

- На общем сервере **нет** `api_hash` / `session_string` — коллегам с доступом
  к нему красть нечего.
- `/ingest` поллера закрыт bearer-токеном поверх HTTPS — публично не дёрнуть.
- Картинки постов отдаёт сам поллер (`/media`) со своего домена.

## Чего это НЕ даёт

- На самой free-tier машине секреты есть (иначе userbot не подключится). Но это
  машина, которую контролируешь только ты — в этом весь смысл.
- Если хочешь добить угрозу до нуля — заведи под userbot **отдельный пустой
  Telegram-аккаунт** (бёрнер): тогда даже утечка session ведёт в аккаунт без
  твоих данных.
