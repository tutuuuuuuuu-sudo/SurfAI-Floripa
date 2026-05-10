import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '@/contexts/AuthContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PremiumStatus = 'loading' | 'free' | 'premium' | 'cancelled'

export interface Subscription {
  id: string
  user_id: string
  status: PremiumStatus
  mp_payment_id: string | null
  mp_preference_id: string | null
  started_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function usePremium() {
  const { user } = useAuth()
  const [status, setStatus] = useState<PremiumStatus>('loading')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

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
        console.error('[premium] erro ao buscar assinatura:', error)
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

    fetchSubscription()

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
      supabase.removeChannel(channel)
    }
  }, [user])

  return {
    isPremium: status === 'premium',
    status,
    subscription,
    loading,
  }
}

// ─── Checkout Mercado Pago ────────────────────────────────────────────────────

export async function createMercadoPagoCheckout(
  userId: string,
  userEmail: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userEmail }),
    })
    if (!res.ok) throw new Error('Falha ao criar preferência de pagamento')
    const data = await res.json()
    return data.init_point ?? null
  } catch (err) {
    console.error('[premium] erro ao criar checkout:', err)
    return null
  }
}

// ─── Benefícios e preço ───────────────────────────────────────────────────────

export const PREMIUM_BENEFITS = [
  {
    icon: 'Calendar',
    title: 'Previsão 14 dias',
    desc: 'Veja as condições dos próximos 14 dias em todas as praias',
  },
  {
    icon: 'Bell',
    title: 'Alertas de ondas',
    desc: 'Receba notificações push quando as condições estiverem perfeitas',
  },
  {
    icon: 'BarChart3',
    title: 'Histórico de condições',
    desc: 'Consulte como estava o mar nos últimos 7 dias',
  },
  {
    icon: 'ShieldOff',
    title: 'Sem anúncios',
    desc: 'Navegue pelo app sem nenhum anúncio',
  },
  {
    icon: 'Crown',
    title: 'Badge Premium',
    desc: 'Destaque no seu perfil com o selo de surfista premium',
  },
] as const

export const PREMIUM_PRICE = 'R$ 29,90'
export const PREMIUM_PRICE_MONTHLY = 29.90
