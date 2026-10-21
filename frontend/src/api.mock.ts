import type { Category, Operation, Goal, Debt, Loan, RatesData } from './types'

import { ApiError } from './apiError'
export { ApiError }

// Мок сервера (включён по умолчанию, см. api.ts): данные хранятся в localStorage. Это эталонная реализация контракта API (docs/API.md): правила проверки и коды ошибок такие же, какими их должен отдавать сервер.
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

type Collection = 'categories' | 'operations' | 'goals' | 'debts' | 'loans'
const COLLECTIONS: Collection[] = ['categories', 'operations', 'goals', 'debts', 'loans']
type Rec = Record<string, any>

/**
 * Значения по умолчанию для данных, которых нет: отсутствующие поля старых записей заполняются
 * (валюта RUB, пустое название и комментарий, накоплено 0, день платежа 1), а если список целиком
 * отсутствует или файл повреждён — берутся демо-данные.
 */
function normalize(raw: unknown): Store {
  const r: Rec = raw && typeof raw === 'object' ? (raw as Rec) : {}
  const list = <K extends Collection>(k: K, fill: (x: Rec) => Rec): Store[K] =>
    (Array.isArray(r[k])
      ? r[k].filter((x: unknown) => x && typeof x === 'object').map(fill)
      : structuredClone(SEED[k])) as Store[K]
  const base = {
    categories: list('categories', (c) => c),
    operations: list('operations', (o) => ({ ...o, name: o.name ?? '', currency: o.currency ?? 'RUB', note: o.note ?? '' })),
    goals: list('goals', (g) => ({ ...g, saved: g.saved ?? 0, currency: g.currency ?? 'RUB' })),
    debts: list('debts', (d) => ({ ...d, note: d.note ?? '', currency: d.currency ?? 'RUB' })),
    loans: list('loans', (l) => ({ ...l, day: l.day ?? 1, currency: l.currency ?? 'RUB' })),
  }
  const ids = COLLECTIONS.flatMap((c) => (base[c] as { id: number }[]).map((x) => Number(x.id) + 1))
  return { ...base, nextId: Math.max(Number(r.nextId) || 1, ...ids) }
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch {
    // повреждённые данные — начинаем с демо-данных
  }
  return structuredClone(SEED)
}

function saveStore(s: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    // хранилище недоступно или переполнено — данные останутся только до перезагрузки
  }
}

let store = loadStore()

// ---------- проверка данных (как pydantic-схемы на бэкенде) ----------
const bad = () => new ApiError(422, 'validation')
const CURRENCIES = ['RUB', 'USD', 'EUR', 'KZT', 'BYN'] as const
const KINDS = ['i', 'e'] as const

const str = (v: unknown, min: number, max: number): string => {
  if (typeof v !== 'string' || v.length < min || v.length > max) throw bad()
  return v
}
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T => {
  if (!allowed.includes(v as T)) throw bad()
  return v as T
}
const dec = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isFinite(n)) throw bad()
  return n
}
/** Сумма: больше нуля (или не меньше нуля с allowZero), округление до копеек как в Numeric(.., 2). */
const amount = (v: unknown, o: { allowZero?: boolean; max?: number } = {}): number => {
  const n = dec(v)
  if (o.allowZero ? n < 0 : n <= 0) throw bad()
  if (o.max !== undefined && n > o.max) throw bad()
  return Math.round(n * 100) / 100
}
const int = (v: unknown, min: number, max: number): number => {
  const n = dec(v)
  if (!Number.isInteger(n) || n < min || n > max) throw bad()
  return n
}
const isoDate = (v: unknown): string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad()
  const d = new Date(v + 'T00:00:00Z')
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw bad()
  return v
}

