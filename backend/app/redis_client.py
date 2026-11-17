"""
Redis / Memurai.

REDIS_URL=redis://localhost:6379/0

Если URL пустой или Redis недоступен — возвращается None (fallback в памяти).
"""
from __future__ import annotations

import logging
from typing import Optional

from redis import Redis
from redis.exceptions import RedisError

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[Redis] = None


def get_redis() -> Optional[Redis]:
    global _client
    settings = get_settings()
    url = (getattr(settings, "redis_url", None) or "").strip()
    if not url:
        return None
    if _client is not None:
        return _client
    try:
        client = Redis.from_url(url, decode_responses=True, socket_connect_timeout=1.5)
        client.ping()
        _client = client
        logger.info("Redis connected")
        return _client
    except Exception as e:
        logger.warning("Redis unavailable: %s — in-memory fallback", e)
        _client = None
        return None


def redis_ok() -> bool:
    r = get_redis()
    if r is None:
        return False
    try:
        return bool(r.ping())
    except RedisError:
        return False
