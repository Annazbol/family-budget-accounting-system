import { useEffect, useState } from 'react'
import { useI18n } from './i18n'
import { Notice, NotificationsSheet, loadRead, saveRead, useNotices } from './Notifications'
import { Debts, Goals, Home, Loans, Operations } from './pages'
import { Profile, ProfileSheet, Welcome, initials, loadProfile, saveProfile } from './Profile'
import { TabId } from './types'

// id вкладки совпадает с ключом перевода
const TABS = [['home', Home], ['operations', Operations], ['goals', Goals], ['debts', Debts], ['loans', Loans]] as const

export default function App() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabId>('home')
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(loadProfile)
  const [read, setRead] = useState<string[]>(loadRead)
  const [bell, setBell] = useState<string[] | null>(null) // null — закрыто; иначе список прочитанных на момент открытия
  const [hl, setHl] = useState<string | null>(null) // объект, который нужно подсветить после перехода
  const notices = useNotices(`${tab}:${bell !== null}`)
  const unread = notices.filter((n) => !read.includes(n.id)).length

  // Открытие уведомлений помечает все текущие как прочитанные; внутри окна новые ещё видны.
  const openBell = () => {
    setBell(read)
    const ids = notices.map((n) => n.id)
    const next = [...new Set([...read.filter((id) => ids.includes(id)), ...ids])]
    setRead(next); saveRead(next)
  }
  const go = (n: Notice) => { setBell(null); setTab(n.tab); setHl(n.hl) }

  // Ждём, пока страница загрузит данные, затем прокручиваем к объекту и подсвечиваем его.
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

  const update = (p: Profile | null) => { saveProfile(p); setProfile(p) }
  if (!profile) return <Welcome onDone={update} />
  const Page = TABS.find((x) => x[0] === tab)![1]
  return (
    <div id="app">
      <header>
        <button className="av" aria-label={t('profile')} aria-haspopup="dialog" onClick={() => setProfileOpen(true)}>
          {initials(profile.name)}
        </button>
        <h1>{t('appTitle')}</h1>
        <button className="bell" aria-label={t('notifications')} aria-haspopup="dialog" onClick={openBell}>
          🔔{unread > 0 && <span className="badge">{unread}</span>}
        </button>
      </header>
      {profileOpen && (
        <ProfileSheet profile={profile} onClose={() => setProfileOpen(false)}
          onLogout={() => { setProfileOpen(false); update(null) }} />
      )}
      {bell !== null && (
        <NotificationsSheet items={notices} isNew={(id) => !bell.includes(id)} onGo={go} onClose={() => setBell(null)} />
      )}
      <nav>
        {TABS.map(([id]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{t(id)}</button>
        ))}
      </nav>
      <main><Page /></main>
    </div>
  )
}
