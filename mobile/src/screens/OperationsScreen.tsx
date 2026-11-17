import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, Pressable, Alert } from 'react-native'
import { api } from '../api'
import type { Category, Operation } from '../types'
import { useTheme } from '../ThemeContext'
import { useRates } from '../RatesContext'
import { CURRENCIES } from '../settings'
import { usePeriod, periodQuery } from '../period'
import { PeriodBar } from '../PeriodBar'
import { radius, space } from '../theme'
import { Card, Btn, Field, Sheet, Err, money, Mut } from '../ui'
import { Select } from '../Select'

const TYPE_OPTS = [
  { value: 'e', label: 'Расход' },
  { value: 'i', label: 'Доход' },
]

export function OperationsScreen() {
  const { colors } = useTheme()
  const { opM, budgetCurrency, canOp } = useRates()
  const period = usePeriod('month')
  const [data, setData] = useState<Operation[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'list' | 'grouped'>('list')
  const [open, setOpen] = useState(false)
  const [showCats, setShowCats] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState({
    type: 'e',
    name: '',
    amount: '',
    currency: 'RUB',
    date: new Date().toISOString().slice(0, 10),
    category_id: '',
    note: '',
  })
  const [catForm, setCatForm] = useState({ type: 'e', name: '' })
  const [saveErr, setSaveErr] = useState('')
  const [catErr, setCatErr] = useState('')

  const loadCats = useCallback(async () => {
    try {
      const rows = await api<Category[]>('/categories')
      setCats(Array.isArray(rows) ? rows : [])
    } catch {
      setCats([])
    }
  }, [])

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError('')
    try {
      const rows = await api<Operation[]>(`/operations${periodQuery(period.rng)}`)
      setData(Array.isArray(rows) ? rows : [])
    } catch {
      setError('Не удалось загрузить')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [period.rng[0], period.rng[1]])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    loadCats()
  }, [loadCats])

  const catName = (id: number) => {
    const c = cats.find((x) => x.id === id)
    if (!c) return `Категория #${id}`
    if (c.name === 'system.goals') return 'Цели'
    if (c.name === 'system.loans') return 'Кредиты'
    return c.name
  }

  const catOptions = useMemo(
    () => cats.filter((c) => c.type === form.type && !c.name.startsWith('system.')).map((c) => ({
      value: String(c.id),
      label: c.name,
    })),
    [cats, form.type],
  )

  const currencyOptions = useMemo(
    () => CURRENCIES.map((c) => ({ value: c, label: c })),
    [],
  )

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [data],
  )

  const groups = useMemo(() => {
    const g = new Map<string, Operation[]>()
    for (const o of sorted) {
      const k = `${o.category_id}:${o.type}`
      const arr = g.get(k) ?? []
      arr.push(o)
      g.set(k, arr)
    }
    return [...g.entries()].map(([key, list]) => {
      const sum = list.reduce((s, o) => s + opM(o), 0)
      return {
        key,
        type: list[0].type,
        category_id: list[0].category_id,
        list,
        sum,
      }
    }).sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))
  }, [sorted, opM])

  const sumI = sorted.filter((o) => o.type === 'i').reduce((s, o) => s + opM(o), 0)
  const sumE = sorted.filter((o) => o.type === 'e').reduce((s, o) => s + opM(o), 0)

  const openAdd = () => {
    const filtered = cats.filter((c) => c.type === 'e' && !c.name.startsWith('system.'))
    setForm({
      type: 'e',
      name: '',
      amount: '',
      currency: budgetCurrency || 'RUB',
      date: new Date().toISOString().slice(0, 10),
      category_id: filtered[0] ? String(filtered[0].id) : '',
      note: '',
    })
    setSaveErr('')
    setOpen(true)
  }

  const onTypeChange = (type: string) => {
    const filtered = cats.filter((c) => c.type === type && !c.name.startsWith('system.'))
    setForm((f) => ({
      ...f,
      type,
      category_id: filtered[0] ? String(filtered[0].id) : '',
    }))
  }

  const save = async () => {
    const amount = Number(String(form.amount).replace(',', '.'))
    const category_id = Number(form.category_id)
    if (!form.name.trim() || !(amount > 0) || !category_id) {
      setSaveErr('Заполните название, сумму и категорию')
      return
    }
    try {
      await api('/operations', {
        method: 'POST',
        body: JSON.stringify({
          type: form.type,
          name: form.name.trim(),
          amount,
          currency: form.currency,
          date: form.date,
          category_id,
          note: form.note,
        }),
      })
      setOpen(false)
      reload()
    } catch {
      setSaveErr('Не удалось сохранить')
    }
  }

  const remove = (id: number, locked?: boolean) => {
    if (locked) {
      Alert.alert('Нельзя удалить', 'Системную операцию нельзя удалить')
      return
    }
    Alert.alert('Удалить?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/operations/${id}`, { method: 'DELETE' })
            reload()
          } catch {
            Alert.alert('Ошибка', 'Возможно, запись защищена')
          }
        },
      },
    ])
  }

  const saveCat = async () => {
    if (!catForm.name.trim()) {
      setCatErr('Введите название')
      return
    }
    try {
      await api('/categories', {
        method: 'POST',
        body: JSON.stringify({ type: catForm.type, name: catForm.name.trim() }),
      })
      setCatForm({ type: catForm.type, name: '' })
      setCatErr('')
      loadCats()
    } catch {
      setCatErr('Не удалось создать')
    }
  }

  const removeCat = (c: Category) => {
    if (c.name.startsWith('system.')) {
      Alert.alert('Нельзя удалить', 'Системная категория')
      return
    }
    Alert.alert('Удалить категорию?', c.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/categories/${c.id}`, { method: 'DELETE' })
            loadCats()
          } catch {
            Alert.alert('Нельзя удалить', 'Категория используется в операциях')
          }
        },
      },
    ])
  }

  const ic = {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }

  const chip = (active: boolean) => ({
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: active ? colors.acc : colors.line,
    backgroundColor: active ? colors.acc : colors.card,
  })

  const renderOp = (o: Operation) => (
    <View
      key={o.id}
      style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', color: colors.ink }}>
          {o.locked ? '🔒 ' : ''}
          {o.name || catName(o.category_id)}
        </Text>
        <Mut>
          {catName(o.category_id)} · {o.date}
          {o.note ? ` · ${o.note}` : ''}
        </Mut>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: o.type === 'i' ? colors.inc : colors.exp, fontWeight: '700' }}>
          {o.type === 'i' ? '+' : '−'}
          {money(opM(o), budgetCurrency)}
        </Text>
        {o.currency !== budgetCurrency && (
          <Text style={{ color: colors.mut, fontSize: 11 }}>
            {money(Number(o.amount), o.currency)}
            {!canOp(o) ? ' · нет курса' : ''}
          </Text>
        )}
      </View>
      {!o.locked && (
        <Pressable style={ic} onPress={() => remove(o.id, o.locked)}>
          <Text style={{ color: colors.ink }}>✕</Text>
        </Pressable>
      )}
    </View>
  )

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.md, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { reload(); loadCats() }} tintColor={colors.acc} />}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8 }}>Операции</Text>
      <PeriodBar p={period} />

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
        <Pressable style={chip(mode === 'list')} onPress={() => setMode('list')}>
          <Text style={{ color: mode === 'list' ? '#fff' : colors.ink, fontWeight: '600', fontSize: 13 }}>Список</Text>
        </Pressable>
        <Pressable style={chip(mode === 'grouped')} onPress={() => setMode('grouped')}>
          <Text style={{ color: mode === 'grouped' ? '#fff' : colors.ink, fontWeight: '600', fontSize: 13 }}>По категориям</Text>
        </Pressable>
      </View>

      <Err>{error}</Err>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: colors.inc, fontWeight: '700' }}>+{money(sumI, budgetCurrency)}</Text>
          <Text style={{ color: colors.exp, fontWeight: '700' }}>−{money(sumE, budgetCurrency)}</Text>
        </View>

        {sorted.length === 0 && !loading ? <Mut>За этот период операций нет.</Mut> : null}

        {mode === 'list' && sorted.map(renderOp)}

        {mode === 'grouped' && groups.map((g) => {
          const openG = !!expanded[g.key]
          return (
            <View key={g.key} style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
              <Pressable
                onPress={() => setExpanded((e) => ({ ...e, [g.key]: !e[g.key] }))}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 }}
              >
                <Text style={{ flex: 1, fontWeight: '700', color: colors.ink }}>
                  {openG ? '▼' : '▶'} {catName(g.category_id)}
                  <Text style={{ fontWeight: '400', color: colors.mut }}> · {g.list.length}</Text>
                </Text>
                <Text style={{ color: g.type === 'i' ? colors.inc : colors.exp, fontWeight: '700' }}>
                  {g.type === 'i' ? '+' : '−'}
                  {money(g.sum, budgetCurrency)}
                </Text>
              </Pressable>
              {openG && g.list.map(renderOp)}
            </View>
          )
        })}
      </Card>

      <Btn title="Добавить операцию" onPress={openAdd} style={{ marginTop: 8 }} />
      <Btn title="Категории" variant="gh" onPress={() => { setCatErr(''); setShowCats(true) }} style={{ marginTop: 8 }} />

      {/* Новая операция */}
      <Sheet visible={open} title="Операция" onClose={() => setOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Select label="Тип" value={form.type} options={TYPE_OPTS} onChange={onTypeChange} />
          <Select
            label="Категория"
            value={form.category_id}
            options={catOptions}
            onChange={(v) => setForm({ ...form, category_id: v })}
            placeholder={catOptions.length ? 'Выберите категорию' : 'Нет категорий — создайте в «Категории»'}
          />
          <Field label="Название" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Field label="Сумма" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" />
          <Select label="Валюта" value={form.currency} options={currencyOptions} onChange={(v) => setForm({ ...form, currency: v })} />
          <Field label="Дата (ГГГГ-ММ-ДД)" value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} />
          <Field label="Заметка" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} />
          <Err>{saveErr}</Err>
          <Btn title="Сохранить" onPress={save} />
          <Btn title="Отмена" variant="gh" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
        </ScrollView>
      </Sheet>

      {/* Управление категориями */}
      <Sheet visible={showCats} title="Категории" onClose={() => setShowCats(false)}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Select
            label="Тип новой"
            value={catForm.type}
            options={TYPE_OPTS}
            onChange={(v) => setCatForm({ ...catForm, type: v })}
          />
          <Field
            label="Название"
            value={catForm.name}
            onChangeText={(v) => setCatForm({ ...catForm, name: v })}
          />
          <Err>{catErr}</Err>
          <Btn title="Добавить категорию" onPress={saveCat} />

          <Text style={{ fontWeight: '700', color: colors.ink, marginTop: 16, marginBottom: 8 }}>Расход</Text>
          {cats.filter((c) => c.type === 'e').map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
              <Text style={{ flex: 1, color: colors.ink }}>{c.name.startsWith('system.') ? (c.name === 'system.goals' ? 'Цели' : c.name === 'system.loans' ? 'Кредиты' : c.name) : c.name}</Text>
              {!c.name.startsWith('system.') && (
                <Pressable style={ic} onPress={() => removeCat(c)}>
                  <Text style={{ color: colors.ink }}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}

          <Text style={{ fontWeight: '700', color: colors.ink, marginTop: 16, marginBottom: 8 }}>Доход</Text>
          {cats.filter((c) => c.type === 'i').map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
              <Text style={{ flex: 1, color: colors.ink }}>{c.name}</Text>
              {!c.name.startsWith('system.') && (
                <Pressable style={ic} onPress={() => removeCat(c)}>
                  <Text style={{ color: colors.ink }}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}

          <Btn title="Закрыть" variant="gh" onPress={() => setShowCats(false)} style={{ marginTop: 16 }} />
        </ScrollView>
      </Sheet>
    </ScrollView>
  )
}
