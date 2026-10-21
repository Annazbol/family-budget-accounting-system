import { api, ApiError } from './api'

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

const TOKEN_KEY = 'fb.token'
const USER_KEY = 'fb.user'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    if (!raw || typeof raw.id !== 'number' || typeof raw.name !== 'string') return null
    return raw as AuthUser
  } catch {
    return null
  }
}

function saveSession(token: string, user: AuthUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch { /* ignore */ }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch { /* ignore */ }
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Вход: login — email, ник или имя; проверка на сервере (mock: api.mock). */
export async function login(login: string, password: string): Promise<LoginResult> {
  const res = await api<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: login.trim(), password }),
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

/** Проверка сохранённого токена. null — сессия недействительна. */
export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken()
  if (!token) return null
  try {
    const user = await api<AuthUser>('/auth/me', { headers: authHeaders() })
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } catch { /* ignore */ }
    return user
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) clearSession()
    return null
  }
}
