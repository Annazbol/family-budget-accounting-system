/** Пересчёт валют (база курсов — RUB, как на бэкенде / open.er-api). */

export type RatesTable = Record<string, number>

export interface RatesData {
  date: string
  rates: RatesTable
  history?: Record<string, RatesTable>
}

export function isRates(d: unknown): d is RatesData {
  const x = d as RatesData | null
  return !!x && typeof x === 'object' && typeof x.date === 'string' && !!x.rates && typeof x.rates === 'object'
}

/** n в валюте a → валюта b; rates: единиц валюты за 1 RUB. */
export function cv(n: number, a: string, b: string, r: RatesTable): number {
  const x = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(x)) return 0
  if (a === b) return x
  const ra = Number(r[a])
  const rb = Number(r[b])
  if (!(ra > 0) || !(rb > 0)) return x
  return (x / ra) * rb
}

/** Курсы на дату: ближайшая таблица ≤ date. */
export function ratesAt(d: string, data: RatesData): RatesTable {
  if (d >= data.date) return data.rates
  const hist = data.history || {}
  let best: string | null = null
  for (const k of Object.keys(hist)) {
    if (k <= d && (best === null || k > best)) best = k
  }
  if (best === null) {
    for (const k of Object.keys(hist)) {
      if (best === null || k < best) best = k
    }
  }
  return (best && hist[best]) || data.rates
}

export function canConv(data: RatesData | null, currency: string, c: string, date?: string): boolean {
  if (c === currency) return true
  if (!data) return false
  const r = date ? ratesAt(date, data) : data.rates
  return Number(r[c]) > 0 && Number(r[currency]) > 0
}
