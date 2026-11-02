"""Аннуитетный расчёт (как frontend shared/loanMath.ts)."""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


def _f(x: Decimal | float | int) -> float:
    return float(x)


def _round2(n: float) -> float:
    return float(Decimal(str(n)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def annuity_payment(principal: float, annual_rate_pct: float, months: int) -> float:
    p = float(principal)
    n = int(months)
    if p <= 0 or n < 1:
        return 0.0
    r = float(annual_rate_pct) / 100.0 / 12.0
    if r <= 0:
        return _round2(p / n)
    q = (1 + r) ** n
    return _round2(p * r * q / (q - 1))


def remaining_principal(
    principal: float, annual_rate_pct: float, months: int, total_paid: float
) -> float:
    balance = float(principal)
    paid_left = max(0.0, float(total_paid))
    n = int(months)
    if balance <= 0 or n < 1:
        return 0.0
    if paid_left <= 0:
        return _round2(balance)

    a = annuity_payment(balance, annual_rate_pct, n)
    r = float(annual_rate_pct) / 100.0 / 12.0

    for _ in range(n):
        if balance <= 0.005 or paid_left <= 0.005:
            break
        interest = balance * r if r > 0 else 0.0
        max_pay = min(a, balance + interest)
        pay = min(paid_left, max_pay)
        to_principal = max(0.0, pay - interest)
        balance = max(0.0, balance - to_principal)
        paid_left -= pay
    return _round2(balance)


def total_annuity_cost(principal: float, annual_rate_pct: float, months: int) -> float:
    n = int(months)
    if n < 1:
        return 0.0
    return _round2(annuity_payment(principal, annual_rate_pct, n) * n)


def remaining_to_pay(
    principal: float, annual_rate_pct: float, months: int, total_paid: float
) -> float:
    total = total_annuity_cost(principal, annual_rate_pct, months)
    paid = max(0.0, float(total_paid))
    by_schedule = max(0.0, _round2(total - paid))
    body = remaining_principal(principal, annual_rate_pct, months, paid)
    return max(by_schedule, body)
