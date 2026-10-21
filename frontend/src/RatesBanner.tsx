import { useI18n } from './i18n'
import { useRates } from './rates'

/** Предупреждение, если курсы не удалось обновить: показывает, какие курсы используются, и кнопку «Повторить». */
export default function RatesBanner() {
  const { failed, data, retry } = useRates()
  const { t, date } = useI18n()
  if (!failed) return null
  return (
    <div className="banner" role="alert">
      <span>{data ? t('ratesStale', { d: date(data.date) }) : t('ratesFail')}</span>
      <button className="gh" onClick={retry}>{t('retry')}</button>
    </div>
  )
}

/** Значок ⚠ рядом с суммой, которую нельзя пересчитать (нет курса): сумма показана как есть, без пересчёта. */
export function Warn({ show }: { show: boolean }) {
  const { t } = useI18n()
  if (!show) return null
  return <span className="warn" role="img" aria-label={t('noRate')} title={t('noRate')}>⚠</span>
}
