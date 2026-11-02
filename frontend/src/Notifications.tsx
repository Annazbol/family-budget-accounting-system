import { useEffect, useMemo } from 'react'
import { useCollection } from './data'
import { useI18n } from './i18n'
import { useRates } from './rates'
import { Warn } from './RatesBanner'
import { remainingToPay } from './shared/loanMath'
import { Debt, Goal, Loan, TabId } from './types'

export interface Notice {
  id: string // включает дату: при смене срока/нового месяца уведомление снова становится новым
  tab: TabId // куда перейти
  hl: string // какой объект подсветить (data-hl в списке)
  title: string
  text: string
  amount: number // в валюте бюджета, по текущему курсу
  warn: boolean // сумму не удалось пересчитать (нет курса)
  date: string
}

const iso = (d: Date) => d.toLocaleDateString('sv')
const today = () => iso(new Date())
const loanEnd = (start: string, months: number) => {
  const d = new Date(start + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return start
  d.setMonth(d.getMonth() + Math.max(0, Math.floor(Number(months) || 0)))
  return iso(d)
}

/**
 * Ближайшие платежи и сроки (14 дней и просроченные). Данные берутся из общего хранилища, поэтому после любого
 * изменения долга, кредита или цели список обновляется сам, а лишних запросов при смене вкладок нет.
 */
export function useNotices(): Notice[] {
  const { t } = useI18n()
  const { nowV, canConv } = useRates()
  const debts = useCollection<Debt>('/debts').data
  const loans = useCollection<Loan>('/loans').data
  const goals = useCollection<Goal>('/goals').data

  return useMemo(() => {
    const lim = new Date(); lim.setDate(lim.getDate() + 14)
    const all: Notice[] = [
      ...debts.map((d): Notice => ({ id: `debts:${d.id}:${d.due}`, tab: 'debts', hl: `debts:${d.id}`,
        title: d.direction === 'owe' ? t('repayDebt') : t('owedToYou'), text: d.note, amount: nowV(d.amount, d.currency), warn: !canConv(d.currency), date: d.due })),
      ...loans.map((l): Notice => {
        const dt = loanEnd(l.start_date, l.term_months)
        const rest = remainingToPay(Number(l.amount), Number(l.rate), Number(l.term_months), Number(l.paid))
        return { id: `loans:${l.id}:${dt}`, tab: 'loans', hl: `loans:${l.id}`, title: t('loanPayment'), text: l.name,
          amount: nowV(rest, l.currency), warn: !canConv(l.currency), date: dt }
      }).filter((n) => n.amount > 0.01),
      ...goals.filter((g) => g.saved < g.target).map((g): Notice => ({ id: `goals:${g.id}:${g.due}`, tab: 'goals', hl: `goals:${g.id}`,
        title: t('goalDeadline'), text: g.name, amount: nowV(g.target - g.saved, g.currency), warn: !canConv(g.currency), date: g.due })),
    ]
    return all.filter((n) => n.date <= iso(lim)).sort((a, b) => a.date.localeCompare(b.date))
  }, [debts, loans, goals, nowV, canConv, t])
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
            <span><b>{money(n.amount)}<Warn show={n.warn} /></b><span className="mut blk">{n.date < today() ? t('overdue') + ' · ' : ''}{date(n.date)}</span></span>
          </button>
        ))}
      </aside>
    </>
  )
}
