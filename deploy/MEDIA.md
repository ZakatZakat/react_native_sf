# Media: хранение и доставка

Telegram-поллер (off-box) media **не хранит** — пушит на общий сервер и удаляет у себя.

```
Telegram → поллер (tmpfs/RAM, ≤3 мин) ──ssh push──► shared 45.144.52.40 (хранит + отдаёт /media)
                                       └─ удаляет у себя
```

## Поллер (напр. 185.233.82.68)
- `deploy/poller/docker-compose.yml` — у telegram media в **tmpfs** (RAM), на диск не пишется.
- `deploy/poller/push-media.sh` — tar'ит media из контейнера, шлёт по ssh на общий сервер
  (volume `react_native_sf_citysignal_media`), затем удаляет локально. Идемпотентно
  (имена файлов по message-id).
- Cron: `*/3 * * * * /root/push-media.sh` (нужен ssh-ключ поллер→общий).

## Общий сервер (45.144.52.40)
- `deploy/media-nginx.conf` — nginx раздаёт `/media` из volume `citysignal_media`.
  `@poller` fallback — тонкая страховка на окно пуша (если файл ещё не доехал).
- Traefik-роут `Host(DOMAIN) && PathPrefix(/media)` → этот nginx (сервис `media` в compose).

## curator
- Media сам НЕ тянет (нет `MEDIA_ROOT`). Только опрашивает поллер по `/ingest`.
