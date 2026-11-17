"""
Family Budget API — полный контракт для фронта.

Запуск:
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Фронт: VITE_API=http  VITE_API_BASE=http://localhost:8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import check_connection
from app.redis_client import redis_ok
from app.routers import auth, collections, rates

settings = get_settings()

app = FastAPI(title="Family Budget API", version="0.2.0")

# В dev разрешаем любой Origin (мобилка / Expo / телефон).
# С allow_origins=["*"] нельзя allow_credentials=True — иначе preflight бывает 400.
if settings.is_production:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router)
app.include_router(collections.router)
app.include_router(rates.router)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "db": check_connection(),
        "redis": redis_ok(),
    }
