import * as SecureStore from 'expo-secure-store'
import { api } from './api'
import { ApiError } from './apiError'

const TOKEN_KEY = 'fb.token'
const USER_KEY = 'fb.user'

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

type Listener = () => void
const listeners = new Set<Listener>()

export function onUnauthorized(cb: Listener): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export async function notifyUnauthorized(): Promise<void> {
  await clearSession()
  listeners.forEach((cb) => cb())
}

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await SecureStore.deleteItemAsync(USER_KEY)
  } catch { /* ignore */ }
}

async function saveSession(token: string, user: AuthUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
}

export async function login(loginValue: string, password: string): Promise<LoginResult> {
  const res = await api<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginValue.trim(), password }),
  })
  await saveSession(res.token, res.user)
  return res
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' })
  } catch { /* ignore */ }
  await clearSession()
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = await getToken()
  if (!token) return null
  try {
    const user = await api<AuthUser>('/auth/me')
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
    return user
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      await clearSession()
    }
    return null
  }
}

export interface RegisterStartResult {
  ok: boolean
  email: string
  dev_code?: string
}

export async function registerStart(data: {
  name: string
  login: string
  email: string
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
    body: JSON.stringify({ email: email.trim(), code: code.trim() }),
  })
  await saveSession(res.token, res.user)
  return res
}
