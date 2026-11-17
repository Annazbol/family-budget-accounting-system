import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AuthUser } from '../auth'
import { logout } from '../auth'
import { api } from '../api'
import { useTheme } from '../ThemeContext'
import { CURRENCIES, type Calc, type Theme } from '../settings'
import type { Currency } from '../types'
import { radius, space } from '../theme'
import { Btn, Mut } from '../ui'

function Seg<T extends string>({
  value, options, onChange, colors,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
  colors: { card: string; line: string; ink: string; acc: string }
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
      {options.map(([v, label]) => {
        const on = value === v
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: on ? colors.acc : colors.line,
              backgroundColor: on ? colors.acc : colors.card,
            }}
          >
            <Text style={{ color: on ? '#fff' : colors.ink, fontSize: 13, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function ProfileScreen({
  user,
  onLogout,
  onClose,
}: {
  user: AuthUser
  onLogout: () => void
  onClose?: () => void
}) {
  const insets = useSafeAreaInsets()
  const { colors, settings, setSettings } = useTheme()
  const [ratesLabel, setRatesLabel] = useState('Загрузка курсов…')

  useEffect(() => {
    api<{ date?: string }>('/rates')
      .then((r) => setRatesLabel(r?.date ? `Курсы на ${r.date}` : 'Курсы загружены'))
      .catch(() => setRatesLabel('Курсы недоступны — суммы в других валютах без пересчёта'))
  }, [])

  const doLogout = async () => {
    await logout()
    onLogout()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.line,
          backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
        }}
        >
          <Text style={{ fontWeight: '700', color: colors.ink }}>{initials(user.name)}</Text>
        </View>
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: colors.acc, fontWeight: '600', fontSize: 16 }}>Закрыть</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>{user.name}</Text>
          {'\n'}
          <Text style={{ color: colors.mut, fontSize: 14 }}>{user.email}</Text>
          {!!user.login && <Text style={{ color: colors.mut, fontSize: 14 }}>{'\n'}@{user.login}</Text>}
        </Text>

        <Text style={{ fontWeight: '600', color: colors.ink, marginBottom: 8 }}>Валюта бюджета</Text>
        <Seg<Currency>
          value={settings.currency}
          onChange={(currency) => setSettings({ currency })}
          options={CURRENCIES.map((c) => [c, c])}
          colors={colors}
        />
        <Mut>Все суммы пересчитываются по курсу.</Mut>

        <Text style={{ fontWeight: '600', color: colors.ink, marginBottom: 8, marginTop: 14 }}>Итоги и баланс считать</Text>
        <Seg<Calc>
          value={settings.calc}
          onChange={(calc) => setSettings({ calc })}
          options={[['hist', 'На дату операции'], ['now', 'По текущему']]}
          colors={colors}
        />
        <Mut>{ratesLabel}</Mut>

        <Text style={{ fontWeight: '600', color: colors.ink, marginBottom: 8, marginTop: 14 }}>Тема</Text>
        <Seg<Theme>
          value={settings.theme}
          onChange={(theme) => setSettings({ theme })}
          options={[['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']]}
          colors={colors}
        />
<Btn title="Выйти из профиля" variant="del" onPress={doLogout} style={{ marginTop: 20 }} />
      </ScrollView>
    </View>
  )
}

function initials(n: string) {
  const p = n.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
}
