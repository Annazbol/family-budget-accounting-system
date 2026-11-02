"""Отзыв JWT при logout (в памяти процесса, без Redis)."""
from __future__ import annotations

import time
from typing import Dict

# jti -> unix exp
_revoked: Dict[str, float] = {}


def revoke(jti: str, exp_ts: float) -> None:
    if not jti:
        return
    _revoked[jti] = exp_ts
    _purge()


def is_revoked(jti: str) -> bool:
    if not jti:
        return False
    exp = _revoked.get(jti)
    if exp is None:
        return False
    if time.time() > exp:
        _revoked.pop(jti, None)
        return False
    return True


def _purge() -> None:
    now = time.time()
    dead = [k for k, exp in _revoked.items() if exp <= now]
    for k in dead:
        _revoked.pop(k, None)
