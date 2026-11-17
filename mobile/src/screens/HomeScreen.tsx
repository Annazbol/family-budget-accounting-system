import { useCallback, useRef, useState } from 'react'
import { View, Text, ScrollView, RefreshControl } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { api } from '../api'
import { useRates } from '../RatesContext'
import { useTheme } from '../ThemeContext'
import { usePeriod, periodQuery } from '../period'
import { PeriodBar } from '../PeriodBar'
import { radius, space } from '../theme'
import { Mut, Err, money } from '../ui'

type TotalRow = { type: 'i' | 'e'; amount: number; currency?: string; date?: string }

export function HomeScreen() {
  const { colors } = useTheme()
  const { opM, canOp, budgetCurrency, data, failed, retry } = useRates()
  const period = usePeriod('month')
  const [income, setIncome] = useState(0)
  const [expense, setExpense] = useState(0)
  const [balanceAll, setBalanceAll] = useState(0)
  const [balancePer, setBalancePer] = useState(0)
  const [warn, setWarn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const first = useRef(true)

  // актуальные функции без пересоздания load
  const opMRef = useRef(opM)
  const canOpRef = useRef(canOp)
  opMRef.current = opM
  canOpRef.current = canOp

  const sumRows = (list: TotalRow[]) => {
    let inc = 0, exp = 0
    let missing = false
    for (const r of list) {
      const o = { amount: Number(r.amount), currency: r.currency || 'RUB', date: r.date }
      if (!canOpRef.current(o)) missing = true
      const v = opMRef.current(o)
      if (r.type === 'i') inc += v
      else exp += v
    }
    return { inc, exp, bal: inc - exp, missing }
  }

  const load = useCallback(async (opts?: { pull?: boolean }) => {
    if (opts?.pull) setRefreshing(true)
    else if (first.current) setLoading(true)
    setError('')
    try {
      const pq = periodQuery(period.rng)
      const [allRows, perRows] = await Promise.all([
        api<TotalRow[]>('/operations/totals'),
        api<TotalRow[]>(`/operations/totals${pq}`),
      ])
      const all = sumRows(Array.isArray(allRows) ? allRows : [])
      const per = sumRows(Array.isArray(perRows) ? perRows : [])
      setBalanceAll(all.bal)
      setIncome(per.inc)
      setExpense(per.exp)
      setBalancePer(per.bal)
      setWarn(per.missing)
    } catch {
      setError('Не удалось загрузить')
    } finally {
      first.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [period.rng[0], period.rng[1]])

  // при фокусе вкладки — один раз; при смене периода — снова
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md, paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { retry(); load({ pull: true }) }}
          tintColor={colors.acc}
        />
      }
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Главная</Text>
      <PeriodBar p={period} />
      <Err>{error}</Err>
      {failed && (
        <Text style={{ color: colors.mut, marginBottom: 8, fontSize: 12 }}>
          Не удалось обновить курсы — используются сохранённые значения
        </Text>
      )}
      {warn && (
        <Text style={{ color: colors.mut, marginBottom: 8, fontSize: 12 }}>
          Часть сумм без курса — показаны номиналом
        </Text>
      )}
      {loading && <Mut>Загрузка…</Mut>}

      <View style={{ backgroundColor: colors.acc, borderRadius: radius.lg, padding: space.lg, marginBottom: 8 }}>
        <Text style={{ color: '#fff', opacity: 0.9 }}>Общий баланс ({budgetCurrency})</Text>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 4 }}>
          {money(balanceAll, budgetCurrency)}
        </Text>
      </View>

      <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: 8, borderWidth: 1, borderColor: colors.line }}>
        <Text style={{ color: colors.mut }}>Баланс за период ({budgetCurrency})</Text>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '700', marginTop: 4 }}>
          {money(balancePer, budgetCurrency)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: colors.line }}>
          <Mut>Доходы за период</Mut>
          <Text style={{ color: colors.inc, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
            {money(income, budgetCurrency)}
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: colors.line }}>
          <Mut>Расходы за период</Mut>
          <Text style={{ color: colors.exp, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
            {money(expense, budgetCurrency)}
          </Text>
        </View>
      </View>
      {data?.date ? <Mut>Курсы на {data.date}</Mut> : null}
    </ScrollView>
  )
}
