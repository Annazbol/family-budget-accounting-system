import { useCollection } from '../data'
import { useI18n } from '../i18n'
import { useRates } from '../rates'
import { Warn } from '../RatesBanner'
import { PeriodPicker, periodQuery, usePeriod } from '../shared/period'
import { Category, Kind, Total } from '../types'

// Итоги приходят с сервера уже сгруппированными (тип, валюта, дата, категория), а пересчёт в валюту бюджета — на клиенте.
export function Home() {
  const { t, money, err } = useI18n()
  const { opM, canOp } = useRates()
  const pr = usePeriod()
  const all = useCollection<Total>('/operations/totals') // за всё время — для общего баланса
  const per = useCollection<Total>('/operations/totals' + periodQuery(pr.rng)) // за выбранный период
  const cats = useCollection<Category>('/categories')

  const sum = (l: Total[], k: Kind) => l.filter((r) => r.type === k).reduce((s, r) => s + opM(r), 0)
  const net = (l: Total[]) => sum(l, 'i') - sum(l, 'e')
  const by = new Map<number, number>()
  per.data.filter((r) => r.type === 'e').forEach((r) => by.set(r.category_id, (by.get(r.category_id) ?? 0) + opM(r)))
  const rows = [...by.entries()].sort((x, y) => y[1] - x[1])
  const error = all.error ?? per.error ?? cats.error
  const warnPer = per.data.some((r) => !canOp(r))

  return (
    <>
      <div className="bar"><PeriodPicker p={pr} /></div>
      {error != null && <p className="err" role="alert">{err(error)}</p>}
      {all.loading || per.loading ? <p className="mut">{t('loading')}</p> : (
        <>
          <div className="two">
            <section className="bal"><small>{t('balance')}</small><b>{money(net(all.data))}<Warn show={all.data.some((r) => !canOp(r))} /></b></section>
            <section className="bal alt"><small>{t('balancePeriod')}</small><b>{money(net(per.data))}<Warn show={warnPer} /></b></section>
          </div>
          <div className="two">
            <div className="card"><small>{t('income')}</small><b className="inc">{money(sum(per.data, 'i'))}<Warn show={warnPer} /></b></div>
            <div className="card"><small>{t('expense')}</small><b className="exp">{money(sum(per.data, 'e'))}<Warn show={warnPer} /></b></div>
          </div>
          <div className="card"><h3>{t('byCategory')}</h3>
            {rows.length === 0 && <p className="mut">{t('noExpenses')}</p>}
            {rows.map(([id, v]) => (
              <div className="li" key={id}><span>{cats.data.find((c) => c.id === id)?.name ?? '—'}</span><b>{money(v)}</b></div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
