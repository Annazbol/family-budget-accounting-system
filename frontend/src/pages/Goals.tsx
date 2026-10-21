import { useI18n } from '../i18n'
import { useRates } from '../rates'
import { Warn } from '../RatesBanner'
import Resource from '../Resource'
import { today } from '../shared/dates'
import { ccyField } from '../shared/fields'
import { pct } from '../shared/math'
import { Goal } from '../types'

export function Goals() {
  const { t, money, moneyIn, currency, date } = useI18n()
  const { nowV, canConv } = useRates()
  return (
    <Resource<Goal> path="/goals" addLabel={t('addGoal')} empty={t('noGoals')}
      defaults={{ name: '', target: '', currency, saved: 0, due: today() }}
      fields={[
        { key: 'name', label: t('name'), type: 'text', maxLength: 100 }, { key: 'target', label: t('target'), type: 'number', positive: true },
        ccyField(t('ccy')), { key: 'saved', label: t('saved'), type: 'number' }, { key: 'due', label: t('due'), type: 'date' },
      ]}
      row={(g) => (<>
        <b>{g.name}</b> <span className="mut">{t('until')} {date(g.due)}</span>
        <div className="pr"><i style={{ width: `${pct(g.saved, g.target)}%` }} /></div>
        <small>{money(nowV(g.saved, g.currency))} {t('of')} {money(nowV(g.target, g.currency))}<Warn show={!canConv(g.currency)} />
          {g.currency !== currency && ` (${moneyIn(g.saved, g.currency)} ${t('of')} ${moneyIn(g.target, g.currency)})`}</small>
      </>)} />
  )
}
