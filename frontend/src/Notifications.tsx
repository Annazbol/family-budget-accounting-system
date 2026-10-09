import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import { useRates } from './rates'
import { Debt, Goal, Loan, TabId } from './types'

export interface Notice {
  id: string // включает дату: при смене срока/нового месяца уведомление снова становится новым
  tab: TabId // куда перейти
  hl: string // какой объект подсветить (data-hl в списке)
  title: string
  text: string
  amount: number // в валюте бюджета, по текущему курсу
  date: string
}

const iso = (d: Date) => d.toLocaleDateString('sv')
const today = () => iso(new Date())
const nextPay = (day: number) => {
  const n = new Date(), mk = (k: number) => new Date(n.getFullYear(), n.getMonth() + k, Math.min(day, 28))
  let d = mk(0)
  if (iso(d) < today()) d = mk(1)
  return iso(d)
}

/** Ближайшие платежи и сроки (14 дней и просроченные). dep — любое значение: при его смене данные перезагружаются. */
export function useNotices(dep: unknown): Notice[] {
  const { t } = useI18n()
  const { nowV } = useRates()
  const [raw, setRaw] = useState<{ debts: Debt[]; loans: Loan[]; goals: Goal[] }>({ debts: [], loans: [], goals: [] })
  useEffect(() => {
    Promise.all([api<Debt[]>('/debts'), api<Loan[]>('/loans'), api<Goal[]>('/goals')])
      .then(([debts, loans, goals]) => setRaw({ debts, loans, goals })).catch(() => { /* без сети уведомлений нет */ })
  }, [dep])

  return useMemo(() => {
    const lim = new Date(); lim.setDate(lim.getDate() + 14)
    const all: Notice[] = [
      ...raw.debts.map((d): Notice => ({ id: `debts:${d.id}:${d.due}`, tab: 'debts', hl: `debts:${d.id}`,
        title: d.direction === 'owe' ? t('repayDebt') : t('owedToYou'), text: d.note, amount: nowV(d.amount, d.currency), date: d.due })),
      ...raw.loans.filter((l) => l.current > 0).map((l): Notice => {
        const dt = nextPay(l.day)
        return { id: `loans:${l.id}:${dt}`, tab: 'loans', hl: `loans:${l.id}`, title: t('loanPayment'), text: l.name, amount: nowV(l.payment, l.currency), date: dt }
      }),
      ...raw.goals.filter((g) => g.saved < g.target).map((g): Notice => ({ id: `goals:${g.id}:${g.due}`, tab: 'goals', hl: `goals:${g.id}`,
        title: t('goalDeadline'), text: g.name, amount: nowV(g.target - g.saved, g.currency), date: g.due })),
    ]
    return all.filter((n) => n.date <= iso(lim)).sort((a, b) => a.date.localeCompare(b.date))
  }, [raw, nowV, t])
}

const RK = 'fb.read'
export const loadRead = (): string[] => { try { return JSON.parse(localStorage.getItem(RK) || '[]') } catch { return [] } }
export const saveRead = (ids: string[]) => { try { localStorage.setItem(RK, JSON.stringify(ids)) } catch { /* ignore */ } }

export function NotificationsSheet(props: {
  items: Notice[]
  isNew: (id: string) => boolean
  onGo: (n: Notice) => void
  onClose: () => void
}) {
  const { items, isNew, onGo, onClose } = props
  const { t, money, date } = useI18n()
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div className="bd" onClick={onClose} />
      <aside className="drawer right" role="dialog" aria-modal="true" aria-label={t('notifications')}>
        <div className="hd"><h2>{t('notifications')}</h2><button className="gh" autoFocus onClick={onClose}>{t('close')}</button></div>
        {items.length === 0 && <p className="mut">{t('noNotif')}</p>}
        {items.map((n) => (
          <button key={n.id} className={'li nt' + (isNew(n.id) ? ' new' : '')} onClick={() => onGo(n)}>
            <span className="grow">
              <b>{n.title}</b>{isNew(n.id) && <span className="dot" role="img" aria-label={t('newItem')} />}
              <span className="mut blk">{n.text}</span>
            </span>
            <span><b>{money(n.amount)}</b><span className="mut blk">{n.date < today() ? t('overdue') + ' · ' : ''}{date(n.date)}</span></span>
          </button>
        ))}
      </aside>
    </>
  )
}
