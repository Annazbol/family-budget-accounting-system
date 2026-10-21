import { ReactNode, useEffect, useState } from 'react'
import { invalidate, useCollection } from './data'
import { api } from './api'
import { useI18n } from './i18n'
import Modal from './Modal'
import { sanitizeNumber, showNumber, tidyNumber } from './shared/numeric'

export interface Opt { value: string | number; label: string }
export type Form = Record<string, string | number>
export interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  options?: Opt[] | ((form: Form) => Opt[])
  numeric?: boolean // select с числовым значением (например, category_id)
  resets?: string[]
  emptyHint?: string
  required?: boolean // обязательное поле (по умолчанию — да)
  positive?: boolean // число строго больше нуля: «0» ввести нельзя
  integer?: boolean // только целые
  max?: number // наибольшее допустимое число
  maxLength?: number // длина текста
}
export interface Problem { key: string; msg: string }

/**
 * Список + кнопка добавления (+ footer) в одном блоке .res: кнопки всегда стоят сразу под окном со списком,
 * форма добавления/изменения и подтверждение удаления открываются поверх страницы (Modal).
 * Данные берутся из общего хранилища (data.ts): список запрашивается по path + query, а после изменения
 * обновляется всё, что показывает эти данные. В числовые поля можно вводить только цифры и запятую.
 */
