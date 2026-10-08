import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Check, Crown, Loader2, CheckCircle2, XCircle, Clock, Lock, Gift, Minus,
  ChevronDown, QrCode, CreditCard, Barcode, ArrowDown, type LucideIcon,
} from 'lucide-react'
import { createMercadoPagoCheckout, startPremiumTrial, usePremium, MP_PUBLIC_KEY } from '@/lib/premium'
import { CardSubscriptionForm } from '@/components/CardSubscriptionForm'
import { MembershipCard } from '@/components/premium/MembershipCard'
import { PremiumShowcase } from '@/components/premium/PremiumShowcase'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { track } from '@/lib/monitoring'
import {
  PRICE_MONTHLY, PRICE_ANNUAL, PRICE_ANNUAL_PER_MONTH, ANNUAL_SAVINGS, TRIAL_DAYS,
  formatBRL, perDayCeil,
} from '@/lib/pricing'

// Visual refeito em 08/out/2026 ("muito feia, simples, não parece que estou adquirindo uma coisa
// muito boa"): carteirinha Premium no topo (MembershipCard), recursos funcionando com o mar de
// agora (PremiumShowcase) no lugar da lista de 7 benefícios, planos em dois cartões grandes e a
// tabela Free vs Premium recolhida. A lógica de pagamento não mudou.

const FREE_VS_PREMIUM: { feature: string; free: boolean }[] = [
  { feature: 'Condições em tempo real', free: true },
  { feature: 'Nota de IA das praias', free: true },
  { feature: 'Navegação GPS', free: true },
  { feature: 'Relatos de surfistas', free: true },
  { feature: 'Previsão 3 dias', free: true },
  { feature: 'Previsão 14 dias', free: false },
  { feature: 'Chat com o Surf AI', free: false },
  { feature: 'Alertas de swell (push)', free: false },
  { feature: 'Histórico 30 dias', free: false },
  { feature: 'Melhor janela horária', free: false },
  { feature: 'Comparar praias', free: false },
  { feature: 'Sem anúncios', free: false },
  { feature: 'Badge Premium no perfil', free: false },
]

// Nome na carteirinha: o do Google quando tem, senão o começo do e-mail. Só o primeiro e o
// último nome, pra caber
function holderName(meta: Record<string, unknown> | undefined, email: string | undefined): string {
  const full = (typeof meta?.full_name === 'string' && meta.full_name) || (typeof meta?.name === 'string' && meta.name) || ''
  const words = full.trim().split(/\s+/).filter(Boolean)
  if (words.length) return words.length > 1 ? `${words[0]} ${words[words.length - 1]}` : words[0]
  return email?.split('@')[0] || 'Surfista de Floripa'
}

function PlanOption({ selected, onSelect, name, price, lines, ribbon }: {
  selected: boolean; onSelect: () => void; name: string; price: number; lines: string[]; ribbon?: string
}) {
  const [int, cents] = formatBRL(price).replace('R$ ', '').split(',')
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={`relative flex flex-col items-start rounded-2xl border-2 p-4 pt-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected
        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/15'
        : 'border-border bg-card/60 hover:border-primary/40'}`}>
      {ribbon && (
        <span className="absolute -top-3 left-3 rounded-full bg-rating-good px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
          {ribbon}
        </span>
      )}
      <span className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="text-sm font-semibold">{name}</span>
      <span className="mt-1 flex items-baseline gap-0.5 tabular-nums">
        <span className="text-xs text-muted-foreground">R$</span>
        <span className={`text-4xl font-black leading-none ${selected ? 'text-rating-fair' : ''}`}>{int}</span>
        <span className={`text-lg font-black ${selected ? 'text-rating-fair' : ''}`}>,{cents}</span>
        <span className="text-xs text-muted-foreground">/mês</span>
      </span>
      {lines.map(l => <span key={l} className="mt-1 text-[11px] leading-snug text-muted-foreground">{l}</span>)}
    </button>
  )
}

