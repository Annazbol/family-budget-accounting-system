import { useEffect, useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'
import { useRates } from './rates'
import Resource, { Field } from './Resource'
import Seg from './Seg'
import { CURRENCIES, Category, Debt, Goal, Kind, Loan, Operation } from './types'

const iso = (d: Date) => d.toLocaleDateString('sv')
const today = () => iso(new Date())
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

// ---------- период: выпадающий список + произвольный интервал ----------
type Per = 'week' | 'month' | 'year' | 'all' | 'custom'
interface Rng { a: string; b: string }
const clamp = (s: string) => (s < '2000-01-01' ? '2000-01-01' : s > '2100-12-31' ? '2100-12-31' : s)

function range(p: Per, cr: Rng): [string, string] {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate()
  if (p === 'all') return ['0000-01-01', '9999-12-31']
  if (p === 'custom') return [clamp(cr.a), clamp(cr.b)]
  if (p === 'week') { const w = (n.getDay() + 6) % 7; return [iso(new Date(y, m, d - w)), iso(new Date(y, m, d - w + 6))] }
  if (p === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
  return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))]
}

function usePeriod() {
  const [per, setPer] = useState<Per>('month')
  const [cr, setCr] = useState<Rng>({ a: daysAgo(30), b: today() })
  return { per, setPer, cr, setCr, rng: range(per, cr) }
}

function PeriodPicker({ p, all }: { p: ReturnType<typeof usePeriod>; all?: boolean }) {
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

const ccyField = (label: string): Field => ({ key: 'currency', label, type: 'select', options: CURRENCIES.map((c) => ({ value: c, label: c })) })

// ---------- главная ----------
export function Home() {
  const { t, money, err } = useI18n()
  const { opM } = useRates()
  const pr = usePeriod()
  const [ops, setOps] = useState<Operation[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    Promise.all([api<Operation[]>('/operations'), api<Category[]>('/categories')])
      .then(([o, c]) => { setOps(o); setCats(c) }).catch(setError)
  }, [])

  const [a, b] = pr.rng
  const inR = ops.filter((o) => o.date >= a && o.date <= b)
  const sum = (l: Operation[], k: Kind) => l.filter((o) => o.type === k).reduce((s, o) => s + opM(o), 0)
  const by = new Map<number, number>()
  inR.filter((o) => o.type === 'e').forEach((o) => by.set(o.category_id, (by.get(o.category_id) ?? 0) + opM(o)))
  const rows = [...by.entries()].sort((x, y) => y[1] - x[1])
  return (
    <>
      <PeriodPicker p={pr} />
      {error != null && <p className="err" role="alert">{err(error)}</p>}
      <section className="bal"><small>{t('balance')}</small><b>{money(sum(ops, 'i') - sum(ops, 'e'))}</b></section>
      <div className="two">
        <div className="card"><small>{t('income')}</small><b className="inc">{money(sum(inR, 'i'))}</b></div>
        <div className="card"><small>{t('expense')}</small><b className="exp">{money(sum(inR, 'e'))}</b></div>
      </div>
      <div className="card"><h3>{t('byCategory')}</h3>
        {rows.length === 0 && <p className="mut">{t('noExpenses')}</p>}
        {rows.map(([id, v]) => (
          <div className="li" key={id}><span>{cats.find((c) => c.id === id)?.name ?? '—'}</span><b>{money(v)}</b></div>
        ))}
      </div>
    </>
  )
}

