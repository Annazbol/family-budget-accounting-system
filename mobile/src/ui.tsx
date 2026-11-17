import {
  View, Text, TextInput, Pressable, StyleSheet, Modal, ScrollView,
  ActivityIndicator, type TextInputProps, type ViewStyle,
} from 'react-native'
import { useTheme } from './ThemeContext'
import { radius, space, type Colors } from './theme'

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[{ padding: space.md, paddingBottom: 100 }, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

export function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  return (
    <View style={{
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
      borderRadius: radius.md, padding: space.md,
    }}
    >
      {children}
    </View>
  )
}

export function H1({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  return <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>{children}</Text>
}

export function Mut({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  return <Text style={{ color: colors.mut, fontSize: 13 }}>{children}</Text>
}

export function Err({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  if (!children) return null
  return <Text style={{ color: colors.exp, marginVertical: 6 }}>{String(children)}</Text>
}

export function Btn({
  title, onPress, variant = 'pri', disabled, style,
}: {
  title: string
  onPress: () => void
  variant?: 'pri' | 'gh' | 'del'
  disabled?: boolean
  style?: ViewStyle
}) {
  const { colors } = useTheme()
  const bg =
    variant === 'pri' ? colors.acc :
    variant === 'del' ? colors.exp :
    colors.card
  const color = variant === 'gh' ? colors.ink : colors.onAcc
  const border = variant === 'gh' ? { borderWidth: 1, borderColor: colors.line } : null
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[{
        borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14,
        alignItems: 'center', backgroundColor: bg, opacity: disabled ? 0.55 : 1,
      }, border, style]}
    >
      <Text style={{ fontWeight: '700', fontSize: 15, color }}>{title}</Text>
    </Pressable>
  )
}

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  const { colors } = useTheme()
  return (
    <View style={{ marginBottom: space.sm }}>
      <Text style={{ color: colors.mut, fontSize: 13, marginBottom: 4 }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mut}
        style={{
          backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line,
          borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12,
          color: colors.ink, fontSize: 16,
        }}
        {...rest}
      />
    </View>
  )
}

export function Progress({ value }: { value: number }) {
  const { colors } = useTheme()
  const w = Math.max(0, Math.min(100, value)) / 100
  return (
    <View style={{
      height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden',
      marginVertical: 6, flexDirection: 'row',
    }}
    >
      <View style={{ height: '100%', backgroundColor: colors.acc, flex: w || 0.0001, opacity: w === 0 ? 0 : 1 }} />
      <View style={{ flex: Math.max(0.0001, 1 - w) }} />
    </View>
  )
}

export function Sheet({
  visible, title, onClose, children,
}: {
  visible: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const { colors } = useTheme()
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18,
          padding: space.lg, maxHeight: '92%',
        }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>{title}</Text>
            <Pressable onPress={onClose}><Text style={{ color: colors.mut }}>Закрыть</Text></Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
}

export function Loading() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.acc} />
    </View>
  )
}

export function money(n: number, currency = 'RUB') {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(x)
  } catch {
    return `${Math.round(x)} ${currency}`
  }
}

export function useColors(): Colors {
  return useTheme().colors
}
