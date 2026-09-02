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

import asyncio
import base64
import binascii
import hashlib
import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.auth import require_admin
from app.db import session_scope
from app.models import BotSubscriber, FeedbackNote

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

# Промпт начинается с маркера FEEDBACK_MARKER — по нему ловим ответ юзера
# (reply_to_message.text) без серверного стейта: force_reply привязывает ответ
# именно к этому сообщению.
FEEDBACK_MARKER = "Напишите ваш отзыв"
FEEDBACK_PROMPT = (
    "Напишите ваш отзыв или идею одним сообщением — прямо в ответ на это. "
    "Читаю всё, передам команде."
)
FEEDBACK_THANKS = "Спасибо! Отзыв передан команде 🙏"
FEEDBACK_EMPTY = "Пусто — напишите текст отзыва одним сообщением."
# Быстрый позитивный отклик по кнопке «Всё хорошо» — благодарим, отзыв не просим.
FEEDBACK_OK_THANKS = "Спасибо за отклик!"

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
            existed = (await s.execute(
                select(BotSubscriber.chat_id).where(BotSubscriber.chat_id == chat_id)
            )).first() is not None
            await s.execute(stmt)
        if not existed:
            # первый контакт этого chat_id → сразу пингуем владельца
            await _notify_owner_new_user(request, chat)
    except Exception as e:  # noqa: BLE001
        logger.warning("subscriber upsert failed: %s", e)


async def _notify_owner_new_user(request: Request, chat: dict) -> None:
    """Сразу писать владельцу в ЛС о новом пользователе бота (NOTIFY_CHAT_ID).
    Ошибки не роняют webhook."""
    settings = request.app.state.settings
    target = getattr(settings, "notify_chat_id", 0)
    token = settings.bot_token
    if not target or not token:
        return
    un = chat.get("username")
    who = f"@{un}" if un else (chat.get("first_name") or f"id {chat.get('id')}")
    try:
        await _send(token, int(target), f"👤 Новый пользователь CitySignal: {who}")
    except Exception as e:  # noqa: BLE001
        logger.warning("new-user notify failed: %s", e)


def webhook_secret(token: str) -> str:
    """Секрет для X-Telegram-Bot-Api-Secret-Token — детерминированно из токена."""
    return hashlib.sha256(f"{token}:cs-webhook-v1".encode()).hexdigest()[:32]


def _keyboard(webapp_url: str) -> dict:
    return {
        "inline_keyboard": [
            [{"text": "Открыть CitySignal", "web_app": {"url": webapp_url}}],
            [{"text": "Обратная связь", "callback_data": "fb"}],
        ]
    }


FEEDBACK_REPLY_MARKUP = {"force_reply": True, "input_field_placeholder": "Ваш отзыв…"}


async def _answer_callback(token: str, callback_query_id: str | None) -> None:
    """Снять «часики» с нажатой inline-кнопки (иначе клиент крутит спиннер)."""
    if not callback_query_id:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{token}/answerCallbackQuery",
                json={"callback_query_id": callback_query_id},
            )
    except Exception as e:  # noqa: BLE001 — не роняем webhook
        logger.warning("answerCallbackQuery failed: %s", e)


async def _save_feedback(request: Request, chat: dict, text: str) -> bool:
    """Сохранить отзыв из ЛС бота в ту же таблицу, что и веб-фидбек (feedback_notes,
    админ-эндпоинт /admin/feedback-notes их уже читает). Ошибки не роняют webhook."""
    sf = getattr(request.app.state, "session_factory", None)
    chat_id = chat.get("id")
    if sf is None or not chat_id:
        return False
    uname = chat.get("username")
    name = f"@{uname}" if uname else (chat.get("first_name") or None)
    try:
        async with session_scope(sf) as s:
            s.add(FeedbackNote(user_id=chat_id, user_name=name, text=text[:4000]))
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning("bot feedback save failed: %s", e)
        return False


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

    # Нажатие inline-кнопки «Обратная связь» → просим написать отзыв ответом на
    # промпт (force_reply). Стейт не храним: привязка живёт в reply_to_message.
    cq = update.get("callback_query")
    if isinstance(cq, dict):
        cq_chat = ((cq.get("message") or {}).get("chat")) or {}
        cq_chat_id = cq_chat.get("id")
        await _answer_callback(token, cq.get("id"))
        cq_data = cq.get("data") or ""
        if cq_data == "fb" and cq_chat_id:
            await _send(token, cq_chat_id, FEEDBACK_PROMPT, FEEDBACK_REPLY_MARKUP)
        elif cq_data == "fb_ok" and cq_chat_id:
            # позитивная кнопка «Всё хорошо» — логируем маркером в тот же
            # feedback_notes (для подсчёта) и благодарим, текст не просим.
            await _save_feedback(request, cq.get("from") or cq_chat, "👍 Всё хорошо")
            await _send(token, cq_chat_id, FEEDBACK_OK_THANKS)
        return Response(status_code=200)

    msg = update.get("message") or update.get("edited_message")
    if not isinstance(msg, dict):
        return Response(status_code=200)
    text = (msg.get("text") or "").strip()
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return Response(status_code=200)

    # Захват отзыва: сообщение — это ответ на наш промпт (force_reply привязал его
    # к сообщению, начинающемуся с FEEDBACK_MARKER). Ловим ДО гейта на «/».
    reply_txt = ((msg.get("reply_to_message") or {}).get("text") or "")
    if reply_txt.startswith(FEEDBACK_MARKER) and not text.startswith("/"):
        if not text:
            await _send(token, chat_id, FEEDBACK_EMPTY, FEEDBACK_REPLY_MARKUP)
        else:
            await _upsert_subscriber(request, chat, None)  # освежить профиль
            ok = await _save_feedback(request, chat, text)
            await _send(token, chat_id, FEEDBACK_THANKS if ok else FEEDBACK_EMPTY)
        return Response(status_code=200)

    if not text.startswith("/"):
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
        await _send(token, chat_id, FEEDBACK_PROMPT, FEEDBACK_REPLY_MARKUP)
    elif cmd == "/stop":
        await _send(token, chat_id, STOP)
    return Response(status_code=200)


