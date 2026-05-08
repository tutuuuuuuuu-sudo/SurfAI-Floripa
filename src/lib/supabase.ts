import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Variáveis de ambiente não configuradas. Operações de banco de dados estarão indisponíveis.')
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
)

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

/** Extrai o nome de exibição do usuário a partir do metadata, com fallback seguro */
export function getUserDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string | null }): string {
  const meta = user.user_metadata ?? {}
  return (
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    user.email?.split('@')[0] ??
    'Surfista'
  )
}