export default function Resource<T extends { id: number }>(props: {
  path: string
  query?: string // например '?date_from=…': добавляется к адресу списка, но не к адресам изменения и удаления
  addLabel: string
  fields: Field[]
  defaults: Form
  row: (item: T) => ReactNode
  empty: string
  check?: (form: Form) => Problem | null // правила между полями (например, категория и тип операции)
  renderItems?: (items: T[], renderItem: (item: T) => ReactNode) => ReactNode
  onChange?: () => void
  footer?: ReactNode // дополнительные кнопки под кнопкой добавления
}) {
  const { path, fields, defaults, row, check, onChange } = props
  const { t, err: errText } = useI18n()
  const coll = useCollection<T>(path + (props.query ?? ''))
  const items = coll.data
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [invalid, setInvalid] = useState<Problem | null>(null)
  const [toDelete, setToDelete] = useState<T | null>(null)
  const close = () => { setForm(null); setError(null); setInvalid(null) }

  const setField = (f: Field, value: string) => {
    setInvalid(null)
    setForm((cur) => cur && { ...cur, [f.key]: value, ...Object.fromEntries((f.resets ?? []).map((k) => [k, ''])) })
  }
  const tidy = (f: Field) =>
    setForm((cur) => {
      if (!cur) return cur
      const raw = String(cur[f.key] ?? '')
      const v = tidyNumber(raw, f)
      return v === raw ? cur : { ...cur, [f.key]: v }
    })

  // Проверка перед отправкой: те же правила, что на бэкенде, но с понятным сообщением и фокусом на поле.
  const validate = (v: Form): Problem | null => {
    for (const f of fields) {
      const raw = v[f.key]
      const empty = raw === undefined || raw === null || String(raw).trim() === ''
      const miss = { key: f.key, msg: t('errFieldRequired', { f: f.label }) }
      if (empty) { if (f.required === false) continue; return miss }
      if (f.type !== 'number') continue
      const n = Number(String(raw).replace(',', '.'))
      if (!Number.isFinite(n)) return miss
      if (f.integer && !Number.isInteger(n)) return { key: f.key, msg: t('errFieldInt', { f: f.label }) }
      if (f.positive ? n <= 0 : n < 0) return { key: f.key, msg: t(f.positive ? 'errFieldPositive' : 'errFieldNonNeg', { f: f.label }) }
      if (f.max !== undefined && n > f.max) return { key: f.key, msg: t('errFieldMax', { f: f.label, n: f.max }) }
    }
    return check?.(v) ?? null
  }

  const save = async () => {
    if (!form) return
    const bad = validate(form)
    if (bad) {
      setInvalid(bad)
      document.querySelector<HTMLElement>(`[data-field="${bad.key}"]`)?.focus()
      return
    }
    const body = Object.fromEntries(
      fields.map((f) => {
        const raw = form[f.key]
        if (f.type === 'number' || f.numeric) return [f.key, Number(String(raw).replace(',', '.'))]
        return [f.key, f.type === 'text' ? String(raw ?? '').trim() : raw]
      }),
    )
    try {
      await api(form.id ? `${path}/${form.id}` : path, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setForm(null); setError(null); invalidate(path); onChange?.()
    } catch (e) { setError(e) }
  }
  const remove = async (id: number) => {
    try { await api(`${path}/${id}`, { method: 'DELETE' }); setError(null); invalidate(path); onChange?.() } catch (e) { setError(e) }
  }
  const confirmDelete = () => {
    const it = toDelete
    setToDelete(null)
    if (it) remove(it.id)
  }

  const renderItem = (it: T) => (
    <div className="li" key={it.id} data-hl={`${path.slice(1)}:${it.id}`}>
      <div className="grow">{row(it)}</div>
      <button className="ic" aria-label={t('edit')} onClick={() => setForm({ ...(it as unknown as Form) })}>✎</button>
      <button className="ic" aria-label={t('delete')} onClick={() => setToDelete(it)}>✕</button>
    </div>
  )

  const topError = error ?? coll.error
  const formMsg = invalid?.msg ?? (error != null ? errText(error) : null)
  return (
    <div className="res">
      {topError != null && form === null && <p className="err" role="alert">{errText(topError)}</p>}
      <div className="card">
        {coll.loading
          ? <p className="mut">{t('loading')}</p>
          : items.length === 0
            ? <p className="mut">{props.empty}</p>
            : props.renderItems ? props.renderItems(items, renderItem) : items.map(renderItem)}
      </div>
      <button className="pri wide" onClick={() => setForm({ ...defaults })}>{props.addLabel}</button>
      {props.footer}

      {form && (
        <Modal title={form.id ? t('edit') : props.addLabel} onClose={close} top>
          {fields.map((f) => {
            const opts = typeof f.options === 'function' ? f.options(form) : f.options ?? []
            const bad = invalid?.key === f.key
            return (
              <label key={f.key}>{f.label}
                {f.type === 'select' ? (
                  <>
                    <select data-field={f.key} aria-invalid={bad} value={form[f.key] ?? ''} onChange={(e) => setField(f, e.target.value)}>
                      <option value="" disabled>{t('choose')}</option>
                      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {opts.length === 0 && f.emptyHint && <small className="mut">{f.emptyHint}</small>}
                  </>
                ) : f.type === 'number' ? (
                  <input data-field={f.key} aria-invalid={bad} type="text" inputMode={f.integer ? 'numeric' : 'decimal'} autoComplete="off"
                    value={showNumber(form[f.key])}
                    onChange={(e) => setField(f, sanitizeNumber(e.target.value, f, showNumber(form[f.key])))}
                    onBlur={() => tidy(f)} />
                ) : f.type === 'date' ? (
                  <input data-field={f.key} aria-invalid={bad} type="date" min="2000-01-01" max="2100-12-31"
                    value={form[f.key] ?? ''} onChange={(e) => setField(f, e.target.value)} />
                ) : (
                  <input data-field={f.key} aria-invalid={bad} type="text" maxLength={f.maxLength}
                    value={form[f.key] ?? ''} onChange={(e) => setField(f, e.target.value)} />
                )}
              </label>
            )
          })}
          {formMsg && <p className="err" role="alert">{formMsg}</p>}
          <div className="acts">
            <button className="pri" onClick={save}>{t('save')}</button>
            <button className="gh" onClick={close}>{t('cancel')}</button>
          </div>
        </Modal>
      )}

      {toDelete && (
        <Modal title={t('confirmDelete')} onClose={() => setToDelete(null)} top>
          <p className="mut">{t('confirmDeleteText')}</p>
          <div className="card">{row(toDelete)}</div>
          <div className="acts">
            <button className="pri del" onClick={confirmDelete}>{t('delete')}</button>
            <button className="gh" data-autofocus onClick={() => setToDelete(null)}>{t('cancel')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
