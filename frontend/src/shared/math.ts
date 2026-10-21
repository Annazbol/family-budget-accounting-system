/** Процент part от whole для полосы прогресса: безопасно при нуле и некорректных значениях, всегда от 0 до 100. */
export const pct = (part: number, whole: number): number =>
  whole > 0 && Number.isFinite(part) ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0
