from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Obvious placeholder so it is recognisable in a diff or a config dump.
DEV_SECRET_KEY = "dev-only-insecure-secret-change-me"

# app/core/config.py -> app/core -> app -> backend -> repository root
REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Application settings, loaded from the repository-root .env file."""

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    project_name: str = "Mentework API"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://mentework:mentework@localhost:5433/mentework"
    # Comma-separated so it can be set from a plain shell environment variable.
    cors_origins: str = "http://localhost:3000"

    # --- Authentication ---
    secret_key: str = DEV_SECRET_KEY
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12

    @model_validator(mode="after")
    def refuse_the_placeholder_secret_outside_development(self) -> "Settings":
        """Fail at startup rather than sign tokens anyone could forge."""
        if self.environment != "development" and self.secret_key == DEV_SECRET_KEY:
            raise ValueError(
                "SECRET_KEY is still the development placeholder. "
                "Set a real one, e.g. `openssl rand -hex 32`."
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()
