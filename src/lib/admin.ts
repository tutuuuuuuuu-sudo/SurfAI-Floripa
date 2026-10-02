import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Checa uma vez se o usuário logado está na tabela `admins` (via api/is-admin.ts — a tabela não é
// lida pelo navegador, RLS bloqueia). null = ainda carregando. Usado pelo Registro do mar real e
// pelo atalho dele em Configurações (ContentStudio tem a própria checagem).
export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) { if (!cancelled) setIsAdmin(false); return }
      fetch('/api/is-admin', { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(res => res.json())
        .then((data: { isAdmin?: boolean }) => { if (!cancelled) setIsAdmin(!!data.isAdmin) })
        .catch(() => { if (!cancelled) setIsAdmin(false) })
    })
    return () => { cancelled = true }
  }, [])
  return isAdmin
}
