import { useState } from 'react'
import { api } from '../api'
import { invalidate } from '../data'
import { useI18n } from '../i18n'
import Modal from '../Modal'
import { useRates } from '../rates'
import { Warn } from '../RatesBanner'
import Resource from '../Resource'
import { today } from '../shared/dates'
import { ccyField } from '../shared/fields'
import { pct } from '../shared/math'
import { sanitizeNumber, showNumber, tidyNumber } from '../shared/numeric'
import { Goal } from '../types'

export function Goals() {
  const { t, money, moneyIn, currency, date, err } = useI18n()
  const { nowV, canConv } = useRates()
  const [pay, setPay] = useState<Goal | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [invalid, setInvalid] = useState('')

  const closePay = () => { setPay(null); setAmount(''); setError(null); setInvalid('') }

  const submitPay = async () => {
    if (!pay) return
    const n = Number(amount.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) {
      setInvalid(t('errFieldPositive', { f: t('contributeAmount') }))
      return
    }
    const left = Number(pay.target) - Number(pay.saved)
    if (n > left + 1e-9) {
      setInvalid(t('errContributeOver'))
      return
    }
    setInvalid('')
    try {
      await api(`/goals/${pay.id}/contribute`, { method: 'POST', body: JSON.stringify({ amount: n }) })
      invalidate('/goals', '/operations', '/operations/totals')
      closePay()
    } catch (e) {
      setError(e)
    }
  }

  return (
    <>
      <Resource<Goal> path="/goals" addLabel={t('addGoal')} empty={t('noGoals')}
        defaults={{ name: '', target: '', currency, saved: 0, due: today() }}
        fields={[
          { key: 'name', label: t('name'), type: 'text', maxLength: 100 },
          { key: 'target', label: t('target'), type: 'number', positive: true },
          ccyField(t('ccy')),
          { key: 'saved', label: t('saved'), type: 'number' },
          { key: 'due', label: t('due'), type: 'date' },
        ]}
        itemActions={(g) =>
          Number(g.saved) < Number(g.target) ? (
            <button type="button" className="ic" title={t('contribute')} aria-label={t('contribute')}
              onClick={() => { setPay(g); setAmount(''); setError(null); setInvalid('') }}>＋</button>
          ) : null
        }
        row={(g) => (<>
          <b>{g.name}</b> <span className="mut">{t('until')} {date(g.due)}</span>
          <div className="pr"><i style={{ width: `${pct(Number(g.saved), Number(g.target))}%` }} /></div>
          <small>{money(nowV(Number(g.saved), g.currency))} {t('of')} {money(nowV(Number(g.target), g.currency))}
            <Warn show={!canConv(g.currency)} />
            {g.currency !== currency && ` (${moneyIn(Number(g.saved), g.currency)} ${t('of')} ${moneyIn(Number(g.target), g.currency)})`}
          </small>
        </>)} />

      {pay && (
        <Modal title={t('contributeGoal')} onClose={closePay} top>
          <p className="mut"><b>{pay.name}</b> · {t('rest')} {money(nowV(Math.max(0, Number(pay.target) - Number(pay.saved)), pay.currency))}</p>
          <label>{t('contributeAmount')}
            <input type="text" inputMode="decimal" autoComplete="off" autoFocus
              value={showNumber(amount)}
              onChange={(e) => setAmount(sanitizeNumber(e.target.value, { positive: true }, showNumber(amount)))}
              onBlur={() => setAmount(tidyNumber(amount, { positive: true }))} />
          </label>
          {(invalid || error != null) && <p className="err" role="alert">{invalid || err(error)}</p>}
          <div className="acts">
            <button type="button" className="pri" onClick={submitPay}>{t('contributeSubmit')}</button>
            <button type="button" className="gh" onClick={closePay}>{t('cancel')}</button>
          </div>
        </Modal>
      )}
    </>
  )
}
