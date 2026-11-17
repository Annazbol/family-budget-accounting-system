import { api as http } from './api.http'
import { api as mock } from './api.mock'

export { ApiError } from './apiError'

/**
 * VITE_API=http → реальный бэкенд.
 * Иначе → мок (нужен файл api.mock.ts).
 */
export const api: typeof http = import.meta.env.VITE_API === 'http' ? http : mock
