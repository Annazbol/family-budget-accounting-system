import { useState } from 'react'
import { api } from '../api'
import { invalidate } from '../data'
import { useI18n } from '../i18n'
import Modal from '../Modal'
import { useRates } from '../rates'
import { Warn } from '../RatesBanner'
import Resource from '../Resource'
import { ccyField } from '../shared/fields'
import { annuityPayment, remainingPrincipal, remainingToPay, totalAnnuityCost } from '../shared/loanMath'
import { pct } from '../shared/math'
import { today } from '../shared/dates'
import { sanitizeNumber, showNumber, tidyNumber } from '../shared/numeric'
import { Loan } from '../types'

function endDate(start: string, months: number): string {
  const d = new Date(start + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return start
  d.setMonth(d.getMonth() + Math.max(0, Math.floor(months)))
  return d.toLocaleDateString('sv')
}

export function Loans() {
  const { t, money, moneyIn, currency, date, err } = useI18n()
  const { nowV, canConv } = useRates()
  const [pay, setPay] = useState<Loan | null>(null)
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
    // нельзя внести больше остатка к возврату по аннуитету
    const left = remainingToPay(Number(pay.amount), Number(pay.rate), Number(pay.term_months), Number(pay.paid))
    if (n > left + 0.02) {
      setInvalid(t('errContributeOver'))
      return
    }
    setInvalid('')
    try {
      await api(`/loans/${pay.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: n }) })
      invalidate('/loans', '/operations', '/operations/totals')
      closePay()
    } catch (e) {
      setError(e)
    }
  }

  return (
    <>
      <Resource<Loan> path="/loans" addLabel={t('addLoan')} empty={t('noLoans')}
        defaults={{ name: '', amount: '', rate: '', paid: '0', start_date: today(), term_months: '12', currency }}
        fields={[
          { key: 'name', label: t('loanName'), type: 'text', maxLength: 100 },
          { key: 'amount', label: t('loanAmount'), type: 'number', positive: true },
          ccyField(t('ccy')),
          { key: 'rate', label: t('rate'), type: 'number', max: 100 },
          { key: 'paid', label: t('loanPaid'), type: 'number' },
          { key: 'start_date', label: t('loanStart'), type: 'date' },
          { key: 'term_months', label: t('loanTerm'), type: 'number', positive: true, integer: true },
        ]}
        check={(f) => {
          const paid = Number(String(f.paid).replace(',', '.'))
          const amount = Number(String(f.amount).replace(',', '.'))
          return paid > amount * 3 ? { key: 'paid', msg: t('errLoanPaid') } : null
          // paid may exceed principal (includes interest) — soft check only absurd values
        }}
        itemActions={(l) => {
          const left = remainingToPay(Number(l.amount), Number(l.rate), Number(l.term_months), Number(l.paid))
          return left > 0.01 ? (
            <button type="button" className="ic" title={t('contribute')} aria-label={t('contribute')}
              onClick={() => { setPay(l); setAmount(''); setError(null); setInvalid('') }}>＋</button>
          ) : null
        }}
        row={(l) => {
          const P = Number(l.amount)
          const rate = Number(l.rate)
          const n = Number(l.term_months)
          const paid = Number(l.paid)
          const monthly = annuityPayment(P, rate, n)
          const total = totalAnnuityCost(P, rate, n)
          const bodyLeft = remainingPrincipal(P, rate, n, paid)
          const toPay = remainingToPay(P, rate, n, paid)
          const done = pct(total - toPay, total)
          const end = endDate(l.start_date, n)
          const active = toPay > 0.01
          return (<>
            <b>{l.name}</b>{' '}
            <span className="mut">{rate}% · {active ? t('active') : t('closed')} · {t('until')} {date(end)}</span>
            <div className="pr"><i style={{ width: `${done}%` }} /></div>
            <small className="blk">
              {t('loanMonthly')}: {money(nowV(monthly, l.currency))}
              {' · '}{t('loanTotal')}: {money(nowV(total, l.currency))}
            </small>
            <small>
              {t('rest')}: {money(nowV(toPay, l.currency))}
              {' · '}{t('loanBodyLeft')}: {money(nowV(bodyLeft, l.currency))}
              {' · '}{t('loanPaid')}: {money(nowV(paid, l.currency))}
              <Warn show={!canConv(l.currency)} />
              {l.currency !== currency && ` (${moneyIn(P, l.currency)})`}
            </small>
          </>)
        }} />

      {pay && (
        <Modal title={t('payLoan')} onClose={closePay} top>
          <p className="mut">
            <b>{pay.name}</b>
            {' · '}{t('rest')}{' '}
            {money(nowV(
              remainingToPay(Number(pay.amount), Number(pay.rate), Number(pay.term_months), Number(pay.paid)),
              pay.currency,
            ))}
            {' · '}{t('loanMonthly')}{' '}
            {money(nowV(annuityPayment(Number(pay.amount), Number(pay.rate), Number(pay.term_months)), pay.currency))}
          </p>
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
