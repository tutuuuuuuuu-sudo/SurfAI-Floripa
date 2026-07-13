import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { identifyUser, resetUser } from '../lib/monitoring'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isPasswordRecovery: boolean
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    // Captura o hash ANTES que o Supabase JS o consuma e limpe da URL.
    // Se o link de recovery abriu na raiz, redireciona para /reset-password preservando o hash.
    const hash = window.location.hash
    const isRecoveryUrl = hash.includes('type=recovery') ||
      new URLSearchParams(window.location.search).get('type') === 'recovery'

    if (isRecoveryUrl && window.location.pathname !== '/reset-password') {
      window.location.replace('/reset-password' + hash)
      return
    }

    if (isRecoveryUrl) {
      setIsPasswordRecovery(true)
      setLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setUser(null)
        setSession(null)
        setLoading(false)
        return
      }

      // SIGNED_IN logo após PASSWORD_RECOVERY = Supabase autenticou com token de recovery
      // Nesse caso manter isPasswordRecovery = true até o usuário salvar a nova senha
      if (event === 'SIGNED_IN' && isRecoveryUrl) {
        setIsPasswordRecovery(true)
        setUser(session?.user ?? null)
        setSession(session)
        setLoading(false)
        return
      }

      setIsPasswordRecovery(false)
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

    return () => subscription.unsubscribe()
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
    <AuthContext.Provider value={{ user, session, loading, isPasswordRecovery, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
