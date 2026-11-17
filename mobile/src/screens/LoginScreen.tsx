import { useState } from 'react'
import {
  View, Text, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Pressable,
} from 'react-native'
import {
  login, registerStart, registerConfirm, registerResend,
} from '../auth'
import { ApiError } from '../apiError'
import { useTheme } from '../ThemeContext'
import { radius, space } from '../theme'
import { Field, Err, Btn } from '../ui'

type Mode = 'login' | 'register' | 'code'

function errText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Не удалось подключиться к серверу'
    if (e.status === 401) return 'Неверный логин или пароль'
    if (e.status === 409) return 'Такой email или логин уже занят'
    if (e.status === 429) return 'Слишком много попыток. Подождите немного.'
    if (e.status === 400 || e.status === 422) return 'Проверьте введённые данные'
    return 'Не удалось выполнить запрос. Попробуйте позже.'
  }
  return 'Что-то пошло не так'
}

export function LoginScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme()
  const [mode, setMode] = useState<Mode>('login')

  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')

  const [name, setName] = useState('')
  const [regLogin, setRegLogin] = useState('')
  const [email, setEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const goLogin = async () => {
    if (!loginValue.trim()) return setError('Введите логин')
    if (!password) return setError('Введите пароль')
    setBusy(true)
    setError('')
    try {
      await login(loginValue, password)
      onDone()
    } catch (e) {
      console.error('[login]', e)
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const goRegister = async () => {
    if (!name.trim()) return setError('Укажите имя')
    if (!regLogin.trim()) return setError('Введите логин')
    if (!email.trim()) return setError('Введите email')
    if (!regPassword || regPassword.length < 6) return setError('Пароль не менее 6 символов')
    setBusy(true)
    setError('')
    setDevCode(null)
    try {
      const res = await registerStart({
        name: name.trim(),
        login: regLogin.trim(),
        email: email.trim(),
        password: regPassword,
      })
      if (res.dev_code) setDevCode(res.dev_code)
      setMode('code')
    } catch (e) {
      console.error('[register]', e)
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const goConfirm = async () => {
    if (!code.trim()) return setError('Введите код подтверждения')
    setBusy(true)
    setError('')
    try {
      await registerConfirm(email, code)
      onDone()
    } catch (e) {
      console.error('[register/confirm]', e)
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const goResend = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await registerResend(email.trim())
      if (res.dev_code) setDevCode(res.dev_code)
    } catch (e) {
      console.error('[register/resend]', e)
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.line,
          padding: space.lg,
        }}
        >
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>Семейный бюджет</Text>

          {mode === 'login' && (
            <>
              <Text style={{ color: colors.mut, marginBottom: 16, marginTop: 4 }}>
                Вход по email или нику
              </Text>
              <Field
                label="Логин или email"
                autoCapitalize="none"
                autoCorrect={false}
                value={loginValue}
                onChangeText={setLoginValue}
              />
              <Field label="Пароль" secureTextEntry value={password} onChangeText={setPassword} />
              <Err>{error}</Err>
              <Btn title={busy ? '…' : 'Войти'} onPress={goLogin} disabled={busy} />
              <Pressable
                onPress={() => { setMode('register'); setError(''); setDevCode(null) }}
                style={{ marginTop: 16, alignItems: 'center' }}
              >
                <Text style={{ color: colors.acc, fontWeight: '600' }}>Создать аккаунт</Text>
              </Pressable>
            </>
          )}

          {mode === 'register' && (
            <>
              <Text style={{ color: colors.mut, marginBottom: 16, marginTop: 4 }}>Регистрация</Text>
              <Field label="Имя" value={name} onChangeText={setName} />
              <Field
                label="Логин"
                autoCapitalize="none"
                autoCorrect={false}
                value={regLogin}
                onChangeText={setRegLogin}
              />
              <Field
                label="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Field
                label="Пароль (не менее 6 символов)"
                secureTextEntry
                value={regPassword}
                onChangeText={setRegPassword}
              />
              <Err>{error}</Err>
              <Btn title={busy ? '…' : 'Получить код'} onPress={goRegister} disabled={busy} />
              <Pressable
                onPress={() => { setMode('login'); setError('') }}
                style={{ marginTop: 16, alignItems: 'center' }}
              >
                <Text style={{ color: colors.acc, fontWeight: '600' }}>Уже есть аккаунт? Войти</Text>
              </Pressable>
            </>
          )}

          {mode === 'code' && (
            <>
              <Text style={{ color: colors.mut, marginBottom: 16, marginTop: 4 }}>
                Код отправлен на {email}
              </Text>
              <Field
                label="Код подтверждения"
                autoCapitalize="none"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
              />
              {devCode ? (
                <Text style={{ color: colors.mut, fontSize: 12, marginBottom: 8 }}>
                  Код для разработки: {devCode}
                </Text>
              ) : null}
              <Err>{error}</Err>
              <Btn title={busy ? '…' : 'Подтвердить'} onPress={goConfirm} disabled={busy} />
              <Btn title="Отправить код снова" variant="gh" onPress={goResend} disabled={busy} style={{ marginTop: 8 }} />
              <Pressable
                onPress={() => { setMode('register'); setError(''); setCode('') }}
                style={{ marginTop: 16, alignItems: 'center' }}
              >
                <Text style={{ color: colors.acc, fontWeight: '600' }}>Назад</Text>
              </Pressable>
            </>
          )}

          {busy && <ActivityIndicator color={colors.acc} style={{ marginTop: 12 }} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
