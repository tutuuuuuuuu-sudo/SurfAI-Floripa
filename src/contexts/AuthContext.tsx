import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { identifyUser, resetUser } from '../lib/monitoring'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (name: string, email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let settled = false

    const resolve = (session: Session | null) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    // Fallback: se nem getSession nem onAuthStateChange responderem em 8s,
    // desbloqueia o app como usuário não autenticado
    const timeout = setTimeout(() => resolve(null), 8000)

    // onAuthStateChange dispara imediatamente com a sessão atual (INITIAL_SESSION)
    // e depois para cada mudança subsequente — é a fonte única de verdade
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        resolve(session)
        return
      }
      // Mudanças após o carregamento inicial
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user) {
        const u = session.user
        identifyUser(u.id, u.email ?? '', u.user_metadata?.full_name)
      } else {
        resetUser()
      }
    })

    // getSession como fallback caso onAuthStateChange demore (versões antigas do SDK)
    supabase.auth.getSession()
      .then(({ data: { session } }) => resolve(session))
      .catch(() => resolve(null))

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
