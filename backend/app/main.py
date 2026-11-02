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
from app.routers import auth, collections, rates

from redis import Redis

redis_client = Redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Проверяем подключение к Redis при запуске
    redis_client.ping()
    app.state.redis = redis_client

    yield

    # Закрываем подключение при остановке
    redis_client.close()

settings = get_settings()

app = FastAPI(title="Family Budget API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(collections.router)
app.include_router(rates.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "db": check_connection()}
