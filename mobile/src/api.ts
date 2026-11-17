import { API_URL } from './config'
import { ApiError } from './apiError'
import { getToken, notifyUnauthorized } from './auth'

async function readBody(r: Response): Promise<string> {
  try {
    return await r.text()
  } catch {
    return ''
  }
}

/** HTTP-клиент к тому же бэкенду, что и веб. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  const token = await getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const url = API_URL + path
  let r: Response
  try {
    r = await fetch(url, { ...init, headers })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    console.error('[api] network error', { url, method: init?.method || 'GET', error: e })
    throw new ApiError(0, 'network')
  }

  if (r.status === 401) {
    const body = await readBody(r)
    console.error('[api] unauthorized', { url, status: 401, body })
    const isLogin = path.includes('/auth/login')
    if (!isLogin) await notifyUnauthorized()
    throw new ApiError(401, body || 'unauthorized')
  }

  if (!r.ok) {
    const body = await readBody(r)
    console.error('[api] server error', {
      url,
      method: init?.method || 'GET',
      status: r.status,
      statusText: r.statusText,
      body,
    })
    throw new ApiError(r.status, body || r.statusText)
  }

  return r.status === 204 ? (undefined as T) : r.json()
}
