"""
GET /rates — курсы валют (формат RatesData как у фронта).

Данные с внешнего API (RATES_URL), кэш на сервере ~30 мин.
Фронт дополнительно обновляет у себя раз в 30 мин (rates.tsx).
"""
from typing import Any

from fastapi import APIRouter, Query

from app.rates_service import get_rates_data

router = APIRouter(tags=["rates"])


@router.get("/rates")
def get_rates(refresh: bool = Query(False, description="Обойти кэш и запросить провайдера")) -> dict[str, Any]:
    """Публичный эндпоинт (без auth)."""
    return get_rates_data(force=refresh)
