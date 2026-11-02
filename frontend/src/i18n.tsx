import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { CURRENCIES, Currency } from './types'

const ru = {
  appTitle: 'Семейный бюджет',
  home: 'Главная',
  operations: 'Операции',
  goals: 'Накопления',
  debts: 'Долги',
  loans: 'Кредиты',

  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
  allTime: 'За всё время',
  customPeriod: 'Произвольный период',
  period: 'Период',
  from: 'Начало',
  to: 'Конец',

  balance: 'Общий баланс',
  balancePeriod: 'Баланс за период',
  loading: 'Загрузка…',
  income: 'Доходы',
  expense: 'Расходы',
  incomeOne: 'Доход',
  expenseOne: 'Расход',
  incomeShort: 'доход',
  expenseShort: 'расход',
  byCategory: 'Расходы по категориям',
  noExpenses: 'За выбранный период расходов нет.',

  type: 'Тип операции',
  amount: 'Сумма',
  date: 'Дата',
  category: 'Категория',
  note: 'Комментарий',
  name: 'Название',
  ccy: 'Валюта',

  addOp: 'Добавить операцию',
  noOps: 'Операций пока нет.',
  noOpsPeriod: 'За выбранный период операций нет.',
  viewList: 'Список',
  viewGrouped: 'По категориям',
  opsN: 'Операций: {n}',

  manageCategories: 'Управление категориями',
  hideCategories: 'Скрыть категории',
  addCategory: 'Добавить категорию',
  noCategories: 'Категорий пока нет.',
  catName: 'Название категории',
  noCatsOfType: 'Нет подходящих категорий. Сначала добавьте категорию в разделе ниже.',

  target: 'Целевая сумма',
  saved: 'Накоплено',
  due: 'Срок достижения',
  addGoal: 'Добавить накопление',
  noGoals: 'Накоплений пока нет.',
  until: 'до',
  of: 'из',

  who: 'Кто должен',
  iOwe: 'Я должен',
  owedMe: 'Мне должны',
  dueBack: 'Дата возврата',
  addDebt: 'Добавить долг',
  noDebts: 'Долгов пока нет.',

  loanName: 'Название кредита',
  loanAmount: 'Сумма кредита',
  rate: 'Процентная ставка, % годовых',
  loanPaid: 'Уже выплачено',
  loanStart: 'Дата оформления',
  loanTerm: 'Срок кредита, месяцев',
  addLoan: 'Добавить кредит',
  noLoans: 'Кредитов пока нет.',

  active: 'активен',
  closed: 'закрыт',
  rest: 'Осталось выплатить',
  errLoanPaid: 'Выплаченная сумма не может превышать сумму кредита.',

  contribute: 'Пополнить',
  contributeGoal: 'Пополнение накоплений',
  payLoan: 'Внести платёж',
  contributeAmount: 'Сумма платежа',
  contributeSubmit: 'Подтвердить',
  opGoalNote: 'Пополнение накоплений',
  opLoanNote: 'Платёж по кредиту',
  catSystemGoals: 'Накопления',
  catSystemLoans: 'Кредиты',
  opSystemGoal: 'Пополнение накоплений',
  opSystemLoan: 'Платёж по кредиту',

  errContributeOver: 'Сумма превышает оставшуюся сумму.',

  loanEnd: 'Дата окончания кредита',
  loanMonthly: 'Ежемесячный платёж',
  loanTotal: 'Общая сумма выплат',
  loanBodyLeft: 'Остаток основного долга',

  save: 'Сохранить',
  cancel: 'Отмена',
  edit: 'Редактировать',
  delete: 'Удалить',
  choose: 'Выберите значение…',
  confirmDelete: 'Удалить запись?',
  confirmDeleteText: 'Это действие нельзя отменить.',

  errFieldRequired: 'Заполните поле «{f}».',
  errFieldPositive: 'В поле «{f}» укажите значение больше нуля.',
  errFieldNonNeg: 'В поле «{f}» не может быть отрицательного значения.',
  errFieldInt: 'В поле «{f}» укажите целое число.',
  errFieldMax: 'Значение в поле «{f}» не должно превышать {n}.',

  errNetwork: 'Не удалось подключиться к серверу. Проверьте соединение.',
  errNotFound: 'Запрашиваемая запись не найдена.',
  errConflict: 'Не удалось удалить запись: она используется в других данных.',
  errLockedOp: 'Эту системную операцию нельзя редактировать или удалять.',
  errValidation: 'Проверьте правильность введённых данных.',
  errServer: 'Произошла ошибка на сервере. Попробуйте позже.',

  profile: 'Настройки',
  currency: 'Валюта бюджета',
  rateNote: 'Суммы автоматически пересчитываются по курсу валют.',

  calcLabel: 'Способ расчёта итогов и баланса',
  calcHist: 'По курсу на дату операции',
  calcNow: 'По текущему курсу',

  ratesOn: 'Курсы валют на {d}',
  ratesFail: 'Не удалось загрузить курсы. Суммы в других валютах показаны без пересчёта.',
  ratesStale: 'Не удалось обновить курсы. Используются сохранённые курсы от {d}.',
  retry: 'Повторить',
  noRate: 'Курс недоступен. Сумма показана без пересчёта.',

  errCatType: 'Выбранная категория не соответствует типу операции.',
  errLoanDebt: 'Выплаченная сумма не может превышать сумму кредита.',

  csvFormat: 'Формат CSV-файла',
  csvRu: 'Для Excel (Россия): разделитель «;», десятичная запятая',
  csvIntl: 'Международный: разделитель «,», десятичная точка',

  asOfDate: 'На дату операции',
  now: 'По текущему курсу',
  budgetAtDate: 'Сумма в валюте бюджета на дату операции',
  budgetNow: 'Сумма в валюте бюджета по текущему курсу',

  theme: 'Оформление',
  themeAuto: 'Как в системе',
  themeLight: 'Светлая тема',
  themeDark: 'Тёмная тема',

  exportCsv: 'Экспорт операций в CSV',
  logout: 'Выйти из аккаунта',
  close: 'Закрыть',

  welcome: 'Добро пожаловать',
  welcomeText: 'Войдите по электронной почте, логину или имени пользователя и паролю.',
  start: 'Войти',
  nameRequired: 'Укажите имя.',
  yourName: 'Имя',
  email: 'Электронная почта (необязательно)',
  loginLabel: 'Электронная почта, логин или имя',
  passwordLabel: 'Пароль',
  loginRequired: 'Введите логин.',
  passwordRequired: 'Введите пароль.',
  errAuth: 'Неверный логин или пароль.',
  loginHint: 'Войдите по электронной почте или логину. Демо-доступ: anna / demo123',

  registerTitle: 'Регистрация',
  registerLink: 'Создать аккаунт',
  loginLink: 'Уже есть аккаунт? Войти',
  regName: 'Имя',
  regLogin: 'Логин',
  regEmail: 'Электронная почта',
  regPassword: 'Пароль (не менее 6 символов)',
  regSubmit: 'Получить код подтверждения',
  regCodeTitle: 'Подтверждение регистрации',
  regCodeText: 'На адрес {email} отправлен код подтверждения. Введите его ниже.',
  regCode: 'Код подтверждения',
  regConfirm: 'Подтвердить регистрацию',
  regResend: 'Отправить код повторно',
  regCodeRequired: 'Введите код подтверждения.',

  notifications: 'Уведомления',
  noNotif: 'В ближайшие 14 дней платежей нет.',
  overdue: 'просрочено',
  newItem: 'Новое',
  repayDebt: 'Вернуть долг',
  owedToYou: 'Вам должны вернуть',
  loanPayment: 'Окончание кредита',
  goalDeadline: 'Срок накопления',
}

