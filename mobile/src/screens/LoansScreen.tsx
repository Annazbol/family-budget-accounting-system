import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, Pressable, Alert } from 'react-native'
import { api } from '../api'
import { useList } from '../hooks'
import { annuityPayment, pct, remainingToPay, totalAnnuityCost } from '../shared/loanMath'
import type { Loan } from '../types'
import { useTheme } from '../ThemeContext'
import { useRates } from '../RatesContext'
import { space } from '../theme'
import { Card, Btn, Field, Sheet, Err, Mut, Progress, money } from '../ui'
import { Select } from '../Select'
import { CURRENCIES } from '../settings'

export function LoansScreen() {
  const { colors } = useTheme()
  const { toBudget, budgetCurrency } = useRates()
  const { data, loading, error, reload } = useList<Loan>('/loans')
  const [formOpen, setFormOpen] = useState(false)
  const [payLoan, setPayLoan] = useState<Loan | null>(null)
  const [amount, setAmount] = useState('')
  const [form, setForm] = useState({
    name: '', amount: '', rate: '', paid: '0',
    start_date: new Date().toISOString().slice(0, 10), term_months: '12', currency: 'RUB',
  })
  const [err, setErr] = useState('')

  const ic = {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.bg, alignItems: 'center' as const, justifyContent: 'center' as const,
  }

  const save = async () => {
    const amount = Number(String(form.amount).replace(',', '.'))
    const rate = Number(String(form.rate).replace(',', '.'))
    const paid = Number(String(form.paid).replace(',', '.')) || 0
    const term_months = Math.floor(Number(form.term_months))
    if (!form.name.trim() || !(amount > 0) || term_months < 1) { setErr('Заполните поля'); return }
    try {
      await api('/loans', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(), amount, rate, paid,
          start_date: form.start_date, term_months, currency: form.currency,
        }),
      })
      setFormOpen(false)
      reload()
    } catch { setErr('Ошибка сохранения') }
  }

  const pay = async () => {
    if (!payLoan) return
    const n = Number(String(amount).replace(',', '.'))
    if (!(n > 0)) { setErr('Введите сумму'); return }
    try {
      await api(`/loans/${payLoan.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: n }) })
      setPayLoan(null)
      setAmount('')
      reload()
    } catch { setErr('Не удалось внести платёж') }
  }

  const remove = (id: number) => {
    Alert.alert('Удалить кредит?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try { await api(`/loans/${id}`, { method: 'DELETE' }); reload() } catch { Alert.alert('Ошибка') }
      }},
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.acc} />}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Кредиты</Text>
      <Err>{error}</Err>
      <Card>
        {data.length === 0 && !loading ? <Mut>Кредитов нет.</Mut> : null}
        {data.map((l, i) => {
          const P = Number(l.amount), rate = Number(l.rate), n = Number(l.term_months), paid = Number(l.paid)
          const monthly = annuityPayment(P, rate, n)
          const total = totalAnnuityCost(P, rate, n)
          const toPay = remainingToPay(P, rate, n, paid)
          return (
            <View key={l.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 10 } : undefined}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{l.name}</Text>
                  <Mut>{rate}% · {toPay > 0.01 ? 'активен' : 'закрыт'}</Mut>
                  <Progress value={pct(total - toPay, total)} />
                  <Mut>Платёж/мес: {money(toBudget(monthly, l.currency), budgetCurrency)}</Mut>
                  <Mut>Остаток: {money(toBudget(toPay, l.currency), budgetCurrency)} · внесено {money(toBudget(paid, l.currency), budgetCurrency)}</Mut>
                </View>
                {toPay > 0.01 && (
                  <Pressable style={ic} onPress={() => { setPayLoan(l); setAmount(''); setErr('') }}>
                    <Text style={{ color: colors.ink }}>＋</Text>
                  </Pressable>
                )}
                <Pressable style={ic} onPress={() => remove(l.id)}><Text style={{ color: colors.ink }}>✕</Text></Pressable>
              </View>
            </View>
          )
        })}
      </Card>
      <Btn title="Добавить кредит" onPress={() => { setErr(''); setFormOpen(true) }} style={{ marginTop: 8 }} />

      <Sheet visible={formOpen} title="Кредит" onClose={() => setFormOpen(false)}>
        <Field label="Название" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <Field label="Сумма кредита" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" />
        <Field label="Ставка % годовых" value={form.rate} onChangeText={(v) => setForm({ ...form, rate: v })} keyboardType="decimal-pad" />
        <Field label="Уже внесено" value={form.paid} onChangeText={(v) => setForm({ ...form, paid: v })} keyboardType="decimal-pad" />
        <Field label="Дата взятия" value={form.start_date} onChangeText={(v) => setForm({ ...form, start_date: v })} />
        <Field label="Срок, месяцев" value={form.term_months} onChangeText={(v) => setForm({ ...form, term_months: v })} keyboardType="number-pad" />
        <Select label="Валюта" value={form.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} onChange={(v) => setForm({ ...form, currency: v })} />
        <Err>{err}</Err>
        <Btn title="Сохранить" onPress={save} />
      </Sheet>

      <Sheet visible={!!payLoan} title="Платёж по кредиту" onClose={() => setPayLoan(null)}>
        {payLoan && <Mut>{payLoan.name}</Mut>}
        <Field label="Сумма" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Err>{err}</Err>
        <Btn title="Внести" onPress={pay} />
      </Sheet>
    </ScrollView>
  )
}
