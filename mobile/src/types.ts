export type Currency = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'BYN'
export type Kind = 'i' | 'e'
export type TabId = 'home' | 'operations' | 'goals' | 'debts' | 'loans'

export interface Category {
  id: number
  type: Kind
  name: string
}

export interface Operation {
  id: number
  type: Kind
  name: string
  amount: number
  currency: Currency
  date: string
  category_id: number
  note: string
  locked?: boolean
  source_type?: 'goal' | 'loan' | null
  source_id?: number | null
}

export interface Goal {
  id: number
  name: string
  target: number
  saved: number
  currency: Currency
  due: string
}

export interface Debt {
  id: number
  direction: 'owe' | 'owed'
  amount: number
  currency: Currency
  due: string
  note: string
}

export interface Loan {
  id: number
  name: string
  amount: number
  rate: number
  paid: number
  start_date: string
  term_months: number
  currency: Currency
}

export interface Totals {
  income: number
  expense: number
  balance: number
}
