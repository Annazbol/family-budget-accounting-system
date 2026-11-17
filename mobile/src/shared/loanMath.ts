export function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  const P = Number(principal)
  const n = Math.floor(Number(months))
  if (!(P > 0) || n < 1) return 0
  const r = Number(annualRatePct) / 100 / 12
  if (!Number.isFinite(r) || r <= 0) return round2(P / n)
  const q = Math.pow(1 + r, n)
  return round2((P * r * q) / (q - 1))
}

export function totalAnnuityCost(principal: number, annualRatePct: number, months: number): number {
  const n = Math.floor(Number(months))
  if (n < 1) return 0
  return round2(annuityPayment(principal, annualRatePct, n) * n)
}

export function remainingToPay(
  principal: number, annualRatePct: number, months: number, totalPaid: number,
): number {
  const total = totalAnnuityCost(principal, annualRatePct, months)
  const paid = Math.max(0, Number(totalPaid))
  return Math.max(0, round2(total - paid))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function pct(part: number, whole: number): number {
  return whole > 0 && Number.isFinite(part) ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0
}
