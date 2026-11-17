import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { useTheme } from './ThemeContext'
import {
  RatesData, canConv as canConvFn, cv, isRates, ratesAt,
} from './rates'

/** Запасные курсы (база RUB), если API недоступен — как на бэкенде. */
const FALLBACK: RatesData = {
  date: new Date().toISOString().slice(0, 10),
  rates: {
    RUB: 1,
    USD: 0.012267,
    EUR: 0.010939,
    KZT: 5.49264,
    BYN: 0.036337,
  },
  history: {},
}

type MoneyLike = { amount: number | string; currency: string; date?: string }

type Ctx = {
  data: RatesData | null
  failed: boolean
  retry: () => void
  toBudget: (n: number, currency: string, date?: string) => number
  canConv: (c: string, date?: string) => boolean
  opM: (o: MoneyLike) => number
  canOp: (o: MoneyLike) => boolean
  budgetCurrency: string
}

const RatesContext = createContext<Ctx | null>(null)

export function RatesProvider({ children }: { children: ReactNode }) {
  const { settings } = useTheme()
  const currency = settings.currency
  const calc = settings.calc
  const [data, setData] = useState<RatesData | null>(FALLBACK)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    api<unknown>('/rates')
      .then((d) => {
        if (!isRates(d)) {
          console.error('[rates] bad payload', d)
          throw new Error('bad rates')
        }
        setData({ ...d, history: d.history ?? {} })
        setFailed(false)
      })
      .catch((e) => {
        console.error('[rates] load failed', e)
        setFailed(true)
        // оставляем FALLBACK или прошлые данные — пересчёт не ломается
        setData((prev) => prev ?? FALLBACK)
      })
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(iv)
  }, [load])

  const value = useMemo<Ctx>(() => {
    const table = data ?? FALLBACK
    const toBudget = (n: number, c: string, date?: string) => {
      const rates = date ? ratesAt(date, table) : table.rates
      return cv(Number(n), c, currency, rates)
    }
    const canConv = (c: string, date?: string) => canConvFn(table, currency, c, date)
    const opH = (o: MoneyLike) => toBudget(Number(o.amount), o.currency, o.date)
    const opN = (o: MoneyLike) => toBudget(Number(o.amount), o.currency)
    const opM = calc === 'now' ? opN : opH
    const canOp = (o: MoneyLike) =>
      calc === 'now' ? canConv(o.currency) : canConv(o.currency, o.date)
    return {
      data: table,
      failed,
      retry: load,
      toBudget,
      canConv,
      opM,
      canOp,
      budgetCurrency: currency,
    }
  }, [data, failed, currency, calc, load])

  return <RatesContext.Provider value={value}>{children}</RatesContext.Provider>
}

export function useRates(): Ctx {
  const c = useContext(RatesContext)
  if (!c) {
    return {
      data: FALLBACK,
      failed: true,
      retry: () => {},
      toBudget: (n) => Number(n) || 0,
      canConv: () => true,
      opM: (o) => Number(o.amount) || 0,
      canOp: () => true,
      budgetCurrency: 'RUB',
    }
  }
  return c
}
