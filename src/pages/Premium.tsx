import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Check, Crown, Loader2, CheckCircle2, XCircle, Clock,
  Sparkles, Calendar, Bell, BookOpen, BarChart3, Zap, ShieldOff
} from 'lucide-react'
import { createMercadoPagoCheckout, usePremium } from '@/lib/premium'
import { useAuth } from '@/contexts/AuthContext'

const PREMIUM_BENEFITS = [
  { icon: Sparkles, title: 'Relatório de IA personalizado', desc: 'IA analisa as condições e escreve um relatório diário pro seu nível de surf.' },
  { icon: Calendar, title: 'Previsão 14 dias', desc: 'Planeje suas sessões com antecedência. Free tem apenas 3 dias.' },
  { icon: Bell, title: 'Alertas de swell', desc: 'Receba notificação quando suas praias favoritas estiverem boas.' },
  { icon: BookOpen, title: 'Log de sessões', desc: 'Registre cada sessão com nota, duração e anotações. Veja seu histórico.' },
  { icon: BarChart3, title: 'Histórico 30 dias', desc: 'Veja como as condições evoluíram nas últimas semanas.' },
  { icon: Zap, title: 'Melhor janela do dia', desc: 'Horário exato com melhores condições calculado hora a hora.' },
  { icon: ShieldOff, title: 'Sem anúncios', desc: 'Experiência limpa e sem interrupções.' },
  { icon: Crown, title: 'Badge Premium', desc: 'Destaque no perfil e nos relatos da comunidade.' },
]

export default function PremiumPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { isPremium, loading: loadingStatus } = usePremium()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paymentStatus = searchParams.get('status') as 'success' | 'failure' | 'pending' | null

  useEffect(() => {
    if (paymentStatus === 'success') {
      // Limpa os params da URL sem recarregar
      window.history.replaceState({}, '', '/premium')
    }
  }, [paymentStatus])

  const handleSubscribe = async () => {
    if (!user) { navigate('/login'); return }
    setLoading(true)
    setError(null)
    try {
      const result = await createMercadoPagoCheckout(user.id, user.email ?? '')
      if (result.url) {
        window.location.href = result.url
      } else {
        setError(result.error ?? 'Não foi possível iniciar o pagamento. Tente novamente.')
      }
    } catch {
      setError('Erro ao conectar com o Mercado Pago. Tente novamente.')
    } finally {
      setLoading(false)
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
            <Crown className="h-5 w-5 text-yellow-500" />
            <span className="font-bold text-base">Surf AI Premium</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg space-y-6">

        {/* Hero */}
        <div className="text-center space-y-3" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-2"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #eab308 50%, #ca8a04 100%)', boxShadow: '0 0 40px rgba(234,179,8,0.3)' }}>
            <Crown className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Surf AI Premium</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Tudo que um surfista de Floripa precisa para não perder nenhuma boa sessão.
          </p>
        </div>

        {/* Retorno do pagamento */}
        {paymentStatus === 'success' && !isPremium && (
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-green-500">Pagamento confirmado!</p>
              <p className="text-xs text-muted-foreground mt-0.5">Seu acesso Premium está sendo ativado. Pode levar alguns segundos.</p>
            </div>
          </div>
        )}
        {paymentStatus === 'pending' && (
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5">
            <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-yellow-500">Pagamento em análise</p>
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

        {/* Já é premium */}
        {!loadingStatus && isPremium && (
          <Card className="border-yellow-500/40 bg-yellow-500/5" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <CardContent className="py-6 text-center space-y-2">
              <Crown className="h-8 w-8 text-yellow-500 mx-auto" />
              <p className="font-bold text-lg">Você já é Premium! 🤙</p>
              <p className="text-sm text-muted-foreground">Aproveite todos os benefícios exclusivos.</p>
              <Button className="mt-2" onClick={() => navigate('/')}>Ir para o app</Button>
            </CardContent>
          </Card>
        )}

        {/* Card de preço */}
        {!isPremium && (
          <Card className="overflow-hidden" style={{
            animation: 'slideUp 0.4s 0.1s ease-out both',
            border: '1.5px solid rgba(234,179,8,0.5)',
            background: 'linear-gradient(135deg, hsl(var(--card)) 0%, rgba(234,179,8,0.05) 100%)',
          }}>
            <div className="text-center py-2 text-xs font-bold tracking-wider"
              style={{ background: 'linear-gradient(90deg, #f59e0b, #eab308, #f59e0b)', color: 'white' }}>
              PLANO MAIS POPULAR
            </div>

            <CardContent className="p-6 space-y-5">
              {/* Preço */}
              <div className="text-center">
                <div className="flex items-end justify-center gap-1">
                  <span className="text-sm text-muted-foreground mb-1">R$</span>
                  <span className="text-5xl font-bold text-yellow-500">29</span>
                  <span className="text-2xl font-bold text-yellow-500">,90</span>
                  <span className="text-sm text-muted-foreground mb-1">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cancele quando quiser</p>
              </div>

              {/* Benefícios */}
              <div className="space-y-3">
                {PREMIUM_BENEFITS.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3"
                    style={{ animation: `slideUp 0.3s ${0.15 + idx * 0.05}s ease-out both` }}>
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                      <benefit.icon className="h-4 w-4 text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{benefit.title}</div>
                      <div className="text-xs text-muted-foreground">{benefit.desc}</div>
                    </div>
                    <Check className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 text-center">{error}</div>
              )}

              <Button className="w-full h-12 text-base font-bold"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #eab308)', color: 'white', border: 'none' }}
                onClick={handleSubscribe} disabled={loading || loadingStatus}>
                {loading
                  ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Redirecionando...</>
                  : <><Crown className="h-5 w-5 mr-2" />Assinar por R$ 29,90/mês</>
                }
              </Button>

              <div className="text-center space-y-1.5">
                <p className="text-xs text-muted-foreground">Pagamento seguro via</p>
                <div className="flex items-center justify-center gap-3">
                  {['💳 Cartão', '📱 PIX', '🏦 Boleto'].map(method => (
                    <span key={method} className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full">{method}</span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/60">Mercado Pago · Dados 100% protegidos</p>
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
                  { feature: 'Score IA das praias',           free: true,  premium: true },
                  { feature: 'Navegação GPS',                 free: true,  premium: true },
                  { feature: 'Relatos de surfistas',          free: true,  premium: true },
                  { feature: 'Previsão 3 dias',               free: true,  premium: true },
                  { feature: 'Previsão 14 dias',              free: false, premium: true },
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
                          ? <Check className="h-3.5 w-3.5 text-green-500 mx-auto" />
                          : <span className="text-muted-foreground/30 text-base leading-none">—</span>
                        }
                      </span>
                      <span className="w-10 text-center">
                        <Check className="h-3.5 w-3.5 text-yellow-500 mx-auto" />
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="flex-1" />
                  <div className="flex gap-8">
                    <span className="w-10 text-center text-xs text-muted-foreground font-medium">Free</span>
                    <span className="w-10 text-center text-xs text-yellow-500 font-bold">Premium</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isPremium && (
          <div className="text-center space-y-1 pb-6" style={{ animation: 'fadeIn 0.5s 0.5s ease-out both' }}>
            <p className="text-xs text-muted-foreground">🔒 Pagamento seguro · Cancele quando quiser</p>
            <p className="text-xs text-muted-foreground/60">Dúvidas? surfaifloripa@gmail.com</p>
          </div>
        )}
      </main>
    </div>
  )
}
