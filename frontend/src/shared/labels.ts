import type { Key } from '../i18n'

export const SYS_CAT_GOALS = 'system.goals'
export const SYS_CAT_LOANS = 'system.loans'

type TFn = (k: Key, vars?: Record<string, string | number>) => string

export function categoryLabel(name: string, t: TFn): string {
  if (!name) return '—'
  if (name === SYS_CAT_GOALS || name === 'system.goals') return t('catSystemGoals')
  if (name === SYS_CAT_LOANS || name === 'system.loans') return t('catSystemLoans')
  if (name.startsWith('system.')) {
    // запасной вариант для новых системных ключей
    const tail = name.slice('system.'.length)
    if (tail === 'goals') return t('catSystemGoals')
    if (tail === 'loans') return t('catSystemLoans')
  }
  return name
}

export function operationTitle(
  o: { name: string; note?: string; source_type?: string | null; locked?: boolean },
  t: TFn,
): string {
  if (o.source_type === 'goal' || o.name.startsWith('goal:')) {
    return `${t('opSystemGoal')}${o.note ? `: ${o.note}` : ''}`
  }
  if (o.source_type === 'loan' || o.name.startsWith('loan:')) {
    return `${t('opSystemLoan')}${o.note ? `: ${o.note}` : ''}`
  }
  return o.name || ''
}
