import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import { Operation, RatesData } from './types'

// Источник курсов: свой API по VITE_RATES_URL или встроенный /api/rates (демо, см. backend/app/rates.py).
const EXT = import.meta.env.VITE_RATES_URL as string | undefined

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
  failed: boolean
  nowV: (n: number, c: string) => number // сумма в валюте бюджета по текущему курсу
  hisV: (n: number, c: string, date: string) => number // … по курсу на дату
  opH: (o: Operation) => number // операция по курсу на дату проведения
  opN: (o: Operation) => number // операция по текущему курсу
  opM: (o: Operation) => number // операция по выбранному в профиле способу
}
const C = createContext<Ctx | null>(null)
export function useRates() {
  const c = useContext(C)
  if (!c) throw new Error('RatesProvider is missing')
  return c
}

export function RatesProvider({ children }: { children: ReactNode }) {
  const { currency, calc } = useI18n()
  const [data, setData] = useState<RatesData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const load = () => {
      const req: Promise<RatesData> = EXT ? fetch(EXT).then((r) => r.json() as Promise<RatesData>) : api<RatesData>('/rates')
      req.then((d) => { setData(d); setFailed(false) }).catch(() => setFailed(true))
    }
    load()
    const iv = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const value = useMemo<Ctx>(() => {
    const nowV = (n: number, c: string) => (data ? cv(n, c, currency, data.rates) : n)
    const hisV = (n: number, c: string, d: string) => (data ? cv(n, c, currency, ratesAt(d, data)) : n)
    const opH = (o: Operation) => hisV(o.amount, o.currency, o.date)
    const opN = (o: Operation) => nowV(o.amount, o.currency)
    return { data, failed, nowV, hisV, opH, opN, opM: calc === 'now' ? opN : opH }
  }, [data, failed, currency, calc])
  return <C.Provider value={value}>{children}</C.Provider>
}
