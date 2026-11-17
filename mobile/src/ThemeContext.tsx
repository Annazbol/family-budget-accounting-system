import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import {
  AppSettings, loadSettings, saveSettings,
} from './settings'
import { Colors, dark, light, type ColorScheme } from './theme'

type Ctx = {
  colors: Colors
  scheme: ColorScheme
  settings: AppSettings
  setSettings: (partial: Partial<AppSettings>) => Promise<void>
}

const defaultSettings: AppSettings = { currency: 'RUB', calc: 'hist', theme: 'auto' }

const ThemeContext = createContext<Ctx>({
  colors: light,
  scheme: 'light',
  settings: defaultSettings,
  setSettings: async () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings)

  useEffect(() => {
    loadSettings().then(setSettingsState)
  }, [])

  // Не вызываем Appearance.setColorScheme — на Android с null/undefined падает NPE.
  // Тема только через наши токены colors.
  const scheme: ColorScheme = useMemo(() => {
    if (settings.theme === 'light') return 'light'
    if (settings.theme === 'dark') return 'dark'
    return system === 'dark' ? 'dark' : 'light'
  }, [settings.theme, system])

  const setSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial }
      void saveSettings(next)
      return next
    })
  }, [])

  const colors = scheme === 'dark' ? dark : light

  const value = useMemo(
    () => ({ colors, scheme, settings, setSettings }),
    [colors, scheme, settings, setSettings],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Ctx {
  return useContext(ThemeContext)
}
