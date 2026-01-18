from __future__ import annotations

import re
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_TELEGRAM_CHANNEL_IDS = "\n".join(
    [
        "@afishadaily",
        "@concerts_moscow",
        "@napervom",
        "@mskgigs",
        "@northerntechno",
        "@dancewithus",
        "@free_concerts",
        "@chirik_chiric",
        "@blankclub",
        "@maingig",
        "@spb_conc",
        "@Vspiskah",
        "@kastry_fest",
        "@svobodaconcerthall",
        "@voicemedia",
        "@rndmtoday",
        "@mskevents_ru",
        "@spbgigs",
        "@rupor_msk",
        "@spbeventsru",
        "@digest_msk",
        "@afishakontramarka",
        "@est_prohodka",
        "@kyivconcert",
        "@saint_afisha",
        "@produsserka",
        "@rupor_events_spb",
        "@afisha_36",
        "@mainfest",
        "@metalafisha",
        "@rock63ru",
        "@rupor_ekb",
        "@rassvetperm",
        "@JazzClub32",
        "@filarmonia_odessa",
    ]
)


class Settings(BaseSettings):
    telegram_api_id: int = Field(..., alias="TELEGRAM_API_ID")
    telegram_api_hash: str = Field(..., alias="TELEGRAM_API_HASH")
    telegram_bot_token: str | None = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    telegram_login_mode: str = Field("bot", alias="TELEGRAM_LOGIN_MODE")  # bot | user
    telegram_session_string: str | None = Field(default=None, alias="TELEGRAM_SESSION_STRING")
    telegram_channel_ids_raw: str = Field(DEFAULT_TELEGRAM_CHANNEL_IDS, alias="TELEGRAM_CHANNEL_IDS")
    telegram_polling_enabled: bool = Field(False, alias="TELEGRAM_POLLING_ENABLED")

    redis_url: str = Field(..., alias="REDIS_URL")
    postgres_dsn: str | None = Field(default=None, alias="POSTGRES_DSN")

    bot_polling_interval: int = Field(2, alias="BOT_POLLING_INTERVAL")
    app_host: str = Field("0.0.0.0", alias="APP_HOST")
    app_port: int = Field(8000, alias="APP_PORT")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    @property
    def telegram_channel_ids(self) -> list[str]:
        parts = [p.strip() for p in re.split(r"[\s,]+", self.telegram_channel_ids_raw) if p.strip()]
        seen: set[str] = set()
        out: list[str] = []
        for p in parts:
            if p not in seen:
                seen.add(p)
                out.append(p)
        return out

