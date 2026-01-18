from __future__ import annotations

import asyncio
import os
import sys

from telethon import TelegramClient
from telethon.errors import PhoneCodeExpiredError, PhoneCodeInvalidError
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession

from app.config import Settings


def _prompt(label: str) -> str:
    sys.stderr.write(label)
    sys.stderr.flush()
    return sys.stdin.readline().strip()


async def _run() -> int:
    """Generate Telethon StringSession for user login."""
    settings = Settings()

    phone = os.getenv("TELEGRAM_PHONE")
    interactive = sys.stdin.isatty()
    if not phone and interactive:
        phone = _prompt("TELEGRAM_PHONE: ")
    if not phone:
        print("Missing TELEGRAM_PHONE env var", file=sys.stderr)
        return 2

    client = TelegramClient(StringSession(), settings.telegram_api_id, settings.telegram_api_hash)
    await client.connect()
    try:
        if not await client.is_user_authorized():
            attempts_left = 3
            while attempts_left > 0:
                sent = await client.send_code_request(phone)
                code = os.getenv("TELEGRAM_CODE")
                code_hash = os.getenv("TELEGRAM_CODE_HASH")

                if interactive:
                    code = _prompt("TELEGRAM_CODE: ")
                    code_hash = sent.phone_code_hash
                elif not code:
                    print(
                        "Code sent. Re-run with TELEGRAM_CODE and TELEGRAM_CODE_HASH.\n"
                        f"Example: TELEGRAM_CODE_HASH=\"{sent.phone_code_hash}\""
                    )
                    return 1
                elif not code_hash:
                    print("Missing TELEGRAM_CODE_HASH env var. Re-run step 1 to get it.", file=sys.stderr)
                    return 4

                try:
                    await client.sign_in(phone=phone, code=code, phone_code_hash=code_hash)
                    break
                except (PhoneCodeInvalidError, PhoneCodeExpiredError) as e:
                    attempts_left -= 1
                    if not interactive or attempts_left <= 0:
                        raise
                    print(f"{type(e).__name__}. Trying again (left: {attempts_left})", file=sys.stderr)
                    continue
                except SessionPasswordNeededError:
                    password = os.getenv("TELEGRAM_PASSWORD")
                    if interactive and not password:
                        password = _prompt("TELEGRAM_PASSWORD (2FA): ")
                    if not password:
                        print("2FA enabled. Re-run with TELEGRAM_PASSWORD.", file=sys.stderr)
                        return 3
                    await client.sign_in(password=password)
                    break

        session = client.session.save()
        print(session)
        return 0
    finally:
        await client.disconnect()


def main() -> None:
    raise SystemExit(asyncio.run(_run()))


if __name__ == "__main__":
    main()