const PAY_METHODS: { icon: LucideIcon; label: string }[] = [
  { icon: QrCode, label: 'Pix' },
  { icon: CreditCard, label: 'Cartão' },
  { icon: Barcode, label: 'Boleto' },
]

// Quem pagou (plano sem renovação automática) vê as opções de novo quando faltam até 10 dias —
// é pra onde o lembrete de fim de plano (api/plan-reminders.ts) manda a pessoa
const RENEW_WINDOW_DAYS = 10

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''

export default function PremiumPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { isPremium, isTrial, autoRenew, daysLeft, canStartTrial, offerTrial, subscription, loading: loadingStatus, refresh } = usePremium()
  const [loading, setLoading] = useState(false)
  const [loadingAnnual, setLoadingAnnual] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trialError, setTrialError] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual')
  // Mensal: renovação automática ou 1 mês avulso (Pix, boleto ou cartão de qualquer banco).
  // Com o formulário de cartão dentro do app (MP_PUBLIC_KEY configurada), a renovação não precisa de
  // conta no Mercado Pago e volta a ser o padrão. Sem ele, a renovação passa pela página do MP, que
  // exige login numa conta do Mercado Pago — aí o padrão é o avulso
  const [monthlyAuto, setMonthlyAuto] = useState(!!MP_PUBLIC_KEY)
  // Assinou pelo formulário de cartão: a 1ª cobrança é confirmada pelo MP em até ~1 h
  const [cardSubscribed, setCardSubscribed] = useState(false)
  // E-mail da conta do Mercado Pago: o checkout da assinatura só aceita quem entra com esse e-mail
  const [mpEmail, setMpEmail] = useState<string | null>(null)
  const [recentSignups, setRecentSignups] = useState<number | null>(null)

  useEffect(() => {
    // Busca contagem de novos assinantes via RPC pública — não expõe dados individuais
    // A função SQL deve ter SECURITY DEFINER e retornar apenas um número agregado
    supabase
      .rpc('count_recent_premium', { since_days: 7 })
      .then(({ data }) => { if (typeof data === 'number' && data >= 3) setRecentSignups(data) }, () => {})
  }, [])

  const paymentStatus = searchParams.get('status') as 'success' | 'failure' | 'pending' | 'assinatura' | null

  useEffect(() => {
    if (paymentStatus === 'success' || paymentStatus === 'assinatura') {
      // Limpa os params da URL sem recarregar
      window.history.replaceState({}, '', '/premium')
    }
  }, [paymentStatus])

  const handleStartTrial = async () => {
    if (!user) { navigate('/login?plan=premium'); return }
    setStartingTrial(true)
    setTrialError(null)
    const result = await startPremiumTrial()
    setStartingTrial(false)
    if (!result.ok) { setTrialError(result.error ?? 'Não deu pra começar o teste agora.'); return }
    track('trial_started')
    refresh()
  }

  // Teste em andamento, plano pago perto do fim, ou ainda não é Premium: mostra os planos
  // (quem renova sozinho não precisa renovar à mão)
  const showPlans = !isPremium || isTrial || (!autoRenew && daysLeft <= RENEW_WINDOW_DAYS)
  const paidPremium = isPremium && !isTrial
  const useAutoRenew = selectedPlan === 'monthly' && monthlyAuto
  const useCardForm = useAutoRenew && !!MP_PUBLIC_KEY

  const handleSubscribe = async (plan: 'monthly' | 'annual' = 'monthly') => {
    if (!user) { navigate('/login'); return }
    if (plan === 'annual') setLoadingAnnual(true); else setLoading(true)
    setError(null)
    try {
      const result = await createMercadoPagoCheckout(user.email ?? '', plan, plan === 'monthly' && monthlyAuto
        ? { autoRenew: true, payerEmail: (mpEmail ?? user.email ?? '').trim() }
        : {})
      if (result.url) {
        window.location.href = result.url
      } else {
        setError(result.error ?? 'Não foi possível iniciar o pagamento. Tente novamente.')
      }
    } catch {
      setError('Erro ao conectar com o Mercado Pago. Tente novamente.')
    } finally {
      setLoading(false)
      setLoadingAnnual(false)
    }
  }


  // Carteirinha: mostra o plano escolhido (ou o que a pessoa já tem)
  const card = paidPremium
    ? (autoRenew
      ? { plan: 'Renova todo mês', detail: 'Ativo' }
      : daysLeft <= 400 ? { plan: 'Válido até', detail: formatDate(subscription?.expires_at) } : { plan: 'Membro', detail: 'Ativo' })
    : isTrial
      ? { plan: 'Teste grátis', detail: `até ${formatDate(subscription?.expires_at)}` }
      : selectedPlan === 'annual'
        ? { plan: 'Plano anual', detail: `${formatBRL(PRICE_ANNUAL_PER_MONTH)}/mês` }
        : { plan: 'Plano mensal', detail: `${formatBRL(PRICE_MONTHLY)}/mês` }

  const heroTitle = paidPremium ? 'Você é Premium.' : isTrial ? 'Seu teste grátis está rolando.' : 'Nunca mais perca o mar clássico.'
  const heroText = paidPremium
    ? autoRenew
      ? `Renova sozinho todo mês no cartão. Próxima cobrança por volta de ${formatDate(subscription?.expires_at)}. Pra cancelar, é em Configurações.`
      : daysLeft <= RENEW_WINDOW_DAYS
        ? `Seu Premium vai até ${formatDate(subscription?.expires_at)} (${daysLeft === 1 ? 'falta 1 dia' : `faltam ${daysLeft} dias`}). Renove abaixo: os dias que faltam continuam valendo.`
        : daysLeft <= 400 ? `Seu Premium vai até ${formatDate(subscription?.expires_at)}.` : 'Aproveite todos os benefícios.'
    : isTrial
      ? `${daysLeft === 1 ? 'Falta 1 dia' : `Faltam ${daysLeft} dias`} com tudo liberado. Se assinar agora, os dias que sobraram do teste somam no plano.`
      : 'Previsão de 14 dias, alerta no celular quando sua praia fica boa e um chat que conhece as 14 praias da ilha.'

  // Quem não tem mais teste grátis pra pegar vê os planos logo depois da carteirinha
  const plansFirst = !loadingStatus && showPlans && !offerTrial
  const scrollToPlans = () => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const plans = showPlans && (
    <section id="planos" className="scroll-mt-20 space-y-4" style={{ animation: 'slideUp 0.5s 0.15s ease-out both' }}>
      <h2 className="text-center text-2xl font-black">
        {offerTrial && !isPremium ? 'Ou assine direto' : paidPremium ? 'Renove seu plano' : 'Escolha seu plano'}
      </h2>

      {/* Social proof */}
      {!isPremium && recentSignups && recentSignups >= 3 && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-rating-good animate-pulse" />
          <span><span className="font-semibold text-foreground">{recentSignups} surfistas</span> assinaram nos últimos 7 dias</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <PlanOption selected={selectedPlan === 'annual'} onSelect={() => { setSelectedPlan('annual'); setError(null) }}
          name="Anual" price={PRICE_ANNUAL_PER_MONTH} ribbon={`Economize R$ ${ANNUAL_SAVINGS}`}
          lines={[`${formatBRL(PRICE_ANNUAL)} por ano`, `menos de ${perDayCeil(PRICE_ANNUAL, 365)}/dia`]} />
        <PlanOption selected={selectedPlan === 'monthly'} onSelect={() => { setSelectedPlan('monthly'); setError(null) }}
          name="Mensal" price={PRICE_MONTHLY}
          lines={[monthlyAuto ? 'Renova todo mês' : '30 dias, sem renovação', monthlyAuto ? 'Cancele quando quiser' : `menos de ${perDayCeil(PRICE_MONTHLY, 30)}/dia`]} />
      </div>

      <Card className="border-primary/30">
        <CardContent className="space-y-4 p-5">
          {!useCardForm && (
            <p className="text-center text-sm text-muted-foreground">
              {selectedPlan === 'annual'
                ? <>Pagamento único de <span className="font-semibold text-foreground">{formatBRL(PRICE_ANNUAL)}</span>. Vale 12 meses.</>
                : useAutoRenew
                  ? <>{formatBRL(PRICE_MONTHLY)} no cartão de crédito todo mês, até você cancelar.</>
                  : <>Pagamento único de <span className="font-semibold text-foreground">{formatBRL(PRICE_MONTHLY)}</span>. Vale 30 dias.</>}
            </p>
          )}

          {useAutoRenew && !useCardForm && (
            <div className="space-y-1.5">
              <label htmlFor="mp-email" className="text-xs font-semibold">E-mail da sua conta do Mercado Pago</label>
              <input
                id="mp-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={mpEmail ?? user?.email ?? ''}
                onChange={e => setMpEmail(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                A assinatura fica na sua conta do Mercado Pago e só funciona com o mesmo e-mail dela. Se for diferente do e-mail do app, troque aqui.
              </p>
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 text-center">{error}</div>
          )}

          {useCardForm ? (
            // Formulário de cartão do MP dentro do app: o próprio formulário tem o botão de pagar
            !cardSubscribed && user && (
              <CardSubscriptionForm email={user.email ?? ''} onSubscribed={() => { setCardSubscribed(true); track('subscription_card') }} />
            )
          ) : (
            <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/25"
              onClick={() => handleSubscribe(selectedPlan)} disabled={loading || loadingAnnual || loadingStatus}>
              {(loading || loadingAnnual)
                ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Abrindo o Mercado Pago...</>
                : selectedPlan === 'annual'
                  ? <><Crown className="h-5 w-5 mr-2" />{paidPremium ? 'Renovar' : 'Assinar'} por {formatBRL(PRICE_ANNUAL)}/ano</>
                  : <><Crown className="h-5 w-5 mr-2" />{paidPremium ? 'Renovar' : 'Assinar'} por {formatBRL(PRICE_MONTHLY)}/mês</>
              }
            </Button>
          )}

          {!useCardForm && (
            <div className="flex items-center justify-center gap-2">
              {(useAutoRenew ? [{ icon: CreditCard, label: 'Cartão de crédito' }] : PAY_METHODS).map(m => (
                <span key={m.label} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                  <m.icon className="h-3.5 w-3.5" />{m.label}
                </span>
              ))}
            </div>
          )}

          {selectedPlan === 'monthly' && !cardSubscribed && (
            <div className="text-center">
              <button type="button" onClick={() => { setMonthlyAuto(v => !v); setError(null) }}
                className="text-xs font-semibold text-primary hover:underline">
                {monthlyAuto
                  ? 'Prefere Pix ou boleto? Pagar 1 mês avulso'
                  : MP_PUBLIC_KEY
                    ? 'Quer que renove sozinho todo mês? Assinar com cartão de crédito'
                    : 'Quer que renove sozinho todo mês? Ligar a renovação automática (precisa de conta no Mercado Pago)'}
              </button>
            </div>
          )}

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80">
            <Lock className="h-3 w-3" />Pagamento processado pelo Mercado Pago
          </p>
        </CardContent>
      </Card>
    </section>
  )

  const showcase = <PremiumShowcase title={isPremium ? 'O que você tem no Premium' : 'O que muda no seu surf'} />

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-rating-fair" />
            <span className="font-bold text-sm">Surf AI Premium</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto max-w-lg space-y-12 px-4 pt-6 pb-28">

        {/* Retorno do pagamento */}
        {(paymentStatus === 'success' || ((paymentStatus === 'assinatura' || cardSubscribed) && !(isPremium && autoRenew)) || paymentStatus === 'pending' || paymentStatus === 'failure') && (
          <div className="space-y-3">
            {paymentStatus === 'success' && (
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-rating-good/30 bg-rating-good/5">
                <CheckCircle2 className="h-5 w-5 text-rating-good flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-rating-good">Pagamento confirmado!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Seu acesso Premium está sendo ativado. Pode levar alguns segundos.</p>
                </div>
              </div>
            )}
            {(paymentStatus === 'assinatura' || cardSubscribed) && !(isPremium && autoRenew) && (
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-rating-good/30 bg-rating-good/5">
                <CheckCircle2 className="h-5 w-5 text-rating-good flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-rating-good">Assinatura feita!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">O Mercado Pago confirma a primeira cobrança em até 1 hora. Seu Premium libera aqui assim que confirmar, não precisa fazer mais nada.</p>
                </div>
              </div>
            )}
            {paymentStatus === 'pending' && (
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-rating-fair/30 bg-rating-fair/5">
                <Clock className="h-5 w-5 text-rating-fair flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-rating-fair">Pagamento em análise</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Boleto ou PIX pode levar até 1 dia útil para confirmar.</p>
                </div>
              </div>
            )}
            {paymentStatus === 'failure' && (
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-destructive/30 bg-destructive/5">
                <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-destructive">Pagamento não concluído</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tente novamente ou use outro método de pagamento.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Topo: promessa + carteirinha */}
        <section className="space-y-7 text-center">
          <div className="space-y-3" style={{ animation: 'slideUp 0.6s ease-out both' }}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Surf AI Premium</p>
            <h1 className="text-[2.15rem] font-black leading-[1.05] tracking-tight text-balance">{heroTitle}</h1>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground text-balance">{heroText}</p>
          </div>

          <MembershipCard holder={holderName(user?.user_metadata, user?.email)} plan={card.plan} detail={card.detail} />

          {!loadingStatus && (paidPremium || isTrial) && (
            <Button variant={isTrial ? 'outline' : 'default'} onClick={() => navigate('/')}>Ir para o app</Button>
          )}

          {!loadingStatus && !isPremium && offerTrial && (
            <div className="space-y-3" style={{ animation: 'slideUp 0.5s 0.4s ease-out both' }}>
              {trialError && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3">{trialError}</div>
              )}
              <Button className="w-full h-14 text-base font-bold shadow-lg shadow-primary/30" onClick={handleStartTrial} disabled={startingTrial}>
                {startingTrial
                  ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Liberando...</>
                  : <><Gift className="h-5 w-5 mr-2" />{canStartTrial ? `Começar meus ${TRIAL_DAYS} dias grátis` : `Criar conta e testar ${TRIAL_DAYS} dias grátis`}</>}
              </Button>
              <p className="text-xs text-muted-foreground">Sem cartão. Nada é cobrado no fim: você só paga se decidir assinar.</p>
              <button type="button" onClick={scrollToPlans}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Ver os planos<ArrowDown className="h-3 w-3" />
              </button>
            </div>
          )}
        </section>

        {plansFirst ? <>{plans}{showcase}</> : <>{showcase}{plans}</>}

        {/* Comparativo Free vs Premium, recolhido */}
        {!isPremium && (
          <details className="group rounded-2xl border border-border/60 bg-card/60">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Comparar com a conta grátis
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-3 pb-4">
              <div className="flex items-center justify-end gap-2 px-3 pb-2 text-[11px]">
                <span className="w-14 text-center text-muted-foreground">Grátis</span>
                <span className="w-14 text-center font-bold text-rating-fair">Premium</span>
              </div>
              {FREE_VS_PREMIUM.map((row, idx) => (
                <div key={row.feature} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <span className="flex-1 text-muted-foreground">{row.feature}</span>
                  <span className="flex w-14 justify-center">
                    {row.free ? <Check className="h-3.5 w-3.5 text-rating-good" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  </span>
                  <span className="flex w-14 justify-center"><Check className="h-3.5 w-3.5 text-rating-fair" /></span>
                </div>
              ))}
            </div>
          </details>
        )}

        <p className="text-center text-xs text-muted-foreground/70">Dúvidas? surfaifloripa@gmail.com</p>
      </main>
    </div>
  )
}
