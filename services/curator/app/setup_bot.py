"""Разовая (идемпотентная) настройка публичного бота CitySignal через Bot API.

Ставит за один прогон:
  • setWebhook          → апдейты идут на …/curator/tg/webhook (+ секрет в заголовке)
  • setMyCommands       → список по «/» (ru): start / help / feedback
  • setMyDescription    → блок «Что умеет этот бот?» (до 512 символов)
  • setMyShortDescription → строка на странице профиля (About, до 120)
  • setChatMenuButton   → кнопка «Открыть» запускает web_app

Что НЕЛЬЗЯ через Bot API (только вручную в @BotFather):
  • картинку/видео к описанию (640×360) — BotFather → Edit Description Picture
  • имя, аватар, видео-аватар

Запуск (внутри контейнера curator, токен берётся из его env):
    docker compose exec curator python -m app.setup_bot
Идемпотентно — можно гонять сколько угодно раз. Показать текущий webhook:
    docker compose exec curator python -m app.setup_bot --info
"""

from __future__ import annotations

import sys

import httpx

from app.config import Settings
from app.routers.bot import webhook_secret

# Description — карточка «Что умеет этот бот?» (до 512). Держим тон бренда.
DESCRIPTION = (
    "CitySignal — то, что движется в городе.\n\n"
    "Свежая афиша из десятков телеграм-каналов в одном месте: концерты, "
    "выставки, рейвы, спектакли, лекции. Отмечай, что нравится, — лента "
    "подстроится под тебя. Смотри на карте, что проходит рядом.\n\n"
    "Жми «Открыть» ↓"
)

# Short description — строка на странице профиля (About, до 120).
SHORT_DESCRIPTION = (
    "То, что движется в городе. Концерты, выставки, рейвы, спектакли — "
    "собери ленту под себя."
)

COMMANDS = [
    {"command": "start", "description": "Открыть CitySignal"},
    {"command": "help", "description": "Как это работает"},
    {"command": "feedback", "description": "Написать нам"},
]


def _call(token: str, method: str, payload: dict) -> dict:
    r = httpx.post(
        f"https://api.telegram.org/bot{token}/{method}", json=payload, timeout=15.0
    )
    data = r.json()
    ok = "OK " if data.get("ok") else "ERR"
    print(f"  [{ok}] {method}: {data.get('description') or data.get('result')}")
    return data


def main() -> int:
    settings = Settings()
    token = settings.bot_token
    if not token:
        print("ERROR: нет токена бота (CS_BOT_TOKEN / TELEGRAM_BOT_TOKEN).")
        return 1

    webapp = settings.cs_webapp_url
    webhook_url = f"{settings.cs_webhook_base.rstrip('/')}/tg/webhook"

    if "--info" in sys.argv:
        _call(token, "getWebhookInfo", {})
        _call(token, "getMyCommands", {})
        return 0

    print(f"Настраиваю бота, webapp={webapp}")
    print(f"webhook → {webhook_url}")

    _call(
        token,
        "setWebhook",
        {
            "url": webhook_url,
            "secret_token": webhook_secret(token),
            "allowed_updates": ["message"],
            "drop_pending_updates": True,
        },
    )
    _call(token, "setMyCommands", {"commands": COMMANDS, "language_code": "ru"})
    # Дефолтная (без language_code) — чтобы у не-русских клиентов тоже был список.
    _call(token, "setMyCommands", {"commands": COMMANDS})
    _call(token, "setMyDescription", {"description": DESCRIPTION})
    _call(token, "setMyShortDescription", {"short_description": SHORT_DESCRIPTION})
    _call(
        token,
        "setChatMenuButton",
        {
            "menu_button": {
                "type": "web_app",
                "text": "Открыть",
                "web_app": {"url": webapp},
            }
        },
    )
    print("Готово. Проверь: python -m app.setup_bot --info")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
