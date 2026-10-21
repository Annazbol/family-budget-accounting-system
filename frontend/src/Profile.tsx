import { FormEvent, useEffect, useState } from 'react'
import { api } from './api'
import { login } from './auth'
import { Calc, Csv, LOCALE, Theme, useI18n } from './i18n'
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

/** Экран входа: логин (email / ник / имя) + пароль → POST /auth/login. */
export function LoginScreen({ onDone }: { onDone: (u: { name: string; email: string }) => void }) {
  const { t, err: errText } = useI18n()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (e: FormEvent) => {
    e.preventDefault()
    const loginTrim = loginValue.trim()
    if (!loginTrim) return setError(t('loginRequired'))
    if (!password) return setError(t('passwordRequired'))
    setBusy(true)
    setError('')
    try {
      const { user } = await login(loginTrim, password)
      onDone({ name: user.name, email: user.email })
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="app">
      <main>
        <form className="card" onSubmit={go}>
          <h1>{t('welcome')}</h1>
          <p className="mut">{t('welcomeText')}</p>
          <label>{t('loginLabel')}
            <input value={loginValue} autoFocus autoComplete="username"
              onChange={(e) => setLoginValue(e.target.value)} />
          </label>
          <label>{t('passwordLabel')}
            <input type="password" value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="err" role="alert">{error}</p>}
          <p className="mut"><small>{t('loginHint')}</small></p>
          <div className="acts">
            <button className="pri wide" type="submit" disabled={busy}>{t('start')}</button>
          </div>
        </form>
      </main>
    </div>
  )
}

export function ProfileSheet(props: { profile: Profile; onLogout: () => void; onClose: () => void }) {
  const { profile, onLogout, onClose } = props
  const { t, currency, calc, theme, csv, set, err, date } = useI18n()
  const { data, failed, retry, opH, opN } = useRates()
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const symbol = (c: string) =>
    new Intl.NumberFormat(LOCALE, { style: 'currency', currency: c }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? c

  // Экспорт в CSV: формат выбирается в профиле — Excel (Россия): «;» и запятая, международный: «,» и точка.
  // Значения, начинающиеся с «=», «+», «-», «@», получают апостроф, чтобы Excel не выполнил их как формулу.
  const exportCsv = async () => {
    try {
      const [ops, cats] = await Promise.all([api<Operation[]>('/operations'), api<Category[]>('/categories')])
      const cat = (id: number) => cats.find((c) => c.id === id)?.name ?? ''
      const sep = csv === 'ru' ? ';' : ','
      const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v)
      const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
      const num = (n: number) => { const s = String(Math.round(n * 100) / 100); return csv === 'ru' ? s.replace('.', ',') : s }
      const rows = [
        [t('date'), t('type'), t('name'), t('category'), t('amount'), t('ccy'), t('budgetAtDate'), t('budgetNow'), t('note')],
        ...ops.map((o) => [o.date, o.type === 'i' ? t('incomeOne') : t('expenseOne'), safe(o.name), safe(cat(o.category_id)),
          num(o.amount), o.currency, num(opH(o)), num(opN(o)), safe(o.note)]),
      ]
      const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(q).join(sep)).join('\n')], { type: 'text/csv;charset=utf-8' })
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
        <small className="mut">{data ? t('ratesOn', { d: date(data.date) }) : t('ratesFail')}</small>
        {failed && <button className="gh" onClick={retry}>{t('retry')}</button>}

        <label>{t('theme')}</label>
        <Seg<Theme> value={theme} onChange={(v) => set({ theme: v })} label={t('theme')}
          options={[['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]]} />

        <label>{t('csvFormat')}</label>
        <Seg<Csv> value={csv} onChange={(v) => set({ csv: v })} label={t('csvFormat')}
          options={[['ru', t('csvRu')], ['intl', t('csvIntl')]]} />

        {error != null && <p className="err" role="alert">{err(error)}</p>}
        <div className="acts col">
          <button className="gh" onClick={exportCsv}>{t('exportCsv')}</button>
          <button className="gh danger" onClick={onLogout}>{t('logout')}</button>
        </div>
      </aside>
    </>
  )
}
