import { api as http } from './api.http'
import { api as mock } from './api.mock'

export { ApiError } from './apiError'

/** VITE_API=http → бэкенд, иначе мок. */
export const api: typeof http = import.meta.env.VITE_API === 'http' ? http : mock
