export type Kind = 'i' | 'e'
export const CURRENCIES = ['RUB', 'USD', 'EUR', 'KZT', 'BYN'] as const
export type Currency = (typeof CURRENCIES)[number]
export type TabId = 'home' | 'operations' | 'goals' | 'debts' | 'loans'

export interface Category { id: number; type: Kind; name: string }
export interface Operation { id: number; type: Kind; name: string; amount: number; currency: Currency; date: string; category_id: number; note: string }
export interface Goal { id: number; name: string; target: number; saved: number; currency: Currency; due: string }
export interface Debt { id: number; direction: 'owe' | 'owed'; amount: number; currency: Currency; due: string; note: string }
export interface Loan { id: number; name: string; initial: number; current: number; rate: number; payment: number; currency: Currency; day: number }

/** Сумма с валютой и датой — всё, что нужно для пересчёта по курсу (подходит и Operation, и строка итогов). */
export interface Money { amount: number; currency: string; date: string }
/** Строка итогов операций по типу, валюте, дате и категории (GET /operations/totals). */
export interface Total extends Money { type: Kind; category_id: number }

/** Курсы: единиц валюты за 1 USD. history — таблицы за прошлые даты. */
export interface RatesData { date: string; rates: Record<string, number>; history: Record<string, Record<string, number>> }
