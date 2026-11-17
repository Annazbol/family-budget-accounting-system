import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, Pressable, Alert } from 'react-native'
import { api } from '../api'
import { useList } from '../hooks'
import type { Debt } from '../types'
import { useTheme } from '../ThemeContext'
import { useRates } from '../RatesContext'
import { space } from '../theme'
import { Card, Btn, Field, Sheet, Err, Mut, money } from '../ui'
import { Select } from '../Select'
import { CURRENCIES } from '../settings'

export function DebtsScreen() {
  const { colors } = useTheme()
  const { toBudget, budgetCurrency } = useRates()
  const { data, loading, error, reload } = useList<Debt>('/debts')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    direction: 'owe', amount: '', currency: 'RUB',
    due: new Date().toISOString().slice(0, 10), note: '',
  })
  const [err, setErr] = useState('')

  const ic = {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.bg, alignItems: 'center' as const, justifyContent: 'center' as const,
  }

  const save = async () => {
    const amount = Number(String(form.amount).replace(',', '.'))
    if (!(amount > 0)) { setErr('Укажите сумму'); return }
    try {
      await api('/debts', {
        method: 'POST',
        body: JSON.stringify({ ...form, amount, direction: form.direction === 'owed' ? 'owed' : 'owe' }),
      })
      setOpen(false)
      reload()
    } catch { setErr('Ошибка') }
  }

  const remove = (id: number) => {
    Alert.alert('Удалить?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try { await api(`/debts/${id}`, { method: 'DELETE' }); reload() } catch { Alert.alert('Ошибка') }
      }},
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.acc} />}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Долги</Text>
      <Err>{error}</Err>
      <Card>
        {data.length === 0 && !loading ? <Mut>Долгов нет.</Mut> : null}
        {data.map((d, i) => (
          <View key={d.id} style={[
            { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 4 },
            i ? { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 8, paddingTop: 12 } : null,
          ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>
                {d.direction === 'owe' ? 'Я должен' : 'Мне должны'}: {money(toBudget(Number(d.amount), d.currency, d.due), budgetCurrency)}{d.currency !== budgetCurrency ? ` (${money(Number(d.amount), d.currency)})` : ''}
              </Text>
              <Mut>до {d.due}{d.note ? ` · ${d.note}` : ''}</Mut>
            </View>
            <Pressable style={ic} onPress={() => remove(d.id)}><Text style={{ color: colors.ink }}>✕</Text></Pressable>
          </View>
        ))}
      </Card>
      <Btn title="Добавить долг" onPress={() => { setErr(''); setOpen(true) }} style={{ marginTop: 8 }} />

      <Sheet visible={open} title="Долг" onClose={() => setOpen(false)}>
        <Select
          label="Направление"
          value={form.direction}
          options={[
            { value: 'owe', label: 'Я должен' },
            { value: 'owed', label: 'Мне должны' },
          ]}
          onChange={(v) => setForm({ ...form, direction: v })}
        />
        <Field label="Сумма" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" />
        <Select label="Валюта" value={form.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setForm({ ...form, currency: v })} />
        <Field label="Срок" value={form.due} onChangeText={(v) => setForm({ ...form, due: v })} />
        <Field label="Заметка" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} />
        <Err>{err}</Err>
        <Btn title="Сохранить" onPress={save} />
      </Sheet>
    </ScrollView>
  )
}
