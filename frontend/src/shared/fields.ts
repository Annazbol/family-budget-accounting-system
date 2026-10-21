import type { Field } from '../Resource'
import { CURRENCIES } from '../types'

// Поле «Валюта» для форм (операции, цели, долги, кредиты).
export const ccyField = (label: string): Field => ({ key: 'currency', label, type: 'select', options: CURRENCIES.map((c) => ({ value: c, label: c })) })
