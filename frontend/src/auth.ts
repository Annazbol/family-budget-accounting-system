import { api } from './api'
import { ApiError } from './apiError'

const TOKEN_KEY = 'fb.token'
const USER_KEY = 'fb.user'

/** localStorage: сессия сохраняется после закрытия браузера (до истечения JWT / logout). */
const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key) ?? sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, val: string) {
    try {
      localStorage.setItem(key, val)
      sessionStorage.removeItem(key) // убираем старую sessionStorage-сессию
    } catch { /* ignore */ }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch { /* ignore */ }
  },
}

export interface AuthUser {
  id: number
  name: string
  email: string
  login: string
}

export interface LoginResult {
  token: string
  user: AuthUser
}

export function getToken(): string | null {
  return store.get(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = JSON.parse(store.get(USER_KEY) || 'null')
    if (raw && typeof raw === 'object' && typeof raw.name === 'string') return raw as AuthUser
  } catch { /* ignore */ }
  return null
}

export function clearSession(): void {
  store.remove(TOKEN_KEY)
  store.remove(USER_KEY)
}

function saveSession(token: string, user: AuthUser) {
  store.set(TOKEN_KEY, token)
  store.set(USER_KEY, JSON.stringify(user))
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type AuthListener = () => void
const unauthListeners = new Set<AuthListener>()

export function onUnauthorized(cb: AuthListener): () => void {
  unauthListeners.add(cb)
  return () => { unauthListeners.delete(cb) }
}

export function notifyUnauthorized(): void {
  clearSession()
  unauthListeners.forEach((cb) => cb())
}

/** Вход: email или ник. */
export async function login(loginValue: string, password: string): Promise<LoginResult> {
  const res = await api<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginValue.trim(), password }),
  })
  saveSession(res.token, res.user)
  return res
}

export interface RegisterStartResult {
  email: string
  message: string
  dev_code?: string | null
}

export async function registerStart(data: {
  email: string
  login: string
  name: string
  password: string
}): Promise<RegisterStartResult> {
  return api<RegisterStartResult>('/auth/register/start', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function registerResend(email: string): Promise<RegisterStartResult> {
  return api<RegisterStartResult>('/auth/register/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function registerConfirm(email: string, code: string): Promise<LoginResult> {
  const res = await api<LoginResult>('/auth/register/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, code: code.trim() }),
  })
  saveSession(res.token, res.user)
  return res
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST', headers: authHeaders() })
  } catch {
    // сеть упала — локальную сессию всё равно сбрасываем
  }
  clearSession()
}

/** Проверка сессии: cookie и/или Bearer. */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const user = await api<AuthUser>('/auth/me', { headers: authHeaders() })
    try { store.set(USER_KEY, JSON.stringify(user)) } catch { /* ignore */ }
    return user
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) clearSession()
    return null
  }
}
