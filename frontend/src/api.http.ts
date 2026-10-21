import { ApiError } from './apiError'
import { clearSession, getToken } from './auth'

const BASE: string = import.meta.env.VITE_API_BASE || '/api'

/**
 * Запросы к настоящему серверу. Контракт — docs/API.md.
 * Подставляет Authorization: Bearer <token>, при 401 сбрасывает сессию.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let r: Response
  try {
    r = await fetch(BASE + path, { ...init, headers })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'network')
  }
  if (r.status === 401) {
    clearSession()
    throw new ApiError(401, 'unauthorized')
  }
  if (!r.ok) throw new ApiError(r.status, r.statusText)
  return r.status === 204 ? (undefined as T) : r.json()
}
