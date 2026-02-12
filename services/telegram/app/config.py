from __future__ import annotations

from pathlib import Path
from typing import Union

from pydantic import Field, field_validator
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
    telegram_api_id: int = Field(..., alias="TELEGRAM_API_ID")
    telegram_api_hash: str = Field(..., alias="TELEGRAM_API_HASH")
    telegram_bot_token: str | None = Field(default=None, alias="TELEGRAM_BOT_TOKEN")
    telegram_login_mode: str = Field("bot", alias="TELEGRAM_LOGIN_MODE")
    telegram_session_string: str | None = Field(default=None, alias="TELEGRAM_SESSION_STRING")
    media_root: Path | str = Field(
        default_factory=lambda: Path(__file__).resolve().parents[1] / "media",
        alias="MEDIA_ROOT",
    )

    @field_validator("media_root", mode="before")
    @classmethod
    def media_root_path(cls, v: Union[str, Path, None]) -> Path:
        if v is None:
            return Path(__file__).resolve().parents[1] / "media"
        return Path(v) if isinstance(v, str) else v

    model_config = SettingsConfigDict(
        extra="allow",
        **(dict(env_file=ENV_FILE, env_file_encoding="utf-8") if ENV_FILE else {}),
    )
