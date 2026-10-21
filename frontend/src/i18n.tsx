import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { CURRENCIES, Currency } from './types'

const ru = {
  appTitle: 'Семейный бюджет', home: 'Главная', operations: 'Операции', goals: 'Цели', debts: 'Долги', loans: 'Кредиты',
  week: 'Неделя', month: 'Месяц', year: 'Год', allTime: 'Всё время', customPeriod: 'Свой период', period: 'Период', from: 'С', to: 'По',
  balance: 'Общий баланс', balancePeriod: 'Баланс за период', loading: 'Загрузка…', income: 'Доходы', expense: 'Расходы', incomeOne: 'Доход', expenseOne: 'Расход',
  incomeShort: 'доход', expenseShort: 'расход', byCategory: 'Расходы по категориям', noExpenses: 'Нет расходов за период.',
  type: 'Тип', amount: 'Сумма', date: 'Дата', category: 'Категория', note: 'Комментарий', name: 'Название', ccy: 'Валюта',
  addOp: 'Добавить операцию', noOps: 'Операций пока нет.', noOpsPeriod: 'За этот период операций нет.',
  viewList: 'Каждая операция', viewGrouped: 'По категориям', opsN: 'Операций: {n}',
  manageCategories: 'Изменить категории', hideCategories: 'Скрыть категории',
  addCategory: 'Добавить категорию', noCategories: 'Категорий нет.', catName: 'Название',
  noCatsOfType: 'Нет категорий этого типа. Создайте её в разделе «Изменить категории» ниже.',
  target: 'Необходимая сумма', saved: 'Уже отложено', due: 'Срок', addGoal: 'Добавить цель', noGoals: 'Целей пока нет.', until: 'до', of: 'из',
  who: 'Кто должен', iOwe: 'Я должен', owedMe: 'Мне должны', dueBack: 'Срок возврата', addDebt: 'Добавить долг', noDebts: 'Долгов нет.',
  loanName: 'Наименование', initial: 'Первоначальная сумма', current: 'Текущая задолженность', rate: 'Ставка, % годовых',
  payment: 'Регулярный платёж', payDay: 'День платежа (1–28)', addLoan: 'Добавить кредит', noLoans: 'Кредитов нет.',
  active: 'активен', closed: 'закрыт', rest: 'Остаток', paymentShort: 'платёж',
  save: 'Сохранить', cancel: 'Отмена', edit: 'Изменить', delete: 'Удалить', choose: 'Выберите…',
  confirmDelete: 'Удалить запись?', confirmDeleteText: 'Это действие нельзя отменить.',
  errFieldRequired: 'Заполните поле «{f}».', errFieldPositive: 'Поле «{f}» должно быть больше нуля.',
  errFieldNonNeg: 'Поле «{f}» не может быть отрицательным.', errFieldInt: 'Поле «{f}» должно быть целым числом.',
  errFieldMax: 'Поле «{f}» не должно быть больше {n}.',
  errNetwork: 'Нет связи с сервером.', errNotFound: 'Запись не найдена.',
  errConflict: 'Нельзя удалить: запись используется (например, категория с операциями).',
  errValidation: 'Проверьте введённые данные.', errServer: 'Ошибка сервера. Попробуйте позже.',
  profile: 'Профиль', currency: 'Валюта бюджета', rateNote: 'Все суммы пересчитываются по курсу.',
  calcLabel: 'Итоги и баланс считать', calcHist: 'На дату операции', calcNow: 'По текущему',
  ratesOn: 'Курсы на {d}', ratesFail: 'Курсы недоступны — суммы в других валютах показаны без пересчёта.',
  ratesStale: 'Не удалось обновить курсы, используются сохранённые на {d}.', retry: 'Повторить',
  noRate: 'Нет курса — сумма показана без пересчёта',
  errCatType: 'Категория не подходит к типу операции.', errLoanDebt: 'Текущая задолженность не может быть больше первоначальной суммы.',
  csvFormat: 'Формат CSV', csvRu: 'Excel (Россия): «;» и запятая', csvIntl: 'Международный: «,» и точка',
  asOfDate: 'на дату', now: 'сейчас', budgetAtDate: 'Сумма в валюте бюджета (на дату)', budgetNow: 'Сумма в валюте бюджета (по текущему курсу)',
  theme: 'Тема', themeAuto: 'Авто', themeLight: 'Светлая', themeDark: 'Тёмная', exportCsv: 'Экспорт операций (CSV)',
  logout: 'Выйти из профиля', close: 'Закрыть', welcome: 'Добро пожаловать',
  welcomeText: 'Войдите по email, нику или имени и паролю. Проверка на сервере (сейчас — демо-мок).',
  start: 'Войти', nameRequired: 'Введите имя.',
  yourName: 'Ваше имя', email: 'Эл. почта (необязательно)',
  loginLabel: 'Email, ник или имя', passwordLabel: 'Пароль',
  loginRequired: 'Введите логин.', passwordRequired: 'Введите пароль.',
  errAuth: 'Неверный логин или пароль.',
  loginHint: 'Демо: anna / demo123 или ivan / pass1234',
  notifications: 'Уведомления', noNotif: 'В ближайшие 14 дней платежей нет.', overdue: 'просрочено', newItem: 'Новое',
  repayDebt: 'Вернуть долг', owedToYou: 'Вам должны вернуть', loanPayment: 'Платёж по кредиту', goalDeadline: 'Срок цели',
}
export type Key = keyof typeof ru
export type Theme = 'auto' | 'light' | 'dark'
export type Calc = 'hist' | 'now'
export type Csv = 'ru' | 'intl'
export const LOCALE = 'ru-RU'
interface Settings { currency: Currency; calc: Calc; theme: Theme; csv: Csv }

