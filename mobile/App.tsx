import { useEffect, useState } from 'react'
import { ActivityIndicator, View, Text, Pressable, Platform, Modal } from 'react-native'
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AuthUser, fetchMe, getStoredUser, onUnauthorized,
} from './src/auth'
import { LoginScreen } from './src/screens/LoginScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { OperationsScreen } from './src/screens/OperationsScreen'
import { GoalsScreen } from './src/screens/GoalsScreen'
import { DebtsScreen } from './src/screens/DebtsScreen'
import { LoansScreen } from './src/screens/LoansScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { ThemeProvider, useTheme } from './src/ThemeContext'

const Tab = createBottomTabNavigator()

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
}

function MainTabs({
  user,
  onOpenProfile,
}: {
  user: AuthUser
  onOpenProfile: () => void
}) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const tabPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8)
  const tabHeight = 54 + tabPad

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 12, paddingBottom: 10, paddingTop: Math.max(insets.top, 8),
        backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line, zIndex: 10,
      }}
      >
        <Pressable
          style={({ pressed }) => [{
            width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line,
            backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          }]}
          onPress={onOpenProfile}
          hitSlop={12}
        >
          <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 15 }}>{initials(user.name)}</Text>
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink }} numberOfLines={1}>
          Семейный бюджет
        </Text>
      </View>

      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: colors.mut,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.line,
            height: tabHeight,
            paddingBottom: tabPad,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tab.Screen name="home" component={HomeScreen} options={{ title: 'Главная' }} />
        <Tab.Screen name="operations" component={OperationsScreen} options={{ title: 'Операции' }} />
        <Tab.Screen name="goals" component={GoalsScreen} options={{ title: 'Цели' }} />
        <Tab.Screen name="debts" component={DebtsScreen} options={{ title: 'Долги' }} />
        <Tab.Screen name="loans" component={LoansScreen} options={{ title: 'Кредиты' }} />
      </Tab.Navigator>
    </View>
  )
}

function AppInner() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [booting, setBooting] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const { colors, scheme } = useTheme()

  useEffect(() => {
    let alive = true
    ;(async () => {
      const stored = await getStoredUser()
      if (!stored) {
        if (alive) setBooting(false)
        return
      }
      const me = await fetchMe()
      if (alive) {
        setUser(me)
        setBooting(false)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => onUnauthorized(() => {
    setUser(null)
    setProfileOpen(false)
  }), [])

  if (booting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.acc} />
      </View>
    )
  }

  if (!user) {
    return (
      <>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <LoginScreen onDone={async () => setUser(await getStoredUser())} />
      </>
    )
  }

  const navTheme = scheme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.bg, card: colors.card, text: colors.ink, border: colors.line, primary: colors.acc,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.bg, card: colors.card, text: colors.ink, border: colors.line, primary: colors.acc,
        },
      }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <MainTabs
        user={user}
        onOpenProfile={() => setProfileOpen(true)}
      />
      <Modal
        visible={profileOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProfileOpen(false)}
      >
        <ProfileScreen
          user={user}
          onLogout={() => { setProfileOpen(false); setUser(null) }}
          onClose={() => setProfileOpen(false)}
        />
      </Modal>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
