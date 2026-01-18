from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
from typing import Any
from urllib.parse import unquote, unquote_plus

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from app.config import Settings
from app.repositories.users import UsersRepository
from app.schemas import TelegramAuthRequest, TelegramAuthUpdateRequest, TelegramAuthUser, UserProfile, UserProfileUpdate

router = APIRouter(prefix="/me", tags=["users"])
logger = logging.getLogger(__name__)


def get_users_repo(request: Request) -> UsersRepository:
    return request.app.state.users_repo  # type: ignore[attr-defined]


def _build_check_string(items: dict[str, str]) -> str:
    return "\n".join(f"{key}={value}" for key, value in sorted(items.items()))


def _build_data_check_string(bot_id: str, items: dict[str, str]) -> str:
    """Build data-check-string per Telegram Mini Apps docs."""
    return f"{bot_id}:WebAppData\n{_build_check_string(items)}"


def _parse_init_data_raw(raw: str) -> dict[str, str]:
    items: dict[str, str] = {}
    if not raw:
        return items
    for part in raw.split("&"):
        if not part:
            continue
        if "=" in part:
            key, value = part.split("=", 1)
        else:
            key, value = part, ""
        # Keep raw value (do not decode) for hash calculation candidates.
        items[key] = value
    return items


def _parse_init_data_decoded(raw: str) -> dict[str, str]:
    items: dict[str, str] = {}
    if not raw:
        return items
    for part in raw.split("&"):
        if not part:
            continue
        if "=" in part:
            key, value = part.split("=", 1)
        else:
            key, value = part, ""
        # IMPORTANT: use unquote (NOT unquote_plus) to avoid turning '+' into space.
        items[unquote(key)] = unquote(value)
    return items


def _parse_init_data_plus_decoded(raw: str) -> dict[str, str]:
    items: dict[str, str] = {}
    if not raw:
        return items
    for part in raw.split("&"):
        if not part:
            continue
        if "=" in part:
            key, value = part.split("=", 1)
        else:
            key, value = part, ""
        # Form-style decode (treat '+' as space)
        items[unquote_plus(key)] = unquote_plus(value)
    return items


def _parse_init_data_pairs(raw: str, decoder: str) -> list[tuple[str, str]]:
    """
    Parse initData into ordered key-value pairs.

    decoder:
      - "raw": keep raw key/value as-is
      - "decoded": percent-decode, do not treat '+' as space
      - "plus": percent-decode, treat '+' as space
    """
    pairs: list[tuple[str, str]] = []
    if not raw:
        return pairs
    for part in raw.split("&"):
        if not part:
            continue
        if "=" in part:
            key, value = part.split("=", 1)
        else:
            key, value = part, ""
        if decoder == "raw":
            pairs.append((key, value))
        elif decoder == "plus":
            pairs.append((unquote_plus(key), unquote_plus(value)))
        else:
            pairs.append((unquote(key), unquote(value)))
    return pairs


