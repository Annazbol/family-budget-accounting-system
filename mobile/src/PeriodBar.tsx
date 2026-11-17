import { View, Text, ScrollView, Pressable } from 'react-native'
import { PERIOD_OPTS, type Per, type usePeriod } from './period'
import { useTheme } from './ThemeContext'
import { Field } from './ui'
import { radius, space } from './theme'

type PeriodState = ReturnType<typeof usePeriod>

export function PeriodBar({ p }: { p: PeriodState }) {
  const { colors } = useTheme()
  const [from, to] = p.rng

  return (
    <View style={{ marginBottom: space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {PERIOD_OPTS.map((o) => {
          const on = p.per === o.value
          return (
            <Pressable
              key={o.value}
              onPress={() => p.setPer(o.value)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: on ? colors.acc : colors.line,
                backgroundColor: on ? colors.acc : colors.card,
              }}
            >
              <Text style={{ color: on ? '#fff' : colors.ink, fontWeight: '600', fontSize: 13 }}>
                {o.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {p.per === 'custom' && (
        <View style={{ marginTop: 8 }}>
          <Field
            label="С"
            value={p.cr.a}
            onChangeText={(v) => {
              if (!v) return
              p.setCr({ a: v, b: p.cr.b < v ? v : p.cr.b })
            }}
            placeholder="ГГГГ-ММ-ДД"
          />
          <Field
            label="По"
            value={p.cr.b}
            onChangeText={(v) => {
              if (!v) return
              p.setCr({ a: p.cr.a > v ? v : p.cr.a, b: v })
            }}
            placeholder="ГГГГ-ММ-ДД"
          />
        </View>
      )}

      {p.per !== 'all' && (
        <Text style={{ color: colors.mut, fontSize: 12, marginTop: 4 }}>
          {from} — {to}
        </Text>
      )}
    </View>
  )
}
