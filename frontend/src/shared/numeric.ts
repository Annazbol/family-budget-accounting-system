export interface NumOpts { integer?: boolean; positive?: boolean; max?: number }

/** Оставляет в строке только допустимое число: цифры и один разделитель (запятая), до 2 знаков после запятой. */
export function sanitizeNumber(raw: string, o: NumOpts, prev: string): string {
  let v = raw.replace(o.integer ? /\D/g : /[^\d.,]/g, '') // буквы и символы (в том числе «-», «+», «e») отбрасываются
  if (o.integer) {
    v = v.replace(/^0+/, '')
  } else {
    v = v.replace(/\./g, ',')
    const i = v.indexOf(',')
    if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, '').slice(0, 2)
    v = v.replace(/^0+(?=\d)/, '') // «05» → «5», «00» → «0»
    if (v.startsWith(',')) v = '0' + v
    if (v === '0' && o.positive) v = prev.startsWith('0,') ? '' : '0,' // ноль в начале допустим только как «0,5»
    if (v.split(',')[0].length > 12) return prev // как Numeric(14, 2) в базе
  }
  if (o.max !== undefined && Number(v.replace(',', '.')) > o.max) return prev
  return v
}

/** При уходе из поля: убирает хвостовую запятую; пустое или нулевое значение там, где нужно больше нуля, очищает. */
export function tidyNumber(v: string, o: NumOpts): string {
  const s = v.replace(/,$/, '')
  const n = Number(s.replace(',', '.'))
  return s === '' || !Number.isFinite(n) || (o.positive && n <= 0) ? '' : s
}

/** Число для показа в поле: запятая вместо точки, без хвостов вроде 0.30000000000000004. */
export function showNumber(v: unknown): string {
  return (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v ?? '')).replace('.', ',')
}