// ---------- операции ----------
export function Operations() {
  const { t, money, moneyIn, currency, calc, date } = useI18n()
  const { opM, opH, opN } = useRates()
  const pr = usePeriod()
  const [cats, setCats] = useState<Category[]>([])
  const [mode, setMode] = useState<'list' | 'grouped'>('list')
  const [showCats, setShowCats] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const loadCats = () => { api<Category[]>('/categories').then(setCats).catch(() => setCats([])) }
  useEffect(() => { loadCats() }, [])
  const catName = (id: number) => cats.find((c) => c.id === id)?.name ?? '—'
  const sign = (k: Kind) => (k === 'i' ? '+' : '−')
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const kinds = [{ value: 'i', label: t('incomeOne') }, { value: 'e', label: t('expenseOne') }]
  const [a, b] = pr.rng
  // вторая строка суммы: то же в другой валюте/по другому курсу + исходная сумма
  const sub = (o: Operation) => o.currency === currency ? '' :
    `${calc === 'now' ? t('asOfDate') : t('now')}: ${money(calc === 'now' ? opH(o) : opN(o))} · ${moneyIn(o.amount, o.currency)}`

  return (
    <>
      <PeriodPicker p={pr} all />
      <Seg<'list' | 'grouped'> value={mode} onChange={setMode} label={t('operations')}
        options={[['list', t('viewList')], ['grouped', t('viewGrouped')]]} />

      <Resource<Operation> path="/operations" addLabel={t('addOp')} empty={t('noOps')}
        defaults={{ type: 'e', name: '', amount: '', currency, date: today(), category_id: '', note: '' }}
        fields={[
          { key: 'type', label: t('type'), type: 'select', options: kinds, resets: ['category_id'] },
          { key: 'name', label: t('name'), type: 'text' },
          { key: 'amount', label: t('amount'), type: 'number' },
          ccyField(t('ccy')),
          { key: 'date', label: t('date'), type: 'date' },
          { key: 'category_id', label: t('category'), type: 'select', numeric: true, emptyHint: t('noCatsOfType'),
            options: (f) => cats.filter((c) => c.type === f.type).map((c) => ({ value: c.id, label: c.name })) },
          { key: 'note', label: t('note'), type: 'text' },
        ]}
        row={(o) => (
          <div className="opr">
            <div className="grow">
              <b>{o.name || catName(o.category_id)}</b>
              <div className="mut">{o.name && catName(o.category_id) + ' · '}{date(o.date)}{o.note && ' · ' + o.note}</div>
            </div>
            <div className="amt">
              <b className={o.type === 'i' ? 'inc' : 'exp'}>{sign(o.type)}{money(opM(o))}</b>
              {sub(o) && <div className="mut sub">{sub(o)}</div>}
            </div>
          </div>
        )}
        renderItems={(items, renderItem) => {
          const f = items.filter((o) => o.date >= a && o.date <= b).sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id)
          if (f.length === 0) return <p className="mut">{t('noOpsPeriod')}</p>
          const sum = (k: Kind) => f.filter((o) => o.type === k).reduce((s, o) => s + opM(o), 0)
          const totals = <div className="sum"><span className="inc">+{money(sum('i'))}</span><span className="exp">−{money(sum('e'))}</span></div>
          if (mode === 'list') return <>{totals}{f.map(renderItem)}</>

          const g = new Map<string, Operation[]>()
          f.forEach((o) => { const k = `${o.category_id}:${o.type}`; g.set(k, [...(g.get(k) ?? []), o]) })
          const rows = [...g.entries()]
            .map(([k, l]) => ({ k, l, type: l[0].type, total: l.reduce((s, o) => s + opM(o), 0) }))
            .sort((x, y) => y.total - x.total)
          return (<>
            {totals}
            {rows.map((r) => (
              <div className="grp" key={r.k}>
                <button className="grp-h" aria-expanded={open.has(r.k)} onClick={() => toggle(r.k)}>
                  <span className="grow"><b>{catName(r.l[0].category_id)}</b> <small>· {t('opsN', { n: r.l.length })}</small></span>
                  <b className={r.type === 'i' ? 'inc' : 'exp'}>{sign(r.type)}{money(r.total)}</b>
                  <span aria-hidden="true">{open.has(r.k) ? '▾' : '▸'}</span>
                </button>
                {open.has(r.k) && r.l.map(renderItem)}
              </div>
            ))}
          </>)
        }} />

      <button className="gh wide" aria-expanded={showCats} onClick={() => setShowCats(!showCats)}>
        {showCats ? t('hideCategories') : t('manageCategories')}
      </button>
      {showCats && (
        <Resource<Category> path="/categories" addLabel={t('addCategory')} empty={t('noCategories')} onChange={loadCats}
          defaults={{ type: 'e', name: '' }}
          fields={[{ key: 'type', label: t('type'), type: 'select', options: kinds }, { key: 'name', label: t('catName'), type: 'text' }]}
          row={(c) => <><b>{c.name}</b> <span className="mut">{c.type === 'i' ? t('incomeShort') : t('expenseShort')}</span></>} />
      )}
    </>
  )
}

