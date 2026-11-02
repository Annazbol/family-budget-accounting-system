"""Настройки бэкенда из переменных окружения."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # development | production
    app_env: str = "development"

    database_url: str = "postgresql+psycopg://budget:budget@localhost:5432/budget"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me-in-production"
    jwt_expire_minutes: int = 60 * 24 * 7

    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    rates_url: str = "https://open.er-api.com/v6/latest/RUB"
    rates_cache_seconds: int = 30 * 60

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@family-budget.local"
    smtp_tls: bool = True
    # true только для локальной отладки; в production игнорируется
    auth_dev_return_code: bool = False
    verify_code_ttl_minutes: int = 15

    cookie_name: str = "fb_token"
    cookie_secure: bool = False  # true за HTTPS

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"

    @property
    def allow_dev_code(self) -> bool:
        """Код в JSON/логе для регистрации — только не-production и явный флаг."""
        return (not self.is_production) and self.auth_dev_return_code

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
