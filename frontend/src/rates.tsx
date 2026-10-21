import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import { Money, RatesData } from './types'

// Источник курсов: свой API по VITE_RATES_URL или GET /rates через api.ts (в моке — демо-данные). Формат — docs/API.md.
const EXT = import.meta.env.VITE_RATES_URL as string | undefined
const CACHE = 'fb.rates'

const isRates = (d: unknown): d is RatesData => {
  const x = d as RatesData | null
  return !!x && typeof x === 'object' && typeof x.date === 'string' && !!x.rates && typeof x.rates === 'object'
}
// Последние успешно загруженные курсы хранятся на устройстве: если обновить не удалось, пересчёт идёт по ним.
function readCache(): RatesData | null {
  try {
    const d = JSON.parse(localStorage.getItem(CACHE) || 'null')
    return isRates(d) ? { ...d, history: d.history ?? {} } : null
  } catch { return null }
}
const writeCache = (d: RatesData) => { try { localStorage.setItem(CACHE, JSON.stringify(d)) } catch { /* ignore */ } }

const cv = (n: number, a: string, b: string, r: Record<string, number>) => (a === b || !r[a] || !r[b] ? n : (n / r[a]) * r[b])

/** Курсы на дату: ближайшая таблица не позже этой даты (для самых старых дат — самая ранняя). */
function ratesAt(d: string, x: RatesData) {
  if (d >= x.date) return x.rates
  let best: string | null = null
  for (const k in x.history) if (k <= d && (best === null || k > best)) best = k
  if (best === null) for (const k in x.history) if (best === null || k < best) best = k
  return (best && x.history[best]) || x.rates
}

interface Ctx {
  data: RatesData | null
  failed: boolean // последнее обновление курсов не удалось
  retry: () => void
  canConv: (c: string, date?: string) => boolean // можно ли пересчитать валюту в валюту бюджета (по курсу на дату или текущему)
  nowV: (n: number, c: string) => number // сумма в валюте бюджета по текущему курсу
  hisV: (n: number, c: string, date: string) => number // … по курсу на дату
  opH: (o: Money) => number // по курсу на дату проведения
  opN: (o: Money) => number // по текущему курсу
  opM: (o: Money) => number // по выбранному в профиле способу
  canOp: (o: Money) => boolean // можно ли пересчитать операцию выбранным способом
}
const C = createContext<Ctx | null>(null)
export function useRates() {
  const c = useContext(C)
  if (!c) throw new Error('RatesProvider is missing')
  return c
}

export function RatesProvider({ children }: { children: ReactNode }) {
  const { currency, calc } = useI18n()
  const [data, setData] = useState<RatesData | null>(readCache)
  const [failed, setFailed] = useState(false)

  const load = () => {
    const req: Promise<unknown> = EXT ? fetch(EXT).then((r) => r.json()) : api<unknown>('/rates')
    req.then((d) => {
      if (!isRates(d)) throw new Error('bad rates')
      const x = { ...d, history: d.history ?? {} }
      setData(x); setFailed(false); writeCache(x)
    }).catch(() => setFailed(true))
  }
  useEffect(() => {
    load()
    const iv = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const value = useMemo<Ctx>(() => {
    const conv = (n: number, c: string, date?: string) => (data ? cv(n, c, currency, date ? ratesAt(date, data) : data.rates) : n)
    const canConv = (c: string, date?: string) => {
      if (c === currency) return true
      if (!data) return false
      const r = date ? ratesAt(date, data) : data.rates
      return !!r[c] && !!r[currency]
    }
    const nowV = (n: number, c: string) => conv(n, c)
    const hisV = (n: number, c: string, d: string) => conv(n, c, d)
    const opH = (o: Money) => hisV(o.amount, o.currency, o.date)
    const opN = (o: Money) => nowV(o.amount, o.currency)
    const canOp = (o: Money) => (calc === 'now' ? canConv(o.currency) : canConv(o.currency, o.date))
    return { data, failed, retry: load, canConv, nowV, hisV, opH, opN, opM: calc === 'now' ? opN : opH, canOp }
  }, [data, failed, currency, calc])
  return <C.Provider value={value}>{children}</C.Provider>
}
