from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_resolved = Path(__file__).resolve()
_ENV_PATH: Path | None = None
for i in range(5):
    try:
        p = _resolved.parents[i] / ".env"
        if p.exists():
            _ENV_PATH = p
            break
    except IndexError:
        break
ENV_FILE = str(_ENV_PATH) if _ENV_PATH else None


class Settings(BaseSettings):
    # Postgres — общая инстанция, отдельная схема "curator"
    postgres_dsn: str = Field(..., alias="POSTGRES_DSN")
    curator_schema: str = Field("curator", alias="CURATOR_SCHEMA")

    # Telegram микросервис (raw fetcher). When the poller runs off-box, point
    # the URL at it and set the shared bearer token below.
    telegram_service_url: str = Field("http://telegram:8000", alias="TELEGRAM_SERVICE_URL")
    telegram_service_token: str = Field("", alias="TELEGRAM_SERVICE_TOKEN")
    # Local dir where curator mirrors post media right after fetching (served
    # by the media nginx). Empty → don't pull (the telegram service serves it).
    media_root: str = Field("", alias="MEDIA_ROOT")

    # Telegram WebApp init_data validation (same secret as backend)
    telegram_bot_token: str = Field("", alias="TELEGRAM_BOT_TOKEN")
    auth_dev_mode: bool = Field(False, alias="AUTH_DEV_MODE")  # accept ?as_user=N for dev

    # Публичный бот CitySignal — тот же, что владеет мини-аппом и подписывает
    # init_data. Держим отдельный CS_BOT_TOKEN на случай выделенного бота под
    # /start; по умолчанию — тот же TELEGRAM_BOT_TOKEN. cs_webapp_url — куда
    # ведёт кнопка «Открыть» (web_app), cs_webhook_base — публичный префикс
    # curator за reverse-proxy (…/curator), к нему setup_bot добавляет /tg/webhook.
    cs_bot_token: str = Field("", alias="CS_BOT_TOKEN")
    cs_webapp_url: str = Field("https://citysignal.digital-assistant.tech/", alias="CS_WEBAPP_URL")
    cs_webhook_base: str = Field(
        "https://citysignal.digital-assistant.tech/curator", alias="CS_WEBHOOK_BASE"
    )

    @property
    def bot_token(self) -> str:
        return self.cs_bot_token or self.telegram_bot_token

    # Comma-separated list of admin telegram_ids
    admin_user_ids_raw: str = Field("", alias="ADMIN_USER_IDS")

    @property
    def admin_user_ids(self) -> set[int]:
        return {int(x.strip()) for x in self.admin_user_ids_raw.split(",") if x.strip()}

    # Web Push (VAPID)
    vapid_public_key: str = Field("", alias="VAPID_PUBLIC_KEY")
    vapid_private_key: str = Field("", alias="VAPID_PRIVATE_KEY")
    vapid_subject: str = Field("mailto:admin@example.com", alias="VAPID_SUBJECT")

    # Pipeline
    event_score_threshold_review: int = Field(4, alias="EVENT_SCORE_REVIEW")
    event_score_threshold_auto: int = Field(6, alias="EVENT_SCORE_AUTO")
    default_poll_interval_minutes: int = Field(30, alias="DEFAULT_POLL_INTERVAL_MIN")
    poll_concurrency: int = Field(3, alias="POLL_CONCURRENCY")

    model_config = SettingsConfigDict(
        extra="allow",
        **(dict(env_file=ENV_FILE, env_file_encoding="utf-8") if ENV_FILE else {}),
    )
