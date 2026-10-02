import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '@/contexts/AuthContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PremiumStatus = 'loading' | 'free' | 'premium' | 'cancelled'

export interface Subscription {
  id: string
  user_id: string
  status: PremiumStatus
  // 'trial' = teste grátis de 15 dias (start_trial no banco); cortesias são 'annual' com amount 0
  plan: 'monthly' | 'annual' | 'trial'
  amount: number | null
  mp_payment_id: string | null
  mp_preference_id: string | null
  started_at: string | null
  expires_at: string | null
  trial_started_at: string | null
  created_at: string
  updated_at: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Dias (arredondados pra cima) até expires_at; 0 se já passou ou não tem data. */
export function daysUntil(expiresAt: string | null | undefined, now = Date.now()): number {
  if (!expiresAt) return 0
  const diff = new Date(expiresAt).getTime() - now
  return diff > 0 ? Math.ceil(diff / DAY_MS) : 0
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function usePremium() {
  const { user } = useAuth()
  const [status, setStatus] = useState<PremiumStatus>('loading')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  // Recarregar sob demanda (depois de começar o teste grátis) sem refazer o canal realtime —
  // recriar o canal com o mesmo nome já derrubou a Home uma vez (ver CLAUDE.md, 13/ago/2026).
  const refetchRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!user) {
      setStatus('free')
      setSubscription(null)
      setLoading(false)
      return
    }

    const fetchSubscription = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        setStatus('free')
        setLoading(false)
        return
      }

      if (!data) {
        setStatus('free')
        setSubscription(null)
        setLoading(false)
        return
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setStatus('free')
      } else {
        setStatus(data.status as PremiumStatus)
      }

      setSubscription(data)
      setLoading(false)
    }

    refetchRef.current = fetchSubscription
    fetchSubscription()

    // Realtime pode perder eventos durante uma desconexão (app em background, troca de rede).
    // Revalida ao voltar o foco/visibilidade para não ficar preso a um status desatualizado.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchSubscription()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    const channel = supabase
      .channel(`subscription:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Subscription
          if (updated.expires_at && new Date(updated.expires_at) < new Date()) {
            setStatus('free')
          } else {
            setStatus(updated.status)
          }
          setSubscription(updated)
        }
      )
      .subscribe()

    return () => {
      refetchRef.current = null
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [user])

  const isPremium = status === 'premium'
  return {
    isPremium,
    // Teste grátis em andamento (continua sendo Premium pra todo o resto do app)
    isTrial: isPremium && subscription?.plan === 'trial',
    daysLeft: isPremium ? daysUntil(subscription?.expires_at) : 0,
    // Teste é uma vez por conta: só pra quem nunca teve linha em subscriptions (nunca
    // assinou, nunca testou, nunca ganhou cortesia) — mesma regra do start_trial no banco
    canStartTrial: !!user && !loading && subscription === null,
    // Pra texto de convite ("teste 15 dias grátis"): inclui quem ainda não entrou — quem chega
    // por anúncio cria a conta nova e pode testar
    offerTrial: !loading && (!user || subscription === null),
    status,
    subscription,
    loading,
    refresh: () => refetchRef.current?.(),
  }
}

// ─── Teste grátis ─────────────────────────────────────────────────────────────

/** Começa os 15 dias grátis da conta logada. A regra (uma vez por conta) fica no banco. */
export async function startPremiumTrial(): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('start_trial')
  if (error) return { ok: false, error: 'Não deu pra começar o teste agora. Tente de novo.' }
  if (data !== true) return { ok: false, error: 'O teste grátis já foi usado nesta conta.' }
  return { ok: true }
}

// ─── Checkout Mercado Pago ────────────────────────────────────────────────────

export async function createMercadoPagoCheckout(
  userEmail: string,
  plan: 'monthly' | 'annual' = 'monthly'
): Promise<{ url: string | null; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return { url: null, error: 'Usuário não autenticado' }

    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ userEmail, plan }),
    })
    const data = await res.json()
    if (!res.ok) {
      const detail = data?.detail ?? data?.error ?? 'Erro desconhecido do Mercado Pago'
      return { url: null, error: detail }
    }
    return { url: data.init_point ?? null }
  } catch {
    return { url: null, error: 'Erro ao conectar com o Mercado Pago. Tente novamente.' }
  }
}

