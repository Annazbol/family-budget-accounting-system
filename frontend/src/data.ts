import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api'

/**
 * Общее хранилище данных: каждый адрес (например '/operations?date_from=…') загружается один раз и делится между
 * всеми компонентами. После изменения данных вызывается invalidate('/operations') — и всё, что показывает операции
 * (список, итоги на главной, уведомления), обновляется само. Устаревшие ответы отбрасываются (AbortController).
 */
export interface Entry<T = unknown> { data: T[] | undefined; error: unknown; loading: boolean }

const EMPTY: Entry = { data: undefined, error: null, loading: true }
const EMPTY_LIST: never[] = []
const entries = new Map<string, Entry>()
const inflight = new Map<string, AbortController>()
const refs = new Map<string, number>() // сколько компонентов сейчас показывают адрес
const listeners = new Set<() => void>()

const put = (key: string, e: Entry) => { entries.set(key, e); listeners.forEach((l) => l()) }

export const getEntry = (key: string): Entry => entries.get(key) ?? EMPTY
export const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }

/** (Пере)загружает адрес; предыдущий незавершённый запрос отменяется, его ответ не попадёт в хранилище. */
export function load(key: string) {
  inflight.get(key)?.abort()
  const ac = new AbortController()
  inflight.set(key, ac)
  put(key, { data: entries.get(key)?.data, error: null, loading: true })
  api<unknown[]>(key, { signal: ac.signal })
    .then((data) => {
      if (inflight.get(key) !== ac) return
      inflight.delete(key)
      put(key, { data, error: null, loading: false })
    })
    .catch((error) => {
      if (ac.signal.aborted || inflight.get(key) !== ac) return
      inflight.delete(key)
      put(key, { data: entries.get(key)?.data, error, loading: false })
    })
}

/**
 * Данные устарели: все адреса, начинающиеся с base ('/operations', '/operations?…', '/operations/totals'),
 * которые сейчас на экране, загружаются заново, а остальные забываются и загрузятся при следующем показе.
 */
export function invalidate(...bases: string[]) {
  for (const key of [...entries.keys()]) {
    if (!bases.some((b) => key === b || key.startsWith(b + '?') || key.startsWith(b + '/'))) continue
    if (refs.get(key)) load(key); else entries.delete(key)
  }
}

export function retain(key: string): () => void {
  refs.set(key, (refs.get(key) ?? 0) + 1)
  if (!inflight.has(key)) load(key) // сохранённое показываем сразу и обновляем в фоне
  return () => {
    const n = (refs.get(key) ?? 1) - 1
    if (n > 0) refs.set(key, n); else refs.delete(key)
  }
}

/** Сброс кэша (например после logout), чтобы следующий пользователь не видел чужие данные. */
export function clearAll() {
  for (const ac of inflight.values()) ac.abort()
  inflight.clear()
  entries.clear()
  refs.clear()
  listeners.forEach((l) => l())
}

export function useCollection<T>(key: string) {
  const entry = useSyncExternalStore(subscribe, () => getEntry(key)) as Entry<T>
  useEffect(() => retain(key), [key])
  return {
    data: entry.data ?? (EMPTY_LIST as T[]),
    error: entry.error,
    loading: entry.loading && entry.data === undefined, // true только пока данных ещё нет совсем
    reload: () => load(key),
  }
}
