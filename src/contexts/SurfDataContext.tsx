import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { fetchCurrentConditions, getCurrentConditions, BeachCondition } from '@/lib/surfData'

interface SurfDataContextType {
  conditions: BeachCondition[]
  loading: boolean
  lastUpdated: Date | null
  refresh: () => void
}

const SurfDataContext = createContext<SurfDataContextType>({
  conditions: [],
  loading: true,
  lastUpdated: null,
  refresh: () => {},
})

const REFRESH_INTERVAL = 15 * 60 * 1000

export function SurfDataProvider({ children }: { children: ReactNode }) {
  const [conditions, setConditions] = useState<BeachCondition[]>(() => getCurrentConditions())
  const [loading, setLoading] = useState(conditions.length === 0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(conditions.length > 0 ? new Date() : null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    try {
      const data = await fetchCurrentConditions()
      setConditions(data)
      setLastUpdated(new Date())
    } catch {
      // mantém dados anteriores em caso de falha
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const refresh = () => {
    setLoading(true)
    load()
  }

  return (
    <SurfDataContext.Provider value={{ conditions, loading, lastUpdated, refresh }}>
      {children}
    </SurfDataContext.Provider>
  )
}

export function useSurfData() {
  return useContext(SurfDataContext)
}
