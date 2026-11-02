"""Простой rate limit в памяти процесса (без Redis). Сбрасывается при рестарте."""
from __future__ import annotations

import time
from collections import defaultdict

_hits: dict[str, list[float]] = defaultdict(list)


def allow(key: str, *, limit: int = 20, window_sec: int = 60) -> bool:
    now = time.monotonic()
    q = _hits[key]
    _hits[key] = [t for t in q if now - t < window_sec]
    if len(_hits[key]) >= limit:
        return False
    _hits[key].append(now)
    return True