export type Key = keyof typeof ru
export type Theme = 'auto' | 'light' | 'dark'
export type Calc = 'hist' | 'now'
export type Csv = 'ru' | 'intl'

export const LOCALE = 'ru-RU'

interface Settings {
  currency: Currency
  calc: Calc
  theme: Theme
  csv: Csv
}

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
const DEFAULTS: Settings = {
  currency: 'RUB',
  calc: 'hist',
  theme: 'auto',
  csv: 'ru',
}

// Значения по умолчанию, если сохранённых настроек нет или в них неверные значения.
function load(): Settings {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      currency: (CURRENCIES as readonly string[]).includes(p.currency)
        ? p.currency
        : DEFAULTS.currency,
      calc: p.calc === 'now' || p.calc === 'hist' ? p.calc : DEFAULTS.calc,
      theme: p.theme === 'light' || p.theme === 'dark' || p.theme === 'auto'
        ? p.theme
        : DEFAULTS.theme,
      csv: p.csv === 'intl' || p.csv === 'ru' ? p.csv : DEFAULTS.csv,
    }
  } catch {
    return DEFAULTS
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* хранилище недоступно */
    }

    const r = document.documentElement
    r.lang = 'ru'

    if (s.theme === 'auto') {
      r.removeAttribute('data-theme')
    } else {
      r.setAttribute('data-theme', s.theme)
    }
  }, [s])

  const value = useMemo<Ctx>(() => {
    // Неизвестная или пустая валюта у записи не должна ломать страницу — показываем как рубли.
    const moneyIn = (n: number, c: string) => {
      const x = typeof n === 'number' ? n : Number(n)

      return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: (CURRENCIES as readonly string[]).includes(c) ? c : 'RUB',
        maximumFractionDigits: 0,
      }).format(Number.isFinite(x) ? x : 0)
    }

    return {
      ...s,

      set: (p) => setS((x) => ({ ...x, ...p })),

      t: (k, vars) =>
        Object.entries(vars ?? {}).reduce(
          (a, [n, v]) => a.replace(`{${n}}`, String(v)),
          ru[k],
        ),

      money: (n) => moneyIn(n, s.currency),

      moneyIn,

      date: (iso) =>
        new Date(iso + 'T00:00').toLocaleDateString(LOCALE, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),

      err: (e) => {
        const st = (e as { status?: number } | null)?.status ?? -1

        const k: Key =
          st === 0 ? 'errNetwork'
          : st === 401 || st === 403 ? 'errAuth'
          : st === 404 ? 'errNotFound'
          : st === 429 ? 'errRateLimit'
          : st === 409 ? 'errConflict'
          : st === 400 || st === 422 ? 'errValidation'
          : 'errServer'

        return ru[k]
      },
    }
  }, [s])

  return <C.Provider value={value}>{children}</C.Provider>
}