async def _tg_post(token: str, method: str, data: dict | None = None, files: dict | None = None) -> None:
    """POST в Bot API; поднимает исключение на не-200, чтобы рассылка знала, кому не ушло."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f"https://api.telegram.org/bot{token}/{method}", data=data, files=files)
    if r.status_code != 200:
        raise RuntimeError(f"{method} {r.status_code}: {r.text[:200]}")


class BroadcastReq(BaseModel):
    text: str = ""              # длинный текст (HTML), уходит отдельным сообщением
    caption: str = ""           # подпись к фото (<=1024), опц.
    parse_mode: str = "HTML"
    target: str = "test"        # test → админам; subscribers → is_subscribed
    chat_ids: list[int] | None = None  # явный список получателей (перекрывает target) — для точечных/персональных рассылок
    as_document: bool = False   # true → sendDocument (без сжатия Telegram), иначе sendPhoto
    dry_run: bool = False
    photo_b64: str | None = None  # PNG в base64 (без data:-префикса)
    filename: str = "digest.png"


@router.post("/broadcast")
async def broadcast(
    req: BroadcastReq,
    request: Request,
    _admin: int = Depends(require_admin),  # ?as_user=<admin> в AUTH_DEV_MODE
) -> dict:
    """Ручная рассылка «фото + текст». По умолчанию target=test (только админам) —
    массовая отправка требует явного target=subscribers. Рейт-лимит + лог ошибок."""
    settings = request.app.state.settings
    token = settings.bot_token
    if not token:
        raise HTTPException(500, "bot token not configured")

    if req.chat_ids:
        recipients = [int(c) for c in req.chat_ids]
    elif req.target == "subscribers":
        sf = request.app.state.session_factory
        async with session_scope(sf) as s:
            rows = (await s.execute(select(BotSubscriber.chat_id).where(BotSubscriber.is_subscribed.is_(True)))).all()
        recipients = [r[0] for r in rows]
    else:  # test
        recipients = sorted(settings.admin_user_ids)

    if req.dry_run:
        return {"target": req.target, "recipients": len(recipients), "sample": recipients[:10]}

    photo_bytes = None
    if req.photo_b64:
        try:
            photo_bytes = base64.b64decode(req.photo_b64)
        except (binascii.Error, ValueError) as e:
            raise HTTPException(400, f"bad photo_b64: {e}")
    caption, parse_mode = req.caption, req.parse_mode
    text = req.text
    fname = req.filename or "digest.png"
    method = "sendDocument" if req.as_document else "sendPhoto"
    field = "document" if req.as_document else "photo"

    sent, failed, errors = 0, 0, []
    for cid in recipients:
        try:
            if photo_bytes is not None:
                data = {"chat_id": str(cid)}
                if caption:
                    data["caption"] = caption
                    data["parse_mode"] = parse_mode
                await _tg_post(token, method, data=data, files={field: (fname, photo_bytes, "image/png")})
            if text:
                await _tg_post(token, "sendMessage", data={
                    "chat_id": str(cid), "text": text,
                    "parse_mode": parse_mode, "disable_web_page_preview": "true",
                })
            sent += 1
        except Exception as e:  # noqa: BLE001 — не роняем рассылку из-за одного получателя
            failed += 1
            if len(errors) < 10:
                errors.append(f"{cid}: {str(e)[:160]}")
        await asyncio.sleep(0.06)  # ~16 msg/s, безопасно под лимитом Telegram
    return {"target": req.target, "recipients": len(recipients), "sent": sent, "failed": failed, "errors": errors}
