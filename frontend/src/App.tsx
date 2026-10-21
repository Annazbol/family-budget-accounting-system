import { useEffect, useState } from 'react'
import { AuthUser, fetchMe, getStoredUser, logout as authLogout } from './auth'
import { useI18n } from './i18n'
import { Notice, NotificationsSheet, loadRead, saveRead, useNotices } from './Notifications'
import { Debts, Goals, Home, Loans, Operations } from './pages'
import { ProfileSheet, LoginScreen, initials } from './Profile'
import RatesBanner from './RatesBanner'
import { TabId } from './types'

const TABS = [['home', Home], ['operations', Operations], ['goals', Goals], ['debts', Debts], ['loans', Loans]] as const

export default function App() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabId>('home')
  const [profileOpen, setProfileOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)
  const [booting, setBooting] = useState(() => !!getStoredUser())
  const [read, setRead] = useState<string[]>(loadRead)
  const [bell, setBell] = useState<string[] | null>(null)
  const [hl, setHl] = useState<string | null>(null)
  const notices = useNotices()
  const unread = notices.filter((n) => !read.includes(n.id)).length

  // При старте проверяем токен через GET /auth/me (мок или бэкенд)
  useEffect(() => {
    if (!booting) return
    let cancelled = false
    fetchMe().then((u) => {
      if (!cancelled) {
        setUser(u)
        setBooting(false)
      }
    })
    return () => { cancelled = true }
  }, [booting])

  const openBell = () => {
    setBell(read)
    const ids = notices.map((n) => n.id)
    const next = [...new Set([...read.filter((id) => ids.includes(id)), ...ids])]
    setRead(next); saveRead(next)
  }
  const go = (n: Notice) => { setBell(null); setTab(n.tab); setHl(n.hl) }

  useEffect(() => {
    if (!hl) return
    let tries = 0
    const iv = setInterval(() => {
      const el = document.querySelector(`[data-hl="${hl}"]`)
      if (el) {
        clearInterval(iv)
        el.scrollIntoView({ block: 'center' })
        el.classList.add('flash')
        setTimeout(() => el.classList.remove('flash'), 2200)
        setHl(null)
      } else if (++tries > 20) { clearInterval(iv); setHl(null) }
    }, 150)
    return () => clearInterval(iv)
  }, [hl])

  const onLogin = (u: { name: string; email: string }) => {
    // полный user уже в localStorage после login(); подтянем из storage
    setUser(getStoredUser() ?? { id: 0, name: u.name, email: u.email, login: '' })
  }

  const onLogout = async () => {
    setProfileOpen(false)
    await authLogout()
    setUser(null)
  }

  if (booting) {
    return (
      <div id="app">
        <main><p className="mut">{t('loading')}</p></main>
      </div>
    )
  }

  if (!user) return <LoginScreen onDone={onLogin} />

  const Page = TABS.find((x) => x[0] === tab)![1]
  return (
    <div id="app">
      <header>
        <button className="av" aria-label={t('profile')} aria-haspopup="dialog" onClick={() => setProfileOpen(true)}>
          {initials(user.name)}
        </button>
        <h1>{t('appTitle')}</h1>
        <button className="bell" aria-label={t('notifications')} aria-haspopup="dialog" onClick={openBell}>
          🔔{unread > 0 && <span className="badge">{unread}</span>}
        </button>
      </header>
      {profileOpen && (
        <ProfileSheet profile={{ name: user.name, email: user.email }} onClose={() => setProfileOpen(false)}
          onLogout={onLogout} />
      )}
      {bell !== null && (
        <NotificationsSheet items={notices} isNew={(id) => !bell.includes(id)} onGo={go} onClose={() => setBell(null)} />
      )}
      <nav>
        {TABS.map(([id]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{t(id)}</button>
        ))}
      </nav>
      <main><RatesBanner /><Page /></main>
    </div>
  )
}
