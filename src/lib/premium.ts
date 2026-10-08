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
  // Mensal com renovação automática (assinatura do Mercado Pago, cobra no cartão todo mês)
  auto_renew: boolean
  mp_preapproval_id: string | null
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
    autoRenew: isPremium && subscription?.auto_renew === true,
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

// Chave pública do MP (painel → Credenciais de produção → Public Key, recebida em 08/out/2026). É
// pública por natureza (vai no código do site de qualquer jeito): só serve pra gerar o código do
// cartão no formulário do MP dentro do app (CardSubscriptionForm). NÃO confundir com o Access Token,
// que é secreto e fica só na Vercel. VITE_MP_PUBLIC_KEY, se existir, tem prioridade.
// Sem chave, a página Premium usa a renovação pela página do MP (exige conta no Mercado Pago).
export const MP_PUBLIC_KEY: string | undefined =
  (import.meta.env.VITE_MP_PUBLIC_KEY as string | undefined) || 'APP_USR-3d7b6332-b6f1-439f-9c42-b29ba29e99ad'

// autoRenew: mensal com renovação automática (só cartão); payerEmail = e-mail da conta do
// Mercado Pago de quem vai pagar (o checkout da assinatura exige que seja o mesmo)
export async function createMercadoPagoCheckout(
  userEmail: string,
  plan: 'monthly' | 'annual' = 'monthly',
  opts: { autoRenew?: boolean; payerEmail?: string } = {}
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
      body: JSON.stringify({ userEmail, plan, autoRenew: opts.autoRenew === true, payerEmail: opts.payerEmail }),
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

/** Assina o mensal com renovação automática usando o código (token) do cartão gerado pelo
 *  formulário do Mercado Pago dentro do app (CardSubscriptionForm) — sem conta no Mercado Pago. */
export async function subscribeWithCard(params: { cardToken: string; payerEmail: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return { ok: false, error: 'Usuário não autenticado' }
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: 'monthly', autoRenew: true, cardToken: params.cardToken, payerEmail: params.payerEmail }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.error ?? 'O cartão não foi aceito. Confira os dados ou tente outro cartão.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Erro de conexão. Tente de novo.' }
  }
}

/** Cancela a renovação automática do mensal. O Premium continua até o fim do mês já pago. */
export async function cancelAutoRenew(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return { ok: false, error: 'Usuário não autenticado' }
    const res = await fetch('/api/cancel-renewal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.error ?? 'Não deu pra cancelar agora. Tente de novo.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Erro de conexão. Tente de novo.' }
  }
}
