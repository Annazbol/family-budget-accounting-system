import * as SecureStore from 'expo-secure-store'
import type { Currency } from './types'

export type Calc = 'hist' | 'now'
export type Theme = 'auto' | 'light' | 'dark'

export interface AppSettings {
  currency: Currency
  calc: Calc
  theme: Theme
}

const KEY = 'fb.settings'
const DEFAULTS: AppSettings = { currency: 'RUB', calc: 'hist', theme: 'auto' }

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<AppSettings>
    return {
      currency: (['RUB', 'USD', 'EUR', 'KZT', 'BYN'] as Currency[]).includes(p.currency as Currency)
        ? (p.currency as Currency)
        : DEFAULTS.currency,
      calc: p.calc === 'now' || p.calc === 'hist' ? p.calc : DEFAULTS.calc,
      theme: p.theme === 'light' || p.theme === 'dark' || p.theme === 'auto' ? p.theme : DEFAULTS.theme,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

export const CURRENCIES: Currency[] = ['RUB', 'USD', 'EUR', 'KZT', 'BYN']