interface Ctx extends Settings {
  set: (p: Partial<Settings>) => void
  t: (k: Key, vars?: Record<string, string | number>) => string
  money: (n: number) => string
  moneyIn: (n: number, c: string) => string
  date: (iso: string) => string
  err: (e: unknown) => string
}
const C = createContext<Ctx | null>(null)
export function useI18n() {
  const c = useContext(C)
  if (!c) throw new Error('SettingsProvider is missing')
  return c
}

const KEY = 'fb.settings'
const DEFAULTS: Settings = { currency: 'RUB', calc: 'hist', theme: 'auto', csv: 'ru' }
// Значения по умолчанию, если сохранённых настроек нет или в них неверные значения.
function load(): Settings {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      currency: (CURRENCIES as readonly string[]).includes(p.currency) ? p.currency : DEFAULTS.currency,
      calc: p.calc === 'now' || p.calc === 'hist' ? p.calc : DEFAULTS.calc,
      theme: p.theme === 'light' || p.theme === 'dark' || p.theme === 'auto' ? p.theme : DEFAULTS.theme,
      csv: p.csv === 'intl' || p.csv === 'ru' ? p.csv : DEFAULTS.csv,
    }
  } catch { return DEFAULTS }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* хранилище недоступно */ }
    const r = document.documentElement
    r.lang = 'ru'
    if (s.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', s.theme)
  }, [s])

  const value = useMemo<Ctx>(() => {
    // Неизвестная или пустая валюта у записи не должна ломать страницу — показываем как рубли.
    const moneyIn = (n: number, c: string) =>
      new Intl.NumberFormat(LOCALE, {
        style: 'currency', currency: (CURRENCIES as readonly string[]).includes(c) ? c : 'RUB', maximumFractionDigits: 0,
      }).format(Number.isFinite(n) ? n : 0)
    return {
      ...s,
      set: (p) => setS((x) => ({ ...x, ...p })),
      t: (k, vars) => Object.entries(vars ?? {}).reduce((a, [n, v]) => a.replace(`{${n}}`, String(v)), ru[k]),
      money: (n) => moneyIn(n, s.currency),
      moneyIn,
      date: (iso) => new Date(iso + 'T00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }),
      err: (e) => {
        const st = (e as { status?: number } | null)?.status ?? -1
        const k: Key =
          st === 0 ? 'errNetwork'
          : st === 401 || st === 403 ? 'errAuth'
          : st === 404 ? 'errNotFound'
          : st === 409 ? 'errConflict'
          : st === 400 || st === 422 ? 'errValidation'
          : 'errServer'
        return ru[k]
      },
    }
  }, [s])
  return <C.Provider value={value}>{children}</C.Provider>
}
