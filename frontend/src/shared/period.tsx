import { useState } from 'react'
import { useI18n } from '../i18n'
import { daysAgo, iso, today } from './dates'

// Выбор периода: выпадающий список + произвольный интервал («Свой период»).
export type Per = 'week' | 'month' | 'year' | 'all' | 'custom'
export interface Rng { a: string; b: string }
const clamp = (s: string) => (s < '2000-01-01' ? '2000-01-01' : s > '2100-12-31' ? '2100-12-31' : s)

export function range(p: Per, cr: Rng): [string, string] {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate()
  if (p === 'all') return ['0000-01-01', '9999-12-31']
  if (p === 'custom') return [clamp(cr.a), clamp(cr.b)]
  if (p === 'week') { const w = (n.getDay() + 6) % 7; return [iso(new Date(y, m, d - w)), iso(new Date(y, m, d - w + 6))] }
  if (p === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
  return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))]
}

export function usePeriod() {
  const [per, setPer] = useState<Per>('month')
  const [cr, setCr] = useState<Rng>({ a: daysAgo(30), b: today() })
  return { per, setPer, cr, setCr, rng: range(per, cr) }
}

export function PeriodPicker({ p, all }: { p: ReturnType<typeof usePeriod>; all?: boolean }) {
  const { t } = useI18n()
  const opts: [Per, string][] = [['week', t('week')], ['month', t('month')], ['year', t('year')], ...(all ? [['all', t('allTime')] as [Per, string]] : []), ['custom', t('customPeriod')]]
  const { cr, setCr } = p
  return (
    <>
      <select className="flt" aria-label={t('period')} value={p.per} onChange={(e) => p.setPer(e.target.value as Per)}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {p.per === 'custom' && (
        <div className="two rg">
          <label>{t('from')}
            <input type="date" value={cr.a} max={cr.b} onChange={(e) => e.target.value && setCr({ a: e.target.value, b: cr.b < e.target.value ? e.target.value : cr.b })} />
          </label>
          <label>{t('to')}
            <input type="date" value={cr.b} min={cr.a} onChange={(e) => e.target.value && setCr({ a: cr.a > e.target.value ? e.target.value : cr.a, b: e.target.value })} />
          </label>
        </div>
      )}
    </>
  )
}

/** Строка запроса для периода: «?date_from=…&date_to=…» (для «всё время» пустая), для /operations и /operations/totals. */
export function periodQuery([a, b]: [string, string]): string {
  const q = new URLSearchParams()
  if (a > '0000-01-01') q.set('date_from', a)
  if (b < '9999-12-31') q.set('date_to', b)
  const str = q.toString()
  return str ? '?' + str : ''
}
