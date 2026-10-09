import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { Currency } from './types'

const ru = {
  appTitle: 'Семейный бюджет', home: 'Главная', operations: 'Операции', goals: 'Цели', debts: 'Долги', loans: 'Кредиты',
  week: 'Неделя', month: 'Месяц', year: 'Год', allTime: 'Всё время', customPeriod: 'Свой период', period: 'Период', from: 'С', to: 'По',
  balance: 'Текущий баланс', income: 'Доходы', expense: 'Расходы', incomeOne: 'Доход', expenseOne: 'Расход',
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
  errNetwork: 'Нет связи с сервером.', errNotFound: 'Запись не найдена.',
  errConflict: 'Нельзя удалить: запись используется (например, категория с операциями).',
  errValidation: 'Проверьте введённые данные.', errServer: 'Ошибка сервера. Попробуйте позже.',
  profile: 'Профиль', currency: 'Валюта бюджета', rateNote: 'Все суммы пересчитываются по курсу.',
  calcLabel: 'Итоги и баланс считать', calcHist: 'На дату операции', calcNow: 'По текущему',
  ratesOn: 'Курсы на {d}', ratesFail: 'Курсы недоступны — суммы показаны без пересчёта.',
  asOfDate: 'на дату', now: 'сейчас', budgetAtDate: 'Сумма в валюте бюджета (на дату)', budgetNow: 'Сумма в валюте бюджета (по текущему курсу)',
  theme: 'Тема', themeAuto: 'Авто', themeLight: 'Светлая', themeDark: 'Тёмная', exportCsv: 'Экспорт операций (CSV)',
  logout: 'Выйти из профиля', close: 'Закрыть', welcome: 'Добро пожаловать',
  welcomeText: 'Введите имя, чтобы начать. Профиль хранится на этом устройстве.', start: 'Начать', nameRequired: 'Введите имя.',
  yourName: 'Ваше имя', email: 'Эл. почта (необязательно)',
  notifications: 'Уведомления', noNotif: 'В ближайшие 14 дней платежей нет.', overdue: 'просрочено', newItem: 'Новое',
  repayDebt: 'Вернуть долг', owedToYou: 'Вам должны вернуть', loanPayment: 'Платёж по кредиту', goalDeadline: 'Срок цели',
}
export type Key = keyof typeof ru
export type Theme = 'auto' | 'light' | 'dark'
export type Calc = 'hist' | 'now' // по курсу на дату операции / по текущему курсу
export const LOCALE = 'ru-RU'
interface Settings { currency: Currency; calc: Calc; theme: Theme }

interface Ctx extends Settings {
  set: (p: Partial<Settings>) => void
  t: (k: Key, vars?: Record<string, string | number>) => string
  money: (n: number) => string // в валюте бюджета
  moneyIn: (n: number, c: string) => string // в указанной валюте
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
function load(): Settings {
  const d: Settings = { currency: 'RUB', calc: 'hist', theme: 'auto' }
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return d }
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
    const moneyIn = (n: number, c: string) =>
      new Intl.NumberFormat(LOCALE, { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n)
    return {
      ...s,
      set: (p) => setS((x) => ({ ...x, ...p })),
      t: (k, vars) => Object.entries(vars ?? {}).reduce((a, [n, v]) => a.replace(`{${n}}`, String(v)), ru[k]),
      money: (n) => moneyIn(n, s.currency),
      moneyIn,
      date: (iso) => new Date(iso + 'T00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }),
      err: (e) => {
        const st = (e as { status?: number } | null)?.status ?? -1
        const k: Key = st === 0 ? 'errNetwork' : st === 404 ? 'errNotFound' : st === 409 ? 'errConflict' : st === 400 || st === 422 ? 'errValidation' : 'errServer'
        return ru[k]
      },
    }
  }, [s])
  return <C.Provider value={value}>{children}</C.Provider>
}
