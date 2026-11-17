"""Rate limit: Redis или память процесса."""
from __future__ import annotations

import time
from collections import defaultdict

from app.redis_client import get_redis

_hits: dict[str, list[float]] = defaultdict(list)


def allow(key: str, *, limit: int = 20, window_sec: int = 60) -> bool:
    r = get_redis()
    if r is not None:
        try:
            rk = f"rl:{key}"
            n = int(r.incr(rk))
            if n == 1:
                r.expire(rk, window_sec)
            return n <= limit
        except Exception:
            pass

    now = time.monotonic()
    q = _hits[key]
    _hits[key] = [t for t in q if now - t < window_sec]
    if len(_hits[key]) >= limit:
        return False
    _hits[key].append(now)
    return True
