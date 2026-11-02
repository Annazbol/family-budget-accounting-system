"""
Загрузка курсов с внешнего API + кэш в памяти.

Источник: https://open.er-api.com/v6/latest/RUB  (база уже RUB).
Формат для фронта:
  {
    "date": "YYYY-MM-DD",
    "rates": { "RUB": 1, "USD": 0.012, ... },  # единиц валюты за 1 RUB
    "history": { ... }
  }
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

NEEDED = ("USD", "EUR", "RUB", "KZT", "BYN")

# Запасной набор в базе RUB
_FALLBACK = {
    "RUB": 1.0,
    "USD": 0.012267,
    "EUR": 0.010939,
    "KZT": 5.49264,
    "BYN": 0.036337,
}

_lock = threading.Lock()
_cache: Optional[dict[str, Any]] = None
_cache_at: float = 0.0
_history: dict[str, dict[str, float]] = {}


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _pick_rates(raw: dict[str, Any]) -> dict[str, float]:
    """Курсы из ответа провайдера (база RUB — без пересчёта)."""
    table = raw.get("rates") or raw.get("conversion_rates") or {}
    out: dict[str, float] = {}
    for code in NEEDED:
        v = table.get(code)
        if v is None:
            out[code] = _FALLBACK[code]
            logger.warning("rates: missing %s, using fallback", code)
            continue
        try:
            n = float(v)
            if n <= 0:
                out[code] = _FALLBACK[code]
            else:
                out[code] = round(n, 8)
        except (TypeError, ValueError):
            out[code] = _FALLBACK[code]
    out["RUB"] = 1.0
    return out


def _fetch_remote() -> dict[str, float]:
    settings = get_settings()
    url = settings.rates_url
    with httpx.Client(timeout=15.0) as client:
        r = client.get(url)
        r.raise_for_status()
        data = r.json()
    if not isinstance(data, dict):
        raise ValueError("rates provider returned non-object")
    if data.get("result") not in (None, "success"):
        raise ValueError(f"rates provider error: {data.get('result')}")
    base = (data.get("base_code") or data.get("base") or "").upper()
    if base and base != "RUB":
        logger.warning("rates: expected base RUB, got %s — using rates as-is", base)
    return _pick_rates(data)


def _build_history(current: dict[str, float], day: str) -> dict[str, dict[str, float]]:
    _history[day] = dict(current)
    if len(_history) > 400:
        for k in sorted(_history.keys())[:-366]:
            _history.pop(k, None)

    out: dict[str, dict[str, float]] = {}
    start = date.fromisoformat(day) - timedelta(days=90)
    end = date.fromisoformat(day)
    d = start
    while d <= end:
        key = d.isoformat()
        out[key] = dict(_history.get(key) or current)
        d += timedelta(days=1)
    for k, v in _history.items():
        if k not in out:
            out[k] = dict(v)
    return out


def get_rates_data(*, force: bool = False) -> dict[str, Any]:
    """Актуальные курсы (база RUB) с серверным кэшем."""
    global _cache, _cache_at

    settings = get_settings()
    ttl = max(60, int(settings.rates_cache_seconds))

    with _lock:
        now = time.monotonic()
        if not force and _cache is not None and (now - _cache_at) < ttl:
            return _cache

        try:
            rates = _fetch_remote()
            day = _today()
            payload = {
                "date": day,
                "rates": rates,
                "history": _build_history(rates, day),
            }
            _cache = payload
            _cache_at = now
            logger.info("rates: updated from provider (RUB), date=%s", day)
            return payload
        except Exception as e:
            logger.warning("rates: fetch failed: %s", e)
            if _cache is not None:
                return _cache
            day = _today()
            rates = dict(_FALLBACK)
            payload = {
                "date": day,
                "rates": rates,
                "history": _build_history(rates, day),
            }
            _cache = payload
            _cache_at = now
            return payload
