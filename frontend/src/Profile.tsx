import { FormEvent, useEffect, useState } from 'react'
import { api } from './api'
import { Calc, LOCALE, Theme, useI18n } from './i18n'
import { useRates } from './rates'
import Seg from './Seg'
import { CURRENCIES, Category, Currency, Operation } from './types'

export interface Profile { name: string; email: string }

// Профиль хранится на устройстве. Реальная авторизация потребует пользователей и токенов на бэкенде.
const PK = 'fb.profile'
export function loadProfile(): Profile | null {
  try { const p = JSON.parse(localStorage.getItem(PK) || 'null'); return p && typeof p.name === 'string' ? p : null } catch { return null }
}
export function saveProfile(p: Profile | null) {
  try { if (p) localStorage.setItem(PK, JSON.stringify(p)); else localStorage.removeItem(PK) } catch { /* ignore */ }
}
export const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?'

export function Welcome({ onDone }: { onDone: (p: Profile) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const go = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError(t('nameRequired'))
    onDone({ name: name.trim(), email: email.trim() })
  }
  return (
    <div id="app">
      <main>
        <form className="card" onSubmit={go}>
          <h1>{t('welcome')}</h1>
          <p className="mut">{t('welcomeText')}</p>
          <label>{t('yourName')}<input value={name} autoFocus onChange={(e) => setName(e.target.value)} /></label>
          <label>{t('email')}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="acts"><button className="pri wide" type="submit">{t('start')}</button></div>
        </form>
      </main>
    </div>
  )
}

export function ProfileSheet(props: { profile: Profile; onLogout: () => void; onClose: () => void }) {
  const { profile, onLogout, onClose } = props
  const { t, currency, calc, theme, set, err, date } = useI18n()
  const { data, failed, opH, opN } = useRates()
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const symbol = (c: string) =>
    new Intl.NumberFormat(LOCALE, { style: 'currency', currency: c }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? c

  // Экспорт: CSV с разделителем «;» и BOM, чтобы Excel правильно открыл кириллицу.
  const exportCsv = async () => {
    try {
      const [ops, cats] = await Promise.all([api<Operation[]>('/operations'), api<Category[]>('/categories')])
      const cat = (id: number) => cats.find((c) => c.id === id)?.name ?? ''
      const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
      const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
      const rows = [
        [t('date'), t('type'), t('name'), t('category'), t('amount'), t('ccy'), t('budgetAtDate'), t('budgetNow'), t('note')],
        ...ops.map((o) => [o.date, o.type === 'i' ? t('incomeOne') : t('expenseOne'), o.name, cat(o.category_id),
          num(o.amount), o.currency, num(opH(o)), num(opN(o)), o.note]),
      ]
      const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'operations.csv'; a.click()
      URL.revokeObjectURL(url)
      setError(null)
    } catch (e) { setError(e) }
  }

  return (
    <>
      <div className="bd" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t('profile')}>
        <div className="hd">
          <div className="av big" aria-hidden="true">{initials(profile.name)}</div>
          <button className="gh" autoFocus onClick={onClose}>{t('close')}</button>
        </div>
        <p className="who"><b>{profile.name}</b><br /><span className="mut">{profile.email}</span></p>

        <label>{t('currency')}
          <select value={currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c} ({symbol(c)})</option>)}
          </select>
          <small className="mut">{t('rateNote')}</small>
        </label>

        <label>{t('calcLabel')}</label>
        <Seg<Calc> value={calc} onChange={(v) => set({ calc: v })} label={t('calcLabel')}
          options={[['hist', t('calcHist')], ['now', t('calcNow')]]} />
        <small className="mut">{failed || !data ? t('ratesFail') : t('ratesOn', { d: date(data.date) })}</small>

        <label>{t('theme')}</label>
        <Seg<Theme> value={theme} onChange={(v) => set({ theme: v })} label={t('theme')}
          options={[['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]]} />

        {error != null && <p className="err" role="alert">{err(error)}</p>}
        <div className="acts col">
          <button className="gh" onClick={exportCsv}>{t('exportCsv')}</button>
          <button className="gh danger" onClick={onLogout}>{t('logout')}</button>
        </div>
      </aside>
    </>
  )
}
