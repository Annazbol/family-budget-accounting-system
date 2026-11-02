import { FormEvent, useEffect, useState } from 'react'
import { api } from './api'
import { login, registerStart, registerConfirm, registerResend } from './auth'
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

/** Экран входа / регистрации с подтверждением email. */
export function LoginScreen({ onDone }: { onDone: (u: { name: string; email: string }) => void }) {
  const { t, err: errText } = useI18n()
  const [mode, setMode] = useState<'login' | 'register' | 'code'>('login')
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [regLogin, setRegLogin] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)

  const goLogin = async (e: FormEvent) => {
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

  const goRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError(t('nameRequired'))
    if (!regLogin.trim()) return setError(t('loginRequired'))
    if (!email.trim()) return setError(t('loginRequired'))
    if (!password || password.length < 6) return setError(t('passwordRequired'))
    setBusy(true)
    setError('')
    setDevCode(null)
    try {
      const res = await registerStart({
        email: email.trim(),
        login: regLogin.trim(),
        name: name.trim(),
        password,
      })
      setEmail(res.email)
      if (res.dev_code) setDevCode(res.dev_code)
      setMode('code')
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const goConfirm = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return setError(t('regCodeRequired'))
    setBusy(true)
    setError('')
    try {
      const { user } = await registerConfirm(email, code)
      onDone({ name: user.name, email: user.email })
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const goResend = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await registerResend(email)
      if (res.dev_code) setDevCode(res.dev_code)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="app">
      <main>
        {mode === 'login' && (
          <form className="card" onSubmit={goLogin}>
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
            <div className="acts">
              <button className="pri wide" type="submit" disabled={busy}>{t('start')}</button>
              <button className="gh wide" type="button" disabled={busy}
                onClick={() => { setMode('register'); setError(''); setPassword('') }}>
                {t('registerLink')}
              </button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form className="card" onSubmit={goRegister}>
            <h1>{t('registerTitle')}</h1>
            <label>{t('regName')}
              <input value={name} autoFocus onChange={(e) => setName(e.target.value)} />
            </label>
            <label>{t('regLogin')}
              <input value={regLogin} autoComplete="username" onChange={(e) => setRegLogin(e.target.value)} />
            </label>
            <label>{t('regEmail')}
              <input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>{t('regPassword')}
              <input type="password" value={password} autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="err" role="alert">{error}</p>}
            <div className="acts">
              <button className="pri wide" type="submit" disabled={busy}>{t('regSubmit')}</button>
              <button className="gh wide" type="button" disabled={busy}
                onClick={() => { setMode('login'); setError('') }}>
                {t('loginLink')}
              </button>
            </div>
          </form>
        )}

        {mode === 'code' && (
          <form className="card" onSubmit={goConfirm}>
            <h1>{t('regCodeTitle')}</h1>
            <p className="mut">{t('regCodeText', { email })}</p>
            {devCode && <p className="mut"><small>DEV code: <b>{devCode}</b></small></p>}
            <label>{t('regCode')}
              <input value={code} autoFocus inputMode="numeric" autoComplete="one-time-code"
                onChange={(e) => setCode(e.target.value)} />
            </label>
            {error && <p className="err" role="alert">{error}</p>}
            <div className="acts">
              <button className="pri wide" type="submit" disabled={busy}>{t('regConfirm')}</button>
              <button className="gh wide" type="button" disabled={busy} onClick={goResend}>{t('regResend')}</button>
              <button className="gh wide" type="button" disabled={busy}
                onClick={() => { setMode('register'); setError(''); setCode('') }}>
                {t('loginLink')}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

export function ProfileSheet(props: { profile: Profile; onLogout: () => void; onClose: () => void }) {
  const { profile, onLogout, onClose } = props
  const { t, currency, calc, theme, set, err, date } = useI18n()
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

        {error != null && <p className="err" role="alert">{err(error)}</p>}
        <div className="acts col">
          <button className="gh danger" onClick={onLogout}>{t('logout')}</button>
        </div>
      </aside>
    </>
  )
}
