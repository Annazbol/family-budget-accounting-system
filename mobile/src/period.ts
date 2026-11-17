import { useMemo, useState } from 'react'
import { daysAgo, iso, today } from './shared/dates'

export type Per = 'week' | 'month' | 'year' | 'all' | 'custom'
export interface Rng { a: string; b: string }

const clamp = (s: string) => (s < '2000-01-01' ? '2000-01-01' : s > '2100-12-31' ? '2100-12-31' : s)

/** Понедельник–воскресенье текущей недели (локальная TZ). */
export function range(p: Per, cr: Rng): [string, string] {
  const n = new Date()
  const y = n.getFullYear()
  const m = n.getMonth()
  const d = n.getDate()
  if (p === 'all') return ['0000-01-01', '9999-12-31']
  if (p === 'custom') return [clamp(cr.a), clamp(cr.b)]
  if (p === 'week') {
    const w = (n.getDay() + 6) % 7
    return [iso(new Date(y, m, d - w)), iso(new Date(y, m, d - w + 6))]
  }
  if (p === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
  return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))]
}

export function usePeriod(defaultPer: Per = 'month') {
  const [per, setPer] = useState<Per>(defaultPer)
  const [cr, setCr] = useState<Rng>({ a: daysAgo(30), b: today() })
  // стабильная ссылка — иначе useEffect/useCallback дергают API на каждый рендер
  const rng = useMemo(() => range(per, cr), [per, cr.a, cr.b])
  return { per, setPer, cr, setCr, rng }
}

export function periodQuery([a, b]: [string, string]): string {
  const q = new URLSearchParams()
  if (a > '0000-01-01') q.set('date_from', a)
  if (b < '9999-12-31') q.set('date_to', b)
  const str = q.toString()
  return str ? `?${str}` : ''
}

export const PERIOD_OPTS: { value: Per; label: string }[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
  { value: 'all', label: 'Всё время' },
  { value: 'custom', label: 'Свой период' },
]
