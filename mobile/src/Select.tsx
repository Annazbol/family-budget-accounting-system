import { useState } from 'react'
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native'
import { useTheme } from './ThemeContext'
import { radius, space } from './theme'

export type SelectOption = { value: string; label: string }

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Выберите…',
}: {
  label: string
  value: string
  options: SelectOption[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  return (
    <View style={{ marginBottom: space.sm }}>
      <Text style={{ color: colors.mut, fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radius.md,
          paddingHorizontal: 12,
          paddingVertical: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: current ? colors.ink : colors.mut, fontSize: 16 }}>
          {current ? current.label : placeholder}
        </Text>
        <Text style={{ color: colors.mut }}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.line,
              maxHeight: '70%',
              overflow: 'hidden',
            }}
          >
            <Text style={{
              fontWeight: '700', fontSize: 16, color: colors.ink,
              padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.line,
            }}
            >
              {label}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const on = item.value === value
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value)
                      setOpen(false)
                    }}
                    style={{
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      backgroundColor: on ? colors.acc : 'transparent',
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.line,
                    }}
                  >
                    <Text style={{ color: on ? '#fff' : colors.ink, fontSize: 16, fontWeight: on ? '700' : '400' }}>
                      {item.label}
                    </Text>
                  </Pressable>
                )
              }}
              ListEmptyComponent={
                <Text style={{ padding: 16, color: colors.mut }}>Нет вариантов</Text>
              }
            />
            <Pressable onPress={() => setOpen(false)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.acc, fontWeight: '600' }}>Закрыть</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
