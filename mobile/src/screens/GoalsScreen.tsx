import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, Pressable, Alert } from 'react-native'
import { api } from '../api'
import { useList } from '../hooks'
import { pct } from '../shared/loanMath'
import type { Goal } from '../types'
import { useTheme } from '../ThemeContext'
import { useRates } from '../RatesContext'
import { space } from '../theme'
import { Card, Btn, Field, Sheet, Err, Mut, Progress, money } from '../ui'
import { Select } from '../Select'
import { CURRENCIES } from '../settings'

export function GoalsScreen() {
  const { colors } = useTheme()
  const { toBudget, budgetCurrency } = useRates()
  const { data, loading, error, reload } = useList<Goal>('/goals')
  const [formOpen, setFormOpen] = useState(false)
  const [payGoal, setPayGoal] = useState<Goal | null>(null)
  const [amount, setAmount] = useState('')
  const [form, setForm] = useState({
    name: '', target: '', saved: '0', currency: 'RUB', due: new Date().toISOString().slice(0, 10),
  })
  const [err, setErr] = useState('')

  const ic = {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.bg, alignItems: 'center' as const, justifyContent: 'center' as const,
  }

  const save = async () => {
    const target = Number(String(form.target).replace(',', '.'))
    const saved = Number(String(form.saved).replace(',', '.')) || 0
    if (!form.name.trim() || !(target > 0)) { setErr('Заполните название и цель'); return }
    try {
      await api('/goals', {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), target, saved, currency: form.currency, due: form.due }),
      })
      setFormOpen(false)
      reload()
    } catch { setErr('Ошибка сохранения') }
  }

  const contribute = async () => {
    if (!payGoal) return
    const n = Number(String(amount).replace(',', '.'))
    if (!(n > 0)) { setErr('Введите сумму'); return }
    try {
      await api(`/goals/${payGoal.id}/contribute`, { method: 'POST', body: JSON.stringify({ amount: n }) })
      setPayGoal(null)
      setAmount('')
      reload()
    } catch { setErr('Не удалось внести') }
  }

  const remove = (id: number) => {
    Alert.alert('Удалить цель?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try { await api(`/goals/${id}`, { method: 'DELETE' }); reload() } catch { Alert.alert('Ошибка') }
      }},
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.acc} />}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Цели</Text>
      <Err>{error}</Err>
      <Card>
        {data.length === 0 && !loading ? <Mut>Целей нет.</Mut> : null}
        {data.map((g, i) => {
          const saved = Number(g.saved), target = Number(g.target)
          const left = Math.max(0, target - saved)
          return (
            <View key={g.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 10 } : undefined}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{g.name}</Text>
                  <Mut>до {g.due}</Mut>
                  <Progress value={pct(saved, target)} />
                  <Mut>{money(toBudget(saved, g.currency), budgetCurrency)} из {money(toBudget(target, g.currency), budgetCurrency)}{g.currency !== budgetCurrency ? ` (${g.currency})` : ''}</Mut>
                </View>
                {left > 0 && (
                  <Pressable style={ic} onPress={() => { setPayGoal(g); setAmount(''); setErr('') }}>
                    <Text style={{ color: colors.ink }}>＋</Text>
                  </Pressable>
                )}
                <Pressable style={ic} onPress={() => remove(g.id)}><Text style={{ color: colors.ink }}>✕</Text></Pressable>
              </View>
            </View>
          )
        })}
      </Card>
      <Btn title="Добавить цель" onPress={() => {
        setForm({ name: '', target: '', saved: '0', currency: 'RUB', due: new Date().toISOString().slice(0, 10) })
        setErr(''); setFormOpen(true)
      }} style={{ marginTop: 8 }}
      />

      <Sheet visible={formOpen} title="Новая цель" onClose={() => setFormOpen(false)}>
        <Field label="Название" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Field label="Цель" value={form.target} onChangeText={(v) => setForm({ ...form, target: v })} keyboardType="decimal-pad" />
        <Field label="Уже накоплено" value={form.saved} onChangeText={(v) => setForm({ ...form, saved: v })} keyboardType="decimal-pad" />
        <Select label="Валюта" value={form.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setForm({ ...form, currency: v })} />
        <Field label="Срок" value={form.due} onChangeText={(v) => setForm({ ...form, due: v })} />
        <Err>{err}</Err>
        <Btn title="Сохранить" onPress={save} />
      </Sheet>

      <Sheet visible={!!payGoal} title="Пополнение цели" onClose={() => setPayGoal(null)}>
        {payGoal && <Mut>{payGoal.name}</Mut>}
        <Field label="Сумма" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Err>{err}</Err>
        <Btn title="Внести" onPress={contribute} />
      </Sheet>
    </ScrollView>
  )
}
