# Деплой

Инструкция по выкатке изменений на прод. Актуально на 2026-07-10.

> **Основной способ выката — `./scripts/deploy.sh`** (катит только `origin/master`
> под серверным локом; несколько сессий не затрут друг друга). Ручные команды
> ниже — как референс механики. Про изоляцию сессий и «коммить только своё» —
> см. `CLAUDE.md`. `./scripts/deploy.sh --check` показывает, чей коммит на проде.

## Архитектура

- **Прод-сервер:** `root@45.144.52.40`, репозиторий лежит в `/root/react_native_sf`.
- **Гит:** `origin` = `github.com/ZakatZakat/react_native_sf`, рабочая ветка — `master`.
- **Docker Compose**, 4 сервиса (имена контейнеров — `react_native_sf-<service>-1`):
  - `app` — фронтенд (React + Vite). Собирается **внутри образа** (`npm run build`), раздаётся nginx на `:80`, наружу отдаётся через **Traefik** по `${DOMAIN}`. Своего хост-порта нет.
  - `curator` — бэкенд (FastAPI, Python), схема `curator` в Postgres.
  - `db` — Postgres 16, база `tg_events`.
  - `media` — раздача скачанного медиа (`/media`).

> Реальная сборка фронта происходит в `docker compose build app` (Dockerfile,
> стадия `build` → `npm run build`). Локальный `vite build` — только санити-чек,
> он **не** влияет на прод (образ пересобирается из исходников).

## Фронтенд — обычный случай

Все команды из папки `react_native_sf/`.

1. (необязательно, но полезно) локальная проверка сборки — ловит ошибки до долгого docker build:
   ```
   node ./node_modules/vite/bin/vite.js build
   ```
2. Коммит и пуш (стиль коммитов — ниже):
   ```
   git add -A && git commit -m "…" && git push origin master
   ```
3. Выкатка на проде:
   ```
   ssh root@45.144.52.40 'cd /root/react_native_sf && git pull --ff-only && docker compose build app && docker compose up -d app'
   ```

## Бэкенд (curator)

То же самое, но сервис `curator`:
```
ssh root@45.144.52.40 'cd /root/react_native_sf && git pull --ff-only && docker compose build curator && docker compose up -d curator'
```

## Проверка после деплоя

```
# статус контейнера
ssh root@45.144.52.40 'docker ps --filter name=react_native_sf-app-1 --format "{{.Status}}"'
# логи (nginx для app)
ssh root@45.144.52.40 'docker logs --tail 20 react_native_sf-app-1'
```

У `app` нет хост-порта (он за Traefik), поэтому health смотрим по `docker ps` /
логам nginx, а не `curl localhost:<port>`.

> При `docker compose ...` в выводе мелькают предупреждения вида
> `The "TELEGRAM_API_ID" variable is not set` — они **безвредны** (интерполяция
> compose, дефолт — пустая строка) и к app/db отношения не имеют.

## Кэш Telegram

Мини-апп в Telegram агрессивно кэширует JS-бандл. После деплоя **переоткрой
мини-апп** (или потяни на обновление) — иначе показывается старая версия.

## База данных и одноразовые скрипты

```
# psql в прод-базу
ssh root@45.144.52.40 'docker exec -it react_native_sf-db-1 psql -U postgres -d tg_events'
# бэкфиллы/скрипты бэкенда (пример)
ssh root@45.144.52.40 'docker exec react_native_sf-curator-1 python -m app.backfill_geo'
```

## Стиль коммитов и PR (важно для этого репо)

- Сообщения коммитов — **на русском**, прошедшее время / страдательный залог
  («Добавлено», «Исправлено», «Убрано»).
- **Без** trailer'ов `Co-Authored-By` и без пометок про генерацию.
- `gh pr create` / `gh pr merge` — **только по явной команде владельца**, не
  автоматически «раз ветка готова».

## Чего НЕ трогать на сервере

На `45.144.52.40` крутится много чужих проектов (avia-platform, sok,
digital-assistant, VPN-контейнеры xray/x-ui и т.п.). Работать только с
compose-проектом `react_native_sf`. Ничего лишнего не останавливать и не удалять.
