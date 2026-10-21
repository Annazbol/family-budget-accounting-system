// Работа с датами в формате ГГГГ-ММ-ДД (локаль 'sv' даёт именно такой формат).
export const iso = (d: Date) => d.toLocaleDateString('sv')
export const today = () => iso(new Date())
export const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
