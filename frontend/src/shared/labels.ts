/** Стабильные ключи системных категорий (как на бэкенде). */
export const SYS_CAT_GOALS = 'system.goals'
export const SYS_CAT_LOANS = 'system.loans'

export function categoryLabel(name: string, t: (k: string) => string): string {
  if (name === SYS_CAT_GOALS) return t('catSystemGoals')
  if (name === SYS_CAT_LOANS) return t('catSystemLoans')
  return name
}

export function operationTitle(o: { name: string; note?: string; source_type?: string | null; locked?: boolean }, t: (k: string) => string): string {
  if (o.source_type === 'goal' || o.name.startsWith('goal:')) {
    return `${t('opSystemGoal')}${o.note ? `: ${o.note}` : ''}`
  }
  if (o.source_type === 'loan' || o.name.startsWith('loan:')) {
    return `${t('opSystemLoan')}${o.note ? `: ${o.note}` : ''}`
  }
  return o.name || ''
}
