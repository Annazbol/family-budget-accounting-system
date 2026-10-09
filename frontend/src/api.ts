import type { Category, Operation, Goal, Debt, Loan, RatesData } from './types'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ---------- in-memory store + localStorage ----------

const STORE_KEY = 'family-budget-mock'

interface Store {
  categories: Category[]
  operations: Operation[]
  goals: Goal[]
  debts: Debt[]
  loans: Loan[]
  nextId: number
}

const SEED: Store = {
  nextId: 20,
  categories: [
    { id: 1, type: 'i', name: 'Зарплата' },
    { id: 2, type: 'i', name: 'Фриланс' },
    { id: 3, type: 'e', name: 'Продукты' },
    { id: 4, type: 'e', name: 'Транспорт' },
    { id: 5, type: 'e', name: 'Жильё' },
    { id: 6, type: 'e', name: 'Развлечения' },
  ],
  operations: [
    { id: 1, type: 'i', name: 'Оклад', amount: 120000, currency: 'RUB', date: daysAgo(5), category_id: 1, note: '' },
    { id: 2, type: 'e', name: 'Магнит', amount: 4500, currency: 'RUB', date: daysAgo(3), category_id: 3, note: 'Еженедельные покупки' },
    { id: 3, type: 'e', name: 'Метро', amount: 2500, currency: 'RUB', date: daysAgo(2), category_id: 4, note: '' },
    { id: 4, type: 'e', name: 'Аренда', amount: 45000, currency: 'RUB', date: daysAgo(1), category_id: 5, note: 'Октябрь' },
    { id: 5, type: 'i', name: 'Проект', amount: 300, currency: 'USD', date: daysAgo(7), category_id: 2, note: 'Дизайн лендинга' },
    { id: 6, type: 'e', name: 'Кино', amount: 1200, currency: 'RUB', date: daysAgo(4), category_id: 6, note: '' },
  ],
  goals: [
    { id: 10, name: 'Отпуск', target: 150000, saved: 42000, currency: 'RUB', due: daysFromNow(90) },
    { id: 11, name: 'Ноутбук', target: 1200, saved: 400, currency: 'USD', due: daysFromNow(60) },
  ],
  debts: [
    { id: 12, direction: 'owe', amount: 15000, currency: 'RUB', due: daysFromNow(14), note: 'Другу за ужин' },
    { id: 13, direction: 'owed', amount: 5000, currency: 'RUB', due: daysFromNow(30), note: 'Вернут за билеты' },
  ],
  loans: [
    { id: 14, name: 'Ипотека', initial: 3500000, current: 2800000, rate: 12.5, payment: 42000, currency: 'RUB', day: 15 },
  ],
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('sv')
}

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv')
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    /* ignore */
  }
  return structuredClone(SEED)
}

function saveStore(s: Store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s))
}

let store = loadStore()

type Collection = 'categories' | 'operations' | 'goals' | 'debts' | 'loans'

const COLLECTIONS: Collection[] = ['categories', 'operations', 'goals', 'debts', 'loans']

function collectionOf(path: string): Collection | null {
  const name = path.replace(/^\//, '').split('/')[0]
  return COLLECTIONS.includes(name as Collection) ? (name as Collection) : null
}

function parseId(path: string): number | null {
  const parts = path.replace(/^\//, '').split('/')
  if (parts.length < 2) return null
  const n = Number(parts[1])
  return Number.isFinite(n) ? n : null
}

function delay(ms = 80): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------- rates (same demo as backend) ----------

function mockRates(): RatesData {
  const BASE: Record<string, number> = { USD: 1, EUR: 0.92, RUB: 95, KZT: 480, BYN: 3.3 }
  const today = new Date()
  const history: Record<string, Record<string, number>> = {}
  for (let n = 0; n < 366; n++) {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    const key = d.toLocaleDateString('sv')
    history[key] = {}
    let i = 0
    for (const [c, v] of Object.entries(BASE)) {
      history[key][c] = c === 'USD' ? 1 : Math.round(v * (1 + 0.04 * Math.sin(n / 6 + i)) * 10000) / 10000
      i++
    }
  }
  const date = today.toLocaleDateString('sv')
  return { date, rates: history[date], history }
}

// ---------- mock API ----------

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  await delay()

  const method = (init?.method ?? 'GET').toUpperCase()
  let body: Record<string, unknown> | null = null
  if (init?.body && typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body)
    } catch {
      throw new ApiError(400, 'bad request')
    }
  }

  // rates
  if (path === '/rates' && method === 'GET') {
    return mockRates() as T
  }

  const col = collectionOf(path)
  if (!col) throw new ApiError(404, 'not found')

  const id = parseId(path)
  const list = store[col] as { id: number }[]

  if (method === 'GET' && id === null) {
    return [...list].sort((a, b) => a.id - b.id) as T
  }

  if (method === 'GET' && id !== null) {
    const item = list.find((x) => x.id === id)
    if (!item) throw new ApiError(404, 'not found')
    return item as T
  }

  if (method === 'POST' && id === null) {
    if (!body) throw new ApiError(400, 'bad request')
    const item = { ...body, id: store.nextId++ } as { id: number }
    ;(store[col] as { id: number }[]).push(item)
    saveStore(store)
    return item as T
  }

  if ((method === 'PUT' || method === 'PATCH') && id !== null) {
    if (!body) throw new ApiError(400, 'bad request')
    const idx = list.findIndex((x) => x.id === id)
    if (idx < 0) throw new ApiError(404, 'not found')
    const updated = { ...list[idx], ...body, id }
    list[idx] = updated
    saveStore(store)
    return updated as T
  }

  if (method === 'DELETE' && id !== null) {
    const idx = list.findIndex((x) => x.id === id)
    if (idx < 0) throw new ApiError(404, 'not found')
    list.splice(idx, 1)
    saveStore(store)
    return undefined as T
  }

  throw new ApiError(404, 'not found')
}

/** Сбросить все моковые данные к начальным (удобно для отладки). */
export function resetMockData() {
  store = structuredClone(SEED)
  saveStore(store)
}
