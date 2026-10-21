import { useI18n } from '../i18n'
import { useRates } from '../rates'
import { Warn } from '../RatesBanner'
import Resource from '../Resource'
import { ccyField } from '../shared/fields'
import { pct } from '../shared/math'
import { Loan } from '../types'

const toNum = (v: string | number) => Number(String(v).replace(',', '.'))

export function Loans() {
  const { t, money, moneyIn, currency } = useI18n()
  const { nowV, canConv } = useRates()
  return (
    <Resource<Loan> path="/loans" addLabel={t('addLoan')} empty={t('noLoans')}
      defaults={{ name: '', initial: '', current: '', rate: '', payment: '', currency, day: 1 }}
      fields={[
        { key: 'name', label: t('loanName'), type: 'text', maxLength: 100 }, { key: 'initial', label: t('initial'), type: 'number', positive: true },
        ccyField(t('ccy')), { key: 'current', label: t('current'), type: 'number' }, { key: 'rate', label: t('rate'), type: 'number', max: 100 },
        { key: 'payment', label: t('payment'), type: 'number', positive: true }, { key: 'day', label: t('payDay'), type: 'number', positive: true, integer: true, max: 28 },
      ]}
      check={(f) => (toNum(f.current) > toNum(f.initial) ? { key: 'current', msg: t('errLoanDebt') } : null)}
      row={(l) => (<>
        <b>{l.name}</b> <span className="mut">{l.rate}% · {l.current > 0 ? t('active') : t('closed')}</span>
        <div className="pr"><i style={{ width: `${pct(l.initial - l.current, l.initial)}%` }} /></div>
        <small>{t('rest')} {money(nowV(l.current, l.currency))} {t('of')} {money(nowV(l.initial, l.currency))} · {t('paymentShort')} {money(nowV(l.payment, l.currency))}<Warn show={!canConv(l.currency)} />
          {l.currency !== currency && ` (${moneyIn(l.current, l.currency)} ${t('of')} ${moneyIn(l.initial, l.currency)})`}</small>
      </>)} />
  )
}
