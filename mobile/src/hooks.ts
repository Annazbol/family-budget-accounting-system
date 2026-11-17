import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { api } from './api'

export function useList<T>(path: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasData = useRef(false)

  const reload = useCallback(async () => {
    // индикатор только при первой загрузке — не мигает при каждом фокусе вкладки
    if (!hasData.current) setLoading(true)
    setError('')
    try {
      const rows = await api<T[]>(path)
      setData(Array.isArray(rows) ? rows : [])
      hasData.current = true
    } catch {
      setError('Не удалось загрузить')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [path])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  return { data, loading, error, reload }
}