const SCHEMAS: Record<Collection, (b: Rec) => Rec> = {
  categories: (b) => ({ type: pick(b.type, KINDS), name: str(b.name, 1, 100) }),
  operations: (b) => ({
    type: pick(b.type, KINDS), name: str(b.name, 1, 100), amount: amount(b.amount),
    currency: pick(b.currency ?? 'RUB', CURRENCIES), date: isoDate(b.date),
    category_id: int(b.category_id, -Infinity, Infinity), note: str(b.note ?? '', 0, 255),
  }),
  goals: (b) => ({
    name: str(b.name, 1, 100), target: amount(b.target), saved: amount(b.saved ?? 0, { allowZero: true }),
    currency: pick(b.currency ?? 'RUB', CURRENCIES), due: isoDate(b.due),
  }),
  debts: (b) => ({
    direction: pick(b.direction, ['owe', 'owed'] as const), amount: amount(b.amount),
    currency: pick(b.currency ?? 'RUB', CURRENCIES), due: isoDate(b.due), note: str(b.note ?? '', 0, 255),
  }),
  loans: (b) => ({
    name: str(b.name, 1, 100), initial: amount(b.initial), current: amount(b.current, { allowZero: true }),
    rate: amount(b.rate, { allowZero: true, max: 100 }), payment: amount(b.payment),
    currency: pick(b.currency ?? 'RUB', CURRENCIES), day: int(b.day ?? 1, 1, 28),
  }),
}
// Правило между полями: текущая задолженность не больше первоначальной суммы (422, как model_validator на бэкенде).
const LOAN_CHECK = (d: Rec) => { if (d.current > d.initial) throw bad() }

/**
 * Бизнес-правила (см. docs/API.md): категория операции должна существовать (409) и подходить по типу (422);
 * тип категории нельзя менять, пока в ней есть операции (409). obj — существующая запись при PUT.
 */
function checkRules(col: Collection, data: Rec, obj?: Rec) {
  if (col === 'loans') LOAN_CHECK(data)
  if (col === 'operations') {
    const cat = store.categories.find((c) => c.id === data.category_id)
    if (!cat) throw new ApiError(409, 'integrity')
    if (cat.type !== data.type) throw bad()
  }
  if (col === 'categories' && obj && obj.type !== data.type && store.operations.some((o) => o.category_id === obj.id)) {
    throw new ApiError(409, 'integrity')
  }
}

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

/** Фильтры GET /operations (как у бэкенда): date_from, date_to, type, category_id; неверные значения — 422. */
function opFilter(q: URLSearchParams): (o: Operation) => boolean {
  const from = q.get('date_from') !== null ? isoDate(q.get('date_from')) : null
  const to = q.get('date_to') !== null ? isoDate(q.get('date_to')) : null
  const kind = q.get('type') !== null ? pick(q.get('type'), KINDS) : null
  const cat = q.get('category_id') !== null ? int(q.get('category_id'), -Infinity, Infinity) : null
  return (o) => (!from || o.date >= from) && (!to || o.date <= to) && (!kind || o.type === kind) && (cat === null || o.category_id === cat)
}

