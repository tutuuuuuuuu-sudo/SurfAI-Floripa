import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import { fetchCurrentConditions, getCurrentConditions, BeachCondition } from '@/lib/surfData'

interface SurfDataContextType {
  conditions: BeachCondition[]
  loading: boolean
  error: boolean
  lastUpdated: Date | null
  refresh: () => void
}

const SurfDataContext = createContext<SurfDataContextType>({
  conditions: [],
  loading: true,
  error: false,
  lastUpdated: null,
  refresh: () => {},
})

const REFRESH_INTERVAL = 15 * 60 * 1000

export function SurfDataProvider({ children }: { children: ReactNode }) {
  const [conditions, setConditions] = useState<BeachCondition[]>(() => getCurrentConditions())
  const [loading, setLoading] = useState(conditions.length === 0)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(conditions.length > 0 ? new Date() : null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref (não state) porque `load` só é criada uma vez e fica presa no setInterval
  // do efeito abaixo — se dependesse de `conditions` via closure, o setInterval
  // ficaria travado no valor de conditions do momento da montagem pra sempre.
  const conditionsRef = useRef(conditions)
  useEffect(() => { conditionsRef.current = conditions }, [conditions])

  const load = useCallback(async () => {
    try {
      const data = await fetchCurrentConditions()
      setConditions(data)
      setLastUpdated(new Date())
      setError(false)
    } catch {
      // mantém dados anteriores em caso de falha, mas sinaliza erro se não tinha
      // nenhum dado ainda (senão Home.tsx não tem como distinguir "erro de rede"
      // de "filtro de região sem resultado")
      setError(conditionsRef.current.length === 0)
    } finally {
      setLoading(false)
    }
  }, [])

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
    <SurfDataContext.Provider value={{ conditions, loading, error, lastUpdated, refresh }}>
      {children}
    </SurfDataContext.Provider>
  )
}

export function useSurfData() {
  return useContext(SurfDataContext)
}
