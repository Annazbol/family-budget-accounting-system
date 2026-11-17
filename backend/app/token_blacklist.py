"""Отзыв JWT: Redis или память процесса."""
from __future__ import annotations

import time
from typing import Dict

from app.redis_client import get_redis

_revoked: Dict[str, float] = {}


def revoke(jti: str, exp_ts: float) -> None:
    if not jti:
        return
    ttl = max(1, int(exp_ts - time.time()))
    r = get_redis()
    if r is not None:
        try:
            r.setex(f"jwt:revoked:{jti}", ttl, "1")
            return
        except Exception:
            pass
    _revoked[jti] = exp_ts
    _purge()


def is_revoked(jti: str) -> bool:
    if not jti:
        return False
    r = get_redis()
    if r is not None:
        try:
            return bool(r.exists(f"jwt:revoked:{jti}"))
        except Exception:
            pass
    exp = _revoked.get(jti)
    if exp is None:
        return False
    if time.time() > exp:
        _revoked.pop(jti, None)
        return False
    return True


def _purge() -> None:
    now = time.time()
    for k in [k for k, exp in _revoked.items() if exp <= now]:
        _revoked.pop(k, None)