/** GET /operations/totals: суммы по типу, валюте, дате и категории. */
function opTotals(list: Operation[]) {
  const g = new Map<string, { type: string; currency: string; date: string; category_id: number; amount: number }>()
  for (const o of list) {
    const k = `${o.type}|${o.currency}|${o.date}|${o.category_id}`
    const row = g.get(k) ?? { type: o.type, currency: o.currency, date: o.date, category_id: o.category_id, amount: 0 }
    row.amount = Math.round((row.amount + o.amount) * 100) / 100
    g.set(k, row)
  }
  return [...g.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function delay(ms = 80): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

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

// ---------- auth (мок: пользователи в памяти; на бэке — БД + хеш пароля) ----------
/** Демо-аккаунты. Пароли только для mock; на сервере хранится password_hash. */
const MOCK_USERS = [
  { id: 1, name: 'Анна', email: 'anna@example.com', login: 'anna', password: 'demo123' },
  { id: 2, name: 'Иван', email: 'ivan@example.com', login: 'ivan', password: 'pass1234' },
] as const

/** token → userId; в реальном API — JWT или Redis-сессия. */
const sessions = new Map<string, number>()

function bearerUserId(init?: RequestInit): number | null {
  const h = init?.headers
  let auth = ''
  if (h instanceof Headers) auth = h.get('Authorization') || ''
  else if (Array.isArray(h)) auth = h.find(([k]) => k.toLowerCase() === 'authorization')?.[1] || ''
  else if (h && typeof h === 'object') auth = (h as Record<string, string>).Authorization || (h as Record<string, string>).authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(auth)
  if (!m) return null
  return sessions.get(m[1]) ?? null
}

function publicUser(u: (typeof MOCK_USERS)[number]) {
  return { id: u.id, name: u.name, email: u.email, login: u.login }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  await delay()
  if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const method = (init?.method ?? 'GET').toUpperCase()
  let body: Rec | null = null
  if (init?.body && typeof init.body === 'string') {
    try {
      const parsed = JSON.parse(init.body)
      body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      throw new ApiError(422, 'validation')
    }
  }

  const [pathname, query = ''] = path.split('?')

  // POST /auth/login — { login, password }; login = email | ник | имя
  if (pathname === '/auth/login' && method === 'POST') {
    const loginRaw = typeof body?.login === 'string' ? body.login.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!loginRaw || !password) throw new ApiError(422, 'validation')
    const key = loginRaw.toLowerCase()
    const user = MOCK_USERS.find(
      (u) => u.login.toLowerCase() === key || u.email.toLowerCase() === key || u.name.toLowerCase() === key,
    )
    // Одинаковое сообщение при неверном логине и пароле (как на бэке)
    if (!user || user.password !== password) throw new ApiError(401, 'unauthorized')
    const token = `mock-${user.id}-${Date.now()}`
    sessions.set(token, user.id)
    return { token, user: publicUser(user) } as T
  }

  if (pathname === '/auth/logout' && method === 'POST') {
    const h = init?.headers
    let auth = ''
    if (h instanceof Headers) auth = h.get('Authorization') || ''
    else if (h && typeof h === 'object' && !Array.isArray(h)) auth = (h as Record<string, string>).Authorization || ''
    const m = /^Bearer\s+(.+)$/i.exec(auth)
    if (m) sessions.delete(m[1])
    return undefined as T
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const uid = bearerUserId(init)
    if (uid == null) throw new ApiError(401, 'unauthorized')
    const user = MOCK_USERS.find((u) => u.id === uid)
    if (!user) throw new ApiError(401, 'unauthorized')
    return publicUser(user) as T
  }

  if (path === '/rates' || pathname === '/rates') {
    if (method === 'GET') return mockRates() as T
  }

  const col = collectionOf(pathname)
  if (!col) throw new ApiError(404, 'not found')

  // Итоги операций: GET /operations/totals?date_from=&date_to=&type=&category_id=
  if (col === 'operations' && pathname === '/operations/totals' && method === 'GET') {
    return opTotals(store.operations.filter(opFilter(new URLSearchParams(query)))) as T
  }

  const id = parseId(pathname)
  const list = store[col] as { id: number }[]

  // Набор операций такой же, как у бэкенда: GET список (операции — с фильтрами), POST, PUT /{id}, DELETE /{id}.
  if (method === 'GET' && id === null) {
    const rows = col === 'operations' ? store.operations.filter(opFilter(new URLSearchParams(query))) : list
    return [...rows].sort((a, b) => a.id - b.id) as T
  }

  if (method === 'POST' && id === null) {
    const data = SCHEMAS[col](body ?? {}) // сначала проверка данных (422)
    checkRules(col, data) // затем бизнес-правила (409/422)
    const item = { ...data, id: store.nextId++ }
    list.push(item)
    saveStore(store)
    return item as T
  }

  if (method === 'PUT' && id !== null) {
    const data = SCHEMAS[col](body ?? {}) // как на сервере: 422 приходит раньше, чем 404
    const idx = list.findIndex((x) => x.id === id)
    if (idx < 0) throw new ApiError(404, 'not found')
    checkRules(col, data, list[idx])
    list[idx] = { ...data, id } // PUT заменяет запись целиком
    saveStore(store)
    return list[idx] as T
  }

  if (method === 'DELETE' && id !== null) {
    const idx = list.findIndex((x) => x.id === id)
    if (idx < 0) throw new ApiError(404, 'not found')
    // Категорию с операциями удалить нельзя (ondelete="RESTRICT" в базе).
    if (col === 'categories' && store.operations.some((o) => o.category_id === id)) throw new ApiError(409, 'integrity')
    list.splice(idx, 1)
    saveStore(store)
    return undefined as T
  }

  throw new ApiError(405, 'method not allowed')
}

export function resetMockData() {
  store = structuredClone(SEED)
  saveStore(store)
}
