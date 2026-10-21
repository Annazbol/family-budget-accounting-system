import { api as http } from './api.http'
import { api as mock } from './api.mock'

export { ApiError } from './apiError'

/**
 * Откуда берутся данные. По умолчанию — мок в браузере (api.mock.ts, localStorage), пока бэкенд не подключён.
 * Чтобы работать с настоящим бэкендом, задайте в frontend/.env: VITE_API=http
 */
export const api: <T>(path: string, init?: RequestInit) => Promise<T> = import.meta.env.VITE_API === 'http' ? http : mock