def _verify_init_data(init_data: str, bot_token: str) -> dict[str, Any]:
    # Telegram JS parsing (telegram-web-app.js) does:
    # - replace '+' with '%20' then decodeURIComponent.
    # So "plus-decoded" is the closest equivalent.
    parsed = _parse_init_data_plus_decoded(init_data)
    if "hash" not in parsed:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing hash in initData")
    received_hash = (parsed.get("hash") or "").strip().lower()

    auth_date = parsed.get("auth_date")
    query_id = parsed.get("query_id")
    chat_instance = parsed.get("chat_instance")
    signature_val = parsed.get("signature") or ""

    keys_present = sorted(parsed.keys())
    logger.info(
        "initData received keys=%s hash_len=%s signature_len=%s auth_date=%s query_id_prefix=%s chat_instance_prefix=%s",
        ",".join(keys_present),
        len(received_hash),
        len(signature_val),
        auth_date,
        (query_id or "")[:8] if query_id else None,
        (chat_instance or "")[:8] if chat_instance else None,
    )

    # ---- 1) Validate 'hash' (Mini App backend validation) ----
    # data_check_string: all received fields except 'hash', sorted, joined by '\n'
    data_fields = {k: v for k, v in parsed.items() if k != "hash"}
    data_check_string = _build_check_string(data_fields)

    bot_token_bytes = bot_token.encode()
    # Docs show: secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
    secret_key_a = hmac.new(bot_token_bytes, msg=b"WebAppData", digestmod=hashlib.sha256).digest()
    computed_hash_a = hmac.new(secret_key_a, msg=data_check_string.encode(), digestmod=hashlib.sha256).hexdigest()

    # Text also implies: secret_key is HMAC_SHA256(bot_token, key="WebAppData") (constant as key)
    secret_key_b = hmac.new(b"WebAppData", msg=bot_token_bytes, digestmod=hashlib.sha256).digest()
    computed_hash_b = hmac.new(secret_key_b, msg=data_check_string.encode(), digestmod=hashlib.sha256).hexdigest()

    if hmac.compare_digest(computed_hash_a, received_hash) or hmac.compare_digest(computed_hash_b, received_hash):
        logger.info("initData verified method=hash")
        return parsed

    # ---- 2) Validate 'signature' (Third-party / Ed25519) ----
    # This can be used when a new signature is present (docs: validating data for third-party use).
    # Build data_check_string_sig = "{bot_id}:WebAppData\n" + sorted fields excluding hash & signature.
    bot_id = bot_token.split(":", 1)[0]
    sig_fields = {k: v for k, v in parsed.items() if k not in {"hash", "signature"}}
    data_check_string_sig = _build_data_check_string(bot_id, sig_fields).encode()

    signature_ok = False
    if signature_val:
        pad = "=" * ((4 - (len(signature_val) % 4)) % 4)
        try:
            signature_bytes = base64.urlsafe_b64decode(signature_val + pad)
        except Exception:
            signature_bytes = b""

        # Telegram Ed25519 public keys (hex) from official docs:
        # Production: e7bf03a2...
        # Test: 40055058...
        public_keys_hex = [
            "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d",
            "40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec",
        ]
        for pk_hex in public_keys_hex:
            try:
                pk = Ed25519PublicKey.from_public_bytes(bytes.fromhex(pk_hex))
                pk.verify(signature_bytes, data_check_string_sig)
                signature_ok = True
                break
            except Exception:
                continue

    if signature_ok:
        logger.info("initData verified method=ed25519_signature")
        return parsed

    logger.warning(
        "initData signature mismatch keys=%s hash_len=%s signature_len=%s auth_date=%s candidates=%s",
        ",".join(keys_present),
        len(received_hash),
        len(signature_val),
        auth_date,
        "hash(secret_key_a|secret_key_b),ed25519_signature",
    )
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid initData signature")


def _extract_user(init_data: dict[str, Any]) -> TelegramAuthUser:
    raw_user = init_data.get("user")
    if not raw_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user in initData")
    try:
        user_payload = json.loads(raw_user)
        return TelegramAuthUser.model_validate(user_payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user payload") from exc


def _decode_init_data(init_data: str | None, init_data_b64: str | None) -> str:
    if init_data:
        return init_data
    if init_data_b64:
        try:
            return base64.b64decode(init_data_b64).decode("utf-8")
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid initData base64") from exc
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="X-Tg-Init-Data or X-Tg-Init-Data-B64 header required",
    )


def _auth_user_from_init_data(init_data: str, settings: Settings) -> TelegramAuthUser:
    bot_token = settings.telegram_bot_token
    if not bot_token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TELEGRAM_BOT_TOKEN is required for auth",
        )
    verified = _verify_init_data(init_data, bot_token)
    return _extract_user(verified)


async def telegram_auth(
    init_data: str | None = Header(default=None, alias="X-Tg-Init-Data"),
    init_data_b64: str | None = Header(default=None, alias="X-Tg-Init-Data-B64"),
) -> TelegramAuthUser:
    settings = Settings()
    decoded = _decode_init_data(init_data, init_data_b64)
    return _auth_user_from_init_data(decoded, settings)


@router.get("", response_model=UserProfile)
async def me(user: TelegramAuthUser = Depends(telegram_auth), repo: UsersRepository = Depends(get_users_repo)) -> UserProfile:
    return await repo.upsert_from_auth(user)


@router.post("/auth", response_model=UserProfile)
async def me_auth(payload: TelegramAuthRequest, repo: UsersRepository = Depends(get_users_repo)) -> UserProfile:
    settings = Settings()
    init_data = _decode_init_data(payload.init_data, payload.init_data_b64)
    user = _auth_user_from_init_data(init_data, settings)
    return await repo.upsert_from_auth(user)


@router.put("", response_model=UserProfile)
async def update_me(
    payload: UserProfileUpdate,
    user: TelegramAuthUser = Depends(telegram_auth),
    repo: UsersRepository = Depends(get_users_repo),
) -> UserProfile:
    await repo.upsert_from_auth(user)
    return await repo.update_profile(user.telegram_id, payload)


@router.put("/auth", response_model=UserProfile)
async def update_me_auth(
    payload: TelegramAuthUpdateRequest,
    repo: UsersRepository = Depends(get_users_repo),
) -> UserProfile:
    settings = Settings()
    init_data = _decode_init_data(payload.init_data, payload.init_data_b64)
    user = _auth_user_from_init_data(init_data, settings)
    await repo.upsert_from_auth(user)
    update = UserProfileUpdate(city=payload.city, interests=payload.interests)
    return await repo.update_profile(user.telegram_id, update)


