"""Telegram WebApp init_data validation.

Mirrors what backend's routers/users.py does — same algorithm, so a frontend
that already authenticates with backend will work with curator unchanged.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any
from urllib.parse import unquote

logger = logging.getLogger(__name__)


def _parse_pairs(raw: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for chunk in raw.split("&"):
        if "=" not in chunk:
            continue
        k, _, v = chunk.partition("=")
        out.append((k, unquote(v)))
    return out


def verify_init_data(init_data: str, bot_token: str) -> dict[str, Any] | None:
    """Returns parsed user dict if valid, else None."""
    if not init_data or not bot_token:
        return None

    pairs = _parse_pairs(init_data)
    fields = dict(pairs)
    received_hash = fields.pop("hash", None)
    if not received_hash:
        return None

    # data_check_string: sorted "key=value" lines joined by \n
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed, received_hash):
        return None

    user_raw = fields.get("user")
    if not user_raw:
        return None
    try:
        return json.loads(user_raw)
    except Exception:
        return None
