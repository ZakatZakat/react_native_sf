"""Публичный бот CitySignal: /start и текстовые команды.

Мини-апп-бот раньше не отвечал на сообщения — только показывал кнопку меню
«Открыть». Здесь лёгкий webhook (без отдельного процесса и без polling):
Telegram шлёт апдейты на POST /tg/webhook, а мы на /start отвечаем брендовым
приветствием с inline-кнопкой web_app «Открыть CitySignal». /help и /feedback —
короткие текстовые ответы.

Токен берём из настроек (CS_BOT_TOKEN → иначе TELEGRAM_BOT_TOKEN, тот же, что
подписывает init_data мини-аппа). Апдейты подтверждаем секретом в заголовке
X-Telegram-Bot-Api-Secret-Token, который выставляет setup_bot при setWebhook —
секрет детерминированно выводится из токена, поэтому его нигде не надо хранить.

Допущение: поллер каналов (services/telegram) ходит в Telegram как ЮЗЕР
(session string) и апдейты бота не потребляет, поэтому webhook на бот-токене
ему не мешает. Если поллер вдруг переведут в bot-режим с getUpdates на ЭТОМ
же токене — выдели боту /start отдельный CS_BOT_TOKEN.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, Header, Request, Response
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import session_scope
from app.models import BotSubscriber

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tg", tags=["bot"])

# Приветствие. Держим коротким и в голосе бренда — как Description, только это
# уже ответ в чате, а не карточка «Что умеет этот бот?».
WELCOME = (
    "<b>CitySignal</b> — то, что движется в городе.\n\n"
    "Свежая афиша из десятков каналов в одном месте: концерты, выставки, "
    "рейвы, спектакли, лекции. Отметь, что нравится — лента подстроится под "
    "тебя, а карта покажет, что рядом.\n\n"
    "Жми «Открыть» ↓"
)

HELP = (
    "<b>Как это работает</b>\n\n"
    "• Жми кнопку «Открыть» (внизу слева) или /start — откроется CitySignal.\n"
    "• В приложении отмечай интересы и события — лента подстроится.\n"
    "• Карта показывает, что проходит рядом.\n\n"
    "Что-то не так или есть идея — /feedback."
)

FEEDBACK = (
    "Пиши прямо в приложении: «Открыть» → профиль → «Написать нам». "
    "Читаем всё."
)

STOP = (
    "Ок, больше не буду присылать подборки. Захочешь вернуться — жми /start."
)


async def _upsert_subscriber(request: Request, chat: dict, subscribe: bool | None) -> None:
    """Сохранить/обновить подписчика бота (база для рассылок дайджеста).

    subscribe=True (/start) — подписать, False (/stop) — отписать,
    None (прочие команды) — только обновить профиль, флаг подписки не трогаем.
    Сбор не должен ронять webhook — любые ошибки логируем и глотаем."""
    sf = getattr(request.app.state, "session_factory", None)
    chat_id = chat.get("id")
    if sf is None or not chat_id:
        return
    set_: dict = {
        "username": chat.get("username"),
        "first_name": chat.get("first_name"),
        "updated_at": datetime.utcnow(),
    }
    if subscribe is not None:
        set_["is_subscribed"] = subscribe
    stmt = (
        pg_insert(BotSubscriber)
        .values(
            chat_id=chat_id,
            username=chat.get("username"),
            first_name=chat.get("first_name"),
            is_subscribed=True if subscribe is None else subscribe,
        )
        .on_conflict_do_update(index_elements=[BotSubscriber.chat_id], set_=set_)
    )
    try:
        async with session_scope(sf) as s:
            await s.execute(stmt)
    except Exception as e:  # noqa: BLE001
        logger.warning("subscriber upsert failed: %s", e)


def webhook_secret(token: str) -> str:
    """Секрет для X-Telegram-Bot-Api-Secret-Token — детерминированно из токена."""
    return hashlib.sha256(f"{token}:cs-webhook-v1".encode()).hexdigest()[:32]


def _keyboard(webapp_url: str) -> dict:
    return {
        "inline_keyboard": [
            [{"text": "Открыть CitySignal", "web_app": {"url": webapp_url}}]
        ]
    }


async def _send(token: str, chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    payload: dict = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage", json=payload
            )
            if r.status_code != 200:
                logger.warning("sendMessage %s: %s", r.status_code, r.text[:300])
    except Exception as e:  # noqa: BLE001 — не роняем webhook из-за ответа TG
        logger.warning("sendMessage failed: %s", e)


@router.post("/webhook")
async def webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> Response:
    # Telegram'у важен только код ответа (200 = принято), тело не нужно —
    # поэтому всюду возвращаем голый Response, без модели.
    settings = request.app.state.settings
    token = settings.bot_token
    # Бот не настроен — молча игнорируем (200), чтобы Telegram не ретраил.
    if not token:
        return Response(status_code=200)
    if x_telegram_bot_api_secret_token != webhook_secret(token):
        return Response(status_code=403)

    try:
        update = await request.json()
    except Exception:  # noqa: BLE001
        return Response(status_code=200)

    msg = update.get("message") or update.get("edited_message")
    if not isinstance(msg, dict):
        return Response(status_code=200)
    text = (msg.get("text") or "").strip()
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id or not text.startswith("/"):
        return Response(status_code=200)

    # /start@BotName и /start deep_link → берём первое слово без @suffix
    cmd = text.split(maxsplit=1)[0].split("@", 1)[0].lower()

    # Сбор подписчиков для рассылок: /start подписывает, /stop отписывает,
    # остальные команды только освежают профиль (флаг подписки не трогают).
    subscribe = True if cmd == "/start" else (False if cmd == "/stop" else None)
    await _upsert_subscriber(request, chat, subscribe)

    if cmd == "/start":
        await _send(token, chat_id, WELCOME, _keyboard(settings.cs_webapp_url))
    elif cmd == "/help":
        await _send(token, chat_id, HELP, _keyboard(settings.cs_webapp_url))
    elif cmd == "/feedback":
        await _send(token, chat_id, FEEDBACK)
    elif cmd == "/stop":
        await _send(token, chat_id, STOP)
    return Response(status_code=200)
