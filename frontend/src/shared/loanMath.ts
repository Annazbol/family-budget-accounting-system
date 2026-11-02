/**
 * Аннуитетный кредит.
 * r — месячная ставка = годовая% / 100 / 12
 * Платёж: A = P × r(1+r)^n / ((1+r)^n − 1); при r = 0 → P / n
 */

export function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  const P = Number(principal)
  const n = Math.floor(Number(months))
  if (!(P > 0) || n < 1) return 0
  const r = Number(annualRatePct) / 100 / 12
  if (!Number.isFinite(r) || r <= 0) return round2(P / n)
  const q = Math.pow(1 + r, n)
  return round2((P * r * q) / (q - 1))
}

/** Полная сумма выплат за весь срок (без досрочек). */
export function totalAnnuityCost(principal: number, annualRatePct: number, months: number): number {
  const n = Math.floor(Number(months))
  if (n < 1) return 0
  return round2(annuityPayment(principal, annualRatePct, n) * n)
}

/**
 * Остаток тела долга после того, как внесено totalPaid (руб/валюта),
 * с помесячной амортизацией: сначала проценты, затем тело.
 */
export function remainingPrincipal(
  principal: number,
  annualRatePct: number,
  months: number,
  totalPaid: number,
): number {
  let balance = Number(principal)
  let paidLeft = Math.max(0, Number(totalPaid))
  const n = Math.floor(Number(months))
  if (!(balance > 0) || n < 1) return 0
  if (!(paidLeft > 0)) return round2(balance)

  const A = annuityPayment(balance, annualRatePct, n)
  const r = Number(annualRatePct) / 100 / 12

  for (let i = 0; i < n && balance > 0.005 && paidLeft > 0.005; i++) {
    const interest = r > 0 ? balance * r : 0
    const maxPay = Math.min(A, balance + interest)
    const pay = Math.min(paidLeft, maxPay)
    const toPrincipal = Math.max(0, pay - interest)
    balance = Math.max(0, balance - toPrincipal)
    paidLeft -= pay
  }
  return round2(balance)
}

/** Остаток к выплате ≈ полный долг − уже внесено (не ниже остатка тела). */
export function remainingToPay(
  principal: number,
  annualRatePct: number,
  months: number,
  totalPaid: number,
): number {
  const total = totalAnnuityCost(principal, annualRatePct, months)
  const paid = Math.max(0, Number(totalPaid))
  const bySchedule = Math.max(0, round2(total - paid))
  const body = remainingPrincipal(principal, annualRatePct, months, paid)
  // не меньше оставшегося тела (если платили меньше графика по %)
  return Math.max(bySchedule, body)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
