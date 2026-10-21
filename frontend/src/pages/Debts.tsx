import { useI18n } from '../i18n'
import { useRates } from '../rates'
import { Warn } from '../RatesBanner'
import Resource from '../Resource'
import { today } from '../shared/dates'
import { ccyField } from '../shared/fields'
import { Debt } from '../types'

export function Debts() {
  const { t, money, moneyIn, currency, date } = useI18n()
  const { nowV, canConv } = useRates()
  return (
    <Resource<Debt> path="/debts" addLabel={t('addDebt')} empty={t('noDebts')}
      defaults={{ direction: 'owe', amount: '', currency, due: today(), note: '' }}
      fields={[
        { key: 'direction', label: t('who'), type: 'select', options: [{ value: 'owe', label: t('iOwe') }, { value: 'owed', label: t('owedMe') }] },
        { key: 'amount', label: t('amount'), type: 'number', positive: true }, ccyField(t('ccy')),
        { key: 'due', label: t('dueBack'), type: 'date' }, { key: 'note', label: t('note'), type: 'text', required: false, maxLength: 255 },
      ]}
      row={(d) => (<>
        <b>{d.direction === 'owe' ? t('iOwe') : t('owedMe')}: {money(nowV(d.amount, d.currency))}<Warn show={!canConv(d.currency)} /></b>
        {d.currency !== currency && <small className="mut"> ({moneyIn(d.amount, d.currency)})</small>}
        <div className="mut">{t('until')} {date(d.due)}{d.note && ' · ' + d.note}</div>
      </>)} />
  )
}
