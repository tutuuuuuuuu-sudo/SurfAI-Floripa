import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Check, Crown, Loader2, CheckCircle2, XCircle, Clock,
  MessageCircle, Calendar, Bell, BarChart3, Zap, ShieldOff, TrendingDown, Lock, Gift
} from 'lucide-react'
import { createMercadoPagoCheckout, startPremiumTrial, usePremium, MP_PUBLIC_KEY } from '@/lib/premium'
import { CardSubscriptionForm } from '@/components/CardSubscriptionForm'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { track } from '@/lib/monitoring'
import {
  PRICE_MONTHLY, PRICE_ANNUAL, PRICE_ANNUAL_PER_MONTH, ANNUAL_SAVINGS, TRIAL_DAYS,
  formatBRL, perDayCeil,
} from '@/lib/pricing'

// Lista revista em 02/out/2026: saiu "Relatório de IA" (removido em 23/ago, virou o chat) e
// "Diário de surf" (é da conta grátis, não do Premium)
const PREMIUM_BENEFITS = [
  { icon: MessageCircle, title: 'Chat com o Surf AI', desc: 'Pergunte onde e quando surfar e receba a resposta com a previsão real das 14 praias.' },
  { icon: Calendar, title: 'Previsão 14 dias', desc: 'Planeje suas sessões com antecedência. Free tem apenas 3 dias.' },
  { icon: Bell, title: 'Alertas de swell', desc: 'Receba notificação quando suas praias favoritas estiverem boas.' },
  { icon: BarChart3, title: 'Histórico 30 dias', desc: 'Veja como as condições evoluíram nas últimas semanas.' },
  { icon: Zap, title: 'Melhor janela do dia', desc: 'Horário exato com melhores condições calculado hora a hora.' },
  { icon: ShieldOff, title: 'Sem anúncios', desc: 'Experiência limpa e sem interrupções.' },
  { icon: Crown, title: 'Badge Premium', desc: 'Destaque no perfil e nos relatos da comunidade.' },
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-rating-fair" />
            <span className="font-bold text-base">Surf AI Premium</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24 max-w-lg space-y-6">

        {/* Hero */}
        <div className="text-center space-y-3" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="relative inline-flex items-center justify-center w-20 h-20 mb-2">
            <div className="absolute inset-0 rounded-full bg-rating-fair/20 animate-pulse" />
            <div className="absolute -inset-1.5 rounded-full crown-ring animate-spin-slow" />
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 ring-4 ring-primary/30 shadow-lg shadow-primary/30">
              <Crown className="h-10 w-10 text-rating-fair" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">Surf AI Premium</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tudo que um surfista de Floripa precisa para não perder nenhuma boa sessão.
          </p>
        </div>

        {/* Retorno do pagamento */}
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

        {/* Já é premium (pagou ou ganhou cortesia) */}
        {!loadingStatus && paidPremium && (
          <Card className="border-rating-fair/40 bg-rating-fair/5" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <CardContent className="py-6 text-center space-y-2">
              <Crown className="h-8 w-8 text-rating-fair mx-auto" />
              <p className="font-bold text-lg">Você já é Premium!</p>
              {autoRenew ? (
                <p className="text-sm text-muted-foreground">
                  Renova sozinho todo mês no cartão. Próxima cobrança por volta de {formatDate(subscription?.expires_at)}.
                  Pra cancelar, é em Configurações.
                </p>
              ) : daysLeft <= RENEW_WINDOW_DAYS ? (
                <p className="text-sm text-muted-foreground">
                  Seu Premium vai até {formatDate(subscription?.expires_at)} ({daysLeft === 1 ? 'falta 1 dia' : `faltam ${daysLeft} dias`}).
                  Renove abaixo: os dias que faltam continuam valendo.
                </p>
              ) : daysLeft <= 400 ? (
                <p className="text-sm text-muted-foreground">Seu Premium vai até {formatDate(subscription?.expires_at)}.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Aproveite todos os benefícios exclusivos.</p>
              )}
              <Button className="mt-2" onClick={() => navigate('/')}>Ir para o app</Button>
            </CardContent>
          </Card>
        )}

        {/* Teste grátis em andamento */}
        {!loadingStatus && isTrial && (
          <Card className="border-rating-good/40 bg-rating-good/5" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <CardContent className="py-5 text-center space-y-1.5">
              <Gift className="h-7 w-7 text-rating-good mx-auto" />
              <p className="font-bold text-base">
                Seu teste grátis vai até {formatDate(subscription?.expires_at)}
              </p>
              <p className="text-sm text-muted-foreground">
                {daysLeft === 1 ? 'Falta 1 dia' : `Faltam ${daysLeft} dias`} com tudo liberado. Se assinar agora, os dias que sobraram do teste somam no plano.
              </p>
              <Button variant="outline" size="sm" className="mt-1" onClick={() => navigate('/')}>Ir para o app</Button>
            </CardContent>
          </Card>
        )}

        {/* Convite pro teste grátis (nunca testou, nunca assinou) */}
        {!loadingStatus && !isPremium && offerTrial && (
          <Card className="overflow-hidden border-rating-good/50" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <div className="text-center py-2 text-xs font-bold tracking-wider bg-rating-good/15 text-rating-good">
              {TRIAL_DAYS} DIAS GRÁTIS · SEM CARTÃO
            </div>
            <CardContent className="p-5 text-center space-y-3">
              <p className="font-bold text-lg leading-snug">Teste o Premium inteiro por {TRIAL_DAYS} dias</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Previsão de 14 dias, alertas, chat com o Surf AI e tudo mais. Não pedimos cartão e nada é cobrado no fim: você só paga se decidir assinar.
              </p>
              {trialError && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3">{trialError}</div>
              )}
              <Button className="w-full h-12 text-base font-bold" onClick={handleStartTrial} disabled={startingTrial}>
                {startingTrial
                  ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Liberando...</>
                  : <><Gift className="h-5 w-5 mr-2" />{canStartTrial ? `Começar meus ${TRIAL_DAYS} dias grátis` : `Criar conta e testar ${TRIAL_DAYS} dias grátis`}</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {!loadingStatus && !isPremium && offerTrial && (
          <p className="text-center text-xs font-semibold tracking-wider text-muted-foreground">OU ASSINE DIRETO</p>
        )}

        {/* Social proof */}
        {!isPremium && recentSignups && recentSignups >= 3 && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="h-2 w-2 rounded-full bg-rating-good animate-pulse" />
            <span><span className="font-semibold text-foreground">{recentSignups} surfistas</span> assinaram nos últimos 7 dias</span>
          </div>
        )}

        {/* Seletor de planos */}
        {showPlans && (
          <div className="flex rounded-xl bg-muted/60 p-1.5 border border-border" style={{ animation: 'slideUp 0.4s 0.05s ease-out both' }}>
            <button
              onClick={() => setSelectedPlan('annual')}
              className={`flex-1 flex flex-col items-center py-3 rounded-lg text-sm font-semibold transition-all relative ${
                selectedPlan === 'annual'
                  ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40 scale-[1.02]'
                  : 'text-foreground/70 hover:text-foreground hover:bg-card/50'
              }`}
            >
              <span>Anual</span>
              <span className={`text-xs font-bold ${selectedPlan === 'annual' ? 'text-primary-foreground' : 'text-rating-good'}`}>{formatBRL(PRICE_ANNUAL_PER_MONTH)}/mês</span>
              {selectedPlan === 'annual' && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-rating-good text-white border-0 text-[10px] px-1.5 py-0 whitespace-nowrap shadow-sm">
                  Economize R$ {ANNUAL_SAVINGS}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`flex-1 flex flex-col items-center py-3 rounded-lg text-sm font-semibold transition-all ${
                selectedPlan === 'monthly'
                  ? 'bg-card text-foreground shadow-md ring-2 ring-border scale-[1.02]'
                  : 'text-foreground/70 hover:text-foreground hover:bg-card/50'
              }`}
            >
              <span>Mensal</span>
              <span className={`text-xs font-bold ${selectedPlan === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>{formatBRL(PRICE_MONTHLY)}/mês</span>
            </button>
          </div>
        )}

        {/* Card de preço */}
        {showPlans && (
          <Card className="overflow-hidden border-primary/50" style={{ animation: 'slideUp 0.4s 0.1s ease-out both' }}>
            {selectedPlan === 'annual' && (
              <div className="text-center py-2 text-xs font-bold tracking-wider bg-primary text-primary-foreground">
                MELHOR VALOR · PLANO ANUAL
              </div>
            )}
            {selectedPlan === 'monthly' && (
              <div className="text-center py-2 text-xs font-bold tracking-wider bg-muted text-muted-foreground">
                PLANO MENSAL · CANCELE QUANDO QUISER
              </div>
            )}

            <CardContent className="p-6 space-y-5">
              {/* Preço com âncora */}
              <div className="relative text-center">
                <div className="absolute -z-10 inset-x-0 top-1/2 -translate-y-1/2 h-16 bg-rating-fair/15 blur-2xl pointer-events-none" />
                {selectedPlan === 'annual' ? (
                  <>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-sm text-muted-foreground mb-1">R$</span>
                      <span className="text-5xl font-bold text-rating-fair">{Math.floor(PRICE_ANNUAL_PER_MONTH)}</span>
                      <span className="text-2xl font-bold text-rating-fair">,{formatBRL(PRICE_ANNUAL_PER_MONTH).split(',')[1]}</span>
                      <span className="text-sm text-muted-foreground mb-1">/mês</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Cobrado uma vez por ano · {formatBRL(PRICE_ANNUAL)}</p>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-rating-good" />
                      <span className="text-xs font-semibold text-rating-good">Menos de {perDayCeil(PRICE_ANNUAL, 365)}/dia · você economiza R$ {ANNUAL_SAVINGS}/ano</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-sm text-muted-foreground mb-1">R$</span>
                      <span className="text-5xl font-bold text-rating-fair">{Math.floor(PRICE_MONTHLY)}</span>
                      <span className="text-2xl font-bold text-rating-fair">,{formatBRL(PRICE_MONTHLY).split(',')[1]}</span>
                      <span className="text-sm text-muted-foreground mb-1">/mês</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {monthlyAuto
                        ? <>Renova sozinho todo mês · cancele quando quiser</>
                        : <>Pagamento único de 30 dias, sem renovação</>}
                      {' '}· menos de {perDayCeil(PRICE_MONTHLY, 30)}/dia
                    </p>
                  </>
                )}
              </div>

              {/* Benefícios */}
              <div className="space-y-3">
                {PREMIUM_BENEFITS.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3"
                    style={{ animation: `slideUp 0.3s ${0.15 + idx * 0.05}s ease-out both` }}>
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-rating-fair/10 flex items-center justify-center">
                      <benefit.icon className="h-4 w-4 text-rating-fair" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{benefit.title}</div>
                      <div className="text-xs text-muted-foreground">{benefit.desc}</div>
                    </div>
                    <Check className="h-4 w-4 text-rating-fair flex-shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>

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
                <Button className="w-full h-12 text-base font-bold"
                  onClick={() => handleSubscribe(selectedPlan)} disabled={loading || loadingAnnual || loadingStatus}>
                  {(loading || loadingAnnual)
                    ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Redirecionando...</>
                    : selectedPlan === 'annual'
                      ? <><Crown className="h-5 w-5 mr-2" />{paidPremium ? 'Renovar' : 'Assinar'} por {formatBRL(PRICE_ANNUAL)}/ano</>
                      : <><Crown className="h-5 w-5 mr-2" />{paidPremium ? 'Renovar' : 'Assinar'} por {formatBRL(PRICE_MONTHLY)}/mês</>
                  }
                </Button>
              )}

              <div className="text-center space-y-1.5">
                {!useCardForm && (
                  <>
                    <p className="text-xs text-muted-foreground">Pagamento seguro via</p>
                    <div className="flex items-center justify-center gap-3">
                      {(useAutoRenew ? ['Cartão de crédito'] : ['Cartão', 'PIX', 'Boleto']).map(method => (
                        <span key={method} className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full">{method}</span>
                      ))}
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground/60">Mercado Pago · Dados 100% protegidos</p>
                {selectedPlan === 'monthly' && !cardSubscribed && (
                  <button type="button" onClick={() => { setMonthlyAuto(v => !v); setError(null) }}
                    className="pt-2 text-xs font-semibold text-primary hover:underline">
                    {monthlyAuto
                      ? 'Prefere Pix ou boleto? Pagar 1 mês avulso'
                      : MP_PUBLIC_KEY
                        ? 'Quer que renove sozinho todo mês? Assinar com cartão de crédito'
                        : 'Quer que renove sozinho todo mês? Ligar a renovação automática (precisa de conta no Mercado Pago)'}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparativo Free vs Premium */}
        {!isPremium && (
          <Card style={{ animation: 'slideUp 0.4s 0.35s ease-out both' }}>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold mb-4 text-center">Free vs Premium</h3>
              <div className="space-y-2.5">
                {([
                  { feature: 'Condições em tempo real',       free: true,  premium: true },
                  { feature: 'Nota de IA das praias',         free: true,  premium: true },
                  { feature: 'Navegação GPS',                 free: true,  premium: true },
                  { feature: 'Relatos de surfistas',          free: true,  premium: true },
                  { feature: 'Previsão 3 dias',               free: true,  premium: true },
                  { feature: 'Previsão 14 dias',              free: false, premium: true },
                  { feature: 'Chat com o Surf AI',            free: false, premium: true },
                  { feature: 'Alertas de swell (push)',       free: false, premium: true },
                  { feature: 'Histórico 30 dias',             free: false, premium: true },
                  { feature: 'Melhor janela horária',         free: false, premium: true },
                  { feature: 'Comparar praias',               free: false, premium: true },
                  { feature: 'Sem anúncios',                  free: false, premium: true },
                  { feature: 'Badge Premium no perfil',       free: false, premium: true },
                ] as { feature: string; free: boolean; premium: boolean }[]).map((row, idx) => (
                  <div key={idx} className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}>
                    <span className="flex-1 text-muted-foreground">{row.feature}</span>
                    <div className="flex gap-8">
                      <span className="w-10 text-center">
                        {row.free
                          ? <Check className="h-3.5 w-3.5 text-rating-good mx-auto" />
                          : <span className="text-muted-foreground/30 text-base leading-none">—</span>
                        }
                      </span>
                      <span className="w-10 text-center">
                        <Check className="h-3.5 w-3.5 text-rating-fair mx-auto" />
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="flex-1" />
                  <div className="flex gap-8">
                    <span className="w-10 text-center text-xs text-muted-foreground font-medium">Free</span>
                    <span className="w-10 text-center text-xs text-rating-fair font-bold">Premium</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isPremium && (
          <div className="text-center space-y-1 pb-6" style={{ animation: 'fadeIn 0.5s 0.5s ease-out both' }}>
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Pagamento seguro · Cancele quando quiser</p>
            <p className="text-xs text-muted-foreground/60">Dúvidas? surfaifloripa@gmail.com</p>
          </div>
        )}
      </main>
    </div>
  )
}
