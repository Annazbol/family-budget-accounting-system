import { useState } from 'react'
import { useCollection } from '../data'
import { useI18n } from '../i18n'
import Modal from '../Modal'
import { useRates } from '../rates'
import { Warn } from '../RatesBanner'
import Resource from '../Resource'
import Seg from '../Seg'
import { today } from '../shared/dates'
import { ccyField } from '../shared/fields'
import { PeriodPicker, periodQuery, usePeriod } from '../shared/period'
import { Category, Kind, Operation } from '../types'

export function Operations() {
  const { t, money, moneyIn, currency, calc, date } = useI18n()
  const { opM, opH, opN, canOp } = useRates()
  const pr = usePeriod()
  const cats = useCollection<Category>('/categories').data
  const [mode, setMode] = useState<'list' | 'grouped'>('list')
  const [showCats, setShowCats] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const catName = (id: number) => cats.find((c) => c.id === id)?.name ?? '—'
  const sign = (k: Kind) => (k === 'i' ? '+' : '−')
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const kinds = [{ value: 'i', label: t('incomeOne') }, { value: 'e', label: t('expenseOne') }]
  const query = periodQuery(pr.rng) // период отбирает сервер: GET /operations?date_from=…&date_to=…
  const sub = (o: Operation) => o.currency === currency ? '' :
    `${calc === 'now' ? t('asOfDate') : t('now')}: ${money(calc === 'now' ? opH(o) : opN(o))} · ${moneyIn(o.amount, o.currency)}`

  return (
    <>
      <div className="bar">
        <PeriodPicker p={pr} all />
        <Seg<'list' | 'grouped'> value={mode} onChange={setMode} label={t('operations')}
          options={[['list', t('viewList')], ['grouped', t('viewGrouped')]]} />
      </div>

      <Resource<Operation> path="/operations" query={query} addLabel={t('addOp')} empty={query ? t('noOpsPeriod') : t('noOps')}
        footer={<button className="gh wide" onClick={() => setShowCats(true)}>{t('manageCategories')}</button>}
        defaults={{ type: 'e', name: '', amount: '', currency, date: today(), category_id: '', note: '' }}
        fields={[
          { key: 'type', label: t('type'), type: 'select', options: kinds, resets: ['category_id'] },
          { key: 'name', label: t('name'), type: 'text', maxLength: 100 },
          { key: 'amount', label: t('amount'), type: 'number', positive: true },
          ccyField(t('ccy')),
          { key: 'date', label: t('date'), type: 'date' },
          { key: 'category_id', label: t('category'), type: 'select', numeric: true, emptyHint: t('noCatsOfType'),
            options: (f) => cats.filter((c) => c.type === f.type).map((c) => ({ value: c.id, label: c.name })) },
          { key: 'note', label: t('note'), type: 'text', required: false, maxLength: 255 },
        ]}
        check={(f) => {
          const c = cats.find((x) => String(x.id) === String(f.category_id))
          return c && c.type !== f.type ? { key: 'category_id', msg: t('errCatType') } : null
        }}
        row={(o) => (
          <div className="opr">
            <div className="grow">
              <b>{o.name || catName(o.category_id)}</b>
              <div className="mut">{o.name && catName(o.category_id) + ' · '}{date(o.date)}{o.note && ' · ' + o.note}</div>
            </div>
            <div className="amt">
              <b className={o.type === 'i' ? 'inc' : 'exp'}>{sign(o.type)}{money(opM(o))}<Warn show={!canOp(o)} /></b>
              {sub(o) && <div className="mut sub">{sub(o)}</div>}
            </div>
          </div>
        )}
        renderItems={(items, renderItem) => {
          const f = [...items].sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id)
          const sum = (k: Kind) => f.filter((o) => o.type === k).reduce((s, o) => s + opM(o), 0)
          const warn = f.some((o) => !canOp(o))
          const totals = <div className="sum"><span className="inc">+{money(sum('i'))}<Warn show={warn} /></span><span className="exp">−{money(sum('e'))}</span></div>
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

      {showCats && (
        <Modal title={t('manageCategories')} onClose={() => setShowCats(false)}>
          <Resource<Category> path="/categories" addLabel={t('addCategory')} empty={t('noCategories')}
            defaults={{ type: 'e', name: '' }}
            fields={[{ key: 'type', label: t('type'), type: 'select', options: kinds }, { key: 'name', label: t('catName'), type: 'text', maxLength: 100 }]}
            row={(c) => <><b>{c.name}</b> <span className="mut">{c.type === 'i' ? t('incomeShort') : t('expenseShort')}</span></>} />
          <div className="acts"><button className="gh wide" onClick={() => setShowCats(false)}>{t('close')}</button></div>
        </Modal>
      )}
    </>
  )
}