// ---------- цели, долги, кредиты ----------
export function Goals() {
  const { t, money, moneyIn, currency, date } = useI18n()
  const { nowV } = useRates()
  return (
    <Resource<Goal> path="/goals" addLabel={t('addGoal')} empty={t('noGoals')}
      defaults={{ name: '', target: '', currency, saved: 0, due: today() }}
      fields={[
        { key: 'name', label: t('name'), type: 'text' }, { key: 'target', label: t('target'), type: 'number' },
        ccyField(t('ccy')), { key: 'saved', label: t('saved'), type: 'number' }, { key: 'due', label: t('due'), type: 'date' },
      ]}
      row={(g) => (<>
        <b>{g.name}</b> <span className="mut">{t('until')} {date(g.due)}</span>
        <div className="pr"><i style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} /></div>
        <small>{money(nowV(g.saved, g.currency))} {t('of')} {money(nowV(g.target, g.currency))}
          {g.currency !== currency && ` (${moneyIn(g.saved, g.currency)} ${t('of')} ${moneyIn(g.target, g.currency)})`}</small>
      </>)} />
  )
}

export function Debts() {
  const { t, money, moneyIn, currency, date } = useI18n()
  const { nowV } = useRates()
  return (
    <Resource<Debt> path="/debts" addLabel={t('addDebt')} empty={t('noDebts')}
      defaults={{ direction: 'owe', amount: '', currency, due: today(), note: '' }}
      fields={[
        { key: 'direction', label: t('who'), type: 'select', options: [{ value: 'owe', label: t('iOwe') }, { value: 'owed', label: t('owedMe') }] },
        { key: 'amount', label: t('amount'), type: 'number' }, ccyField(t('ccy')),
        { key: 'due', label: t('dueBack'), type: 'date' }, { key: 'note', label: t('note'), type: 'text' },
      ]}
      row={(d) => (<>
        <b>{d.direction === 'owe' ? t('iOwe') : t('owedMe')}: {money(nowV(d.amount, d.currency))}</b>
        {d.currency !== currency && <small className="mut"> ({moneyIn(d.amount, d.currency)})</small>}
        <div className="mut">{t('until')} {date(d.due)}{d.note && ' · ' + d.note}</div>
      </>)} />
  )
}

export function Loans() {
  const { t, money, moneyIn, currency } = useI18n()
  const { nowV } = useRates()
  return (
    <Resource<Loan> path="/loans" addLabel={t('addLoan')} empty={t('noLoans')}
      defaults={{ name: '', initial: '', current: '', rate: '', payment: '', currency, day: 1 }}
      fields={[
        { key: 'name', label: t('loanName'), type: 'text' }, { key: 'initial', label: t('initial'), type: 'number' },
        ccyField(t('ccy')), { key: 'current', label: t('current'), type: 'number' }, { key: 'rate', label: t('rate'), type: 'number' },
        { key: 'payment', label: t('payment'), type: 'number' }, { key: 'day', label: t('payDay'), type: 'number' },
      ]}
      row={(l) => (<>
        <b>{l.name}</b> <span className="mut">{l.rate}% · {l.current > 0 ? t('active') : t('closed')}</span>
        <div className="pr"><i style={{ width: `${((l.initial - l.current) / l.initial) * 100}%` }} /></div>
        <small>{t('rest')} {money(nowV(l.current, l.currency))} {t('of')} {money(nowV(l.initial, l.currency))} · {t('paymentShort')} {money(nowV(l.payment, l.currency))}
          {l.currency !== currency && ` (${moneyIn(l.current, l.currency)} ${t('of')} ${moneyIn(l.initial, l.currency)})`}</small>
      </>)} />
  )
}
