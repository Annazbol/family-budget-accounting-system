import { ReactNode, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useI18n } from './i18n'

export interface Opt { value: string | number; label: string }
export type Form = Record<string, string | number>
export interface Field {
  key: string
  label: string // уже переведённая подпись
  type: 'text' | 'number' | 'date' | 'select'
  options?: Opt[] | ((form: Form) => Opt[]) // функция — когда список зависит от других полей формы
  numeric?: boolean // select с числовым значением (например, category_id)
  resets?: string[] // при смене этого поля перечисленные поля сбрасываются
  emptyHint?: string // подсказка, если вариантов в списке нет
}

/** Универсальная страница: список + форма создания/редактирования + удаление. */
export default function Resource<T extends { id: number }>(props: {
  path: string
  addLabel: string
  fields: Field[]
  defaults: Form
  row: (item: T) => ReactNode
  empty: string
  renderItems?: (items: T[], renderItem: (item: T) => ReactNode) => ReactNode // свой вывод списка (например, группировка)
  onChange?: () => void // вызывается после успешного изменения данных
}) {
  const { path, fields, defaults, row, onChange } = props
  const { t, err: errText } = useI18n()
  const [items, setItems] = useState<T[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<unknown>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const load = () => api<T[]>(path).then(setItems).catch(setError)
  useEffect(() => { load() }, [path])
  useEffect(() => { if (form) formRef.current?.scrollIntoView({ block: 'nearest' }) }, [form === null, form?.id])

  const setField = (f: Field, value: string) =>
    setForm((cur) => cur && { ...cur, [f.key]: value, ...Object.fromEntries((f.resets ?? []).map((k) => [k, ''])) })

  const save = async () => {
    if (!form) return
    const body = Object.fromEntries(
      fields.map((f) => [f.key, f.type === 'number' || f.numeric ? Number(String(form[f.key]).replace(',', '.')) : form[f.key]]),
    )
    try {
      await api(form.id ? `${path}/${form.id}` : path, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setForm(null); setError(null); load(); onChange?.()
    } catch (e) { setError(e) }
  }
  const remove = async (id: number) => {
    try { await api(`${path}/${id}`, { method: 'DELETE' }); setError(null); load(); onChange?.() } catch (e) { setError(e) }
  }

  const renderItem = (it: T) => (
    <div className="li" key={it.id} data-hl={`${path.slice(1)}:${it.id}`}>
      <div className="grow">{row(it)}</div>
      <button className="ic" aria-label={t('edit')} onClick={() => setForm({ ...(it as unknown as Form) })}>✎</button>
      <button className="ic" aria-label={t('delete')} onClick={() => remove(it.id)}>✕</button>
    </div>
  )

  return (
    <>
      {error != null && <p className="err" role="alert">{errText(error)}</p>}
      <div className="card">
        {items.length === 0
          ? <p className="mut">{props.empty}</p>
          : props.renderItems ? props.renderItems(items, renderItem) : items.map(renderItem)}
      </div>
      {form ? (
        <div className="card" ref={formRef}>
          {fields.map((f) => {
            const opts = typeof f.options === 'function' ? f.options(form) : f.options ?? []
            return (
              <label key={f.key}>{f.label}
                {f.type === 'select' ? (
                  <>
                    <select value={form[f.key] ?? ''} onChange={(e) => setField(f, e.target.value)}>
                      <option value="" disabled>{t('choose')}</option>
                      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {opts.length === 0 && f.emptyHint && <small className="mut">{f.emptyHint}</small>}
                  </>
                ) : (
                  <input type={f.type} step="any" value={form[f.key] ?? ''} onChange={(e) => setField(f, e.target.value)} />
                )}
              </label>
            )
          })}
          <div className="acts">
            <button className="pri" onClick={save}>{t('save')}</button>
            <button className="gh" onClick={() => { setForm(null); setError(null) }}>{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <button className="pri wide" onClick={() => setForm({ ...defaults })}>{props.addLabel}</button>
      )}
    </>
  )
}
