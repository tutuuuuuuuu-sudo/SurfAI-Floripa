import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Copy, Check, RefreshCw, Instagram, Sparkles, Zap,
  Hash, Crown, Lock, MessageCircle, Twitter, Clock, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { track } from '@/lib/monitoring'
import { getRatingInfo } from '@/lib/rating'
import { usePremium } from '@/lib/premium'

interface ContentResult {
  instagram: { caption: string; hashtags: string; fullPost: string }
  tiktok: { hook: string; caption: string; hashtags: string; fullPost: string }
  whatsapp: { text: string }
  twitter: { text: string }
  bestSpot: {
    name: string; score: number; waveHeight: number
    swellPeriod: number; windSpeed: number; windDirection: string
  }
  generatedAt: string
  tone: Tone
}

type Platform = 'instagram' | 'tiktok' | 'whatsapp' | 'twitter'
type Tone = 'animado' | 'informativo' | 'minimalista'

const PLATFORMS: { id: Platform; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'tiktok',    label: 'TikTok',    icon: Zap },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle },
  { id: 'twitter',   label: 'Twitter/X', icon: Twitter },
]

const TONES: { id: Tone; label: string; desc: string }[] = [
  { id: 'animado',     label: 'Animado',     desc: 'Empolgante, emojis, gírias' },
  { id: 'informativo', label: 'Informativo', desc: 'Dados, técnico, confiável' },
  { id: 'minimalista', label: 'Minimalista', desc: 'Curto, limpo, direto' },
]

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    track('content_studio_copied', { content_type: label ?? 'unknown' })
    toast.success(label ? `${label} copiado!` : 'Copiado!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const { color } = getRatingInfo(score)
  return <span className={`font-bold text-lg ${color}`}>{score}</span>
}

function PlatformContent({ content, platform }: { content: ContentResult; platform: Platform }) {
  const rating = getRatingInfo(content.bestSpot.score)

  if (platform === 'instagram') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Legenda</span>
            <CopyButton text={content.instagram.caption} label="Legenda" />
          </div>
          {/* Preview visual */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border/40">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Instagram className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs font-bold">surfai_floripa</div>
                <div className="text-xs text-muted-foreground">Florianópolis, SC</div>
              </div>
            </div>
            <div className={`text-xs font-bold mb-2 ${rating.color}`}>
              Score {content.bestSpot.score} — {rating.label}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content.instagram.caption}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
              <Hash className="w-3 h-3" /> Hashtags
            </span>
            <CopyButton text={content.instagram.hashtags} label="Hashtags" />
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-xs text-primary/80 leading-relaxed">
            {content.instagram.hashtags}
          </div>
        </div>
        <CopyButton text={content.instagram.fullPost} label="Post completo" />
      </div>
    )
  }

  if (platform === 'tiktok') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Hook (primeiros 2s)</span>
            <CopyButton text={content.tiktok.hook} label="Hook" />
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
            <div className="text-xs text-primary font-semibold mb-1 uppercase tracking-wide">▶ Gancho</div>
            <p className="text-sm font-bold leading-snug">{content.tiktok.hook}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Legenda</span>
            <CopyButton text={content.tiktok.caption} label="Legenda TikTok" />
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-sm">{content.tiktok.caption}</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
              <Hash className="w-3 h-3" /> Hashtags
            </span>
            <CopyButton text={content.tiktok.hashtags} label="Hashtags TikTok" />
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-xs text-primary/80 leading-relaxed">
            {content.tiktok.hashtags}
          </div>
        </div>
        <CopyButton text={content.tiktok.fullPost} label="Post TikTok completo" />
      </div>
    )
  }

  if (platform === 'whatsapp') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Mensagem</span>
            <CopyButton text={content.whatsapp.text} label="Mensagem WhatsApp" />
          </div>
          {/* Bolinha de chat do WhatsApp */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border/40">
            <div className="flex justify-start">
              <div className="bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{content.whatsapp.text}</p>
                <div className="text-xs text-muted-foreground mt-1 text-right">agora ✓✓</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (platform === 'twitter') {
    const charCount = content.twitter.text.length
    const isOver = charCount > 280
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tweet</span>
            <CopyButton text={content.twitter.text} label="Tweet" />
          </div>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/40">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Twitter className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs font-bold">Surf AI Floripa</div>
                <div className="text-xs text-muted-foreground">@surfaifloripa</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content.twitter.text}</p>
            <div className={`text-xs mt-2 text-right font-medium ${isOver ? 'text-destructive' : 'text-muted-foreground'}`}>
              {charCount}/280
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function HistoryItem({ item, onRestore }: { item: ContentResult; onRestore: (c: ContentResult) => void }) {
  const [open, setOpen] = useState(false)
  const rating = getRatingInfo(item.bestSpot.score)
  const time = new Date(item.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{time}</span>
          <span className={`text-xs font-bold ${rating.color}`}>{item.bestSpot.name} · {item.bestSpot.score}</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">{item.tone}</Badge>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground pt-2 line-clamp-2">{item.instagram.caption}</p>
          <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => onRestore(item)}>
            Restaurar este conteúdo
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ContentStudio() {
  const navigate = useNavigate()
  const { isPremium, loading: premiumLoading } = usePremium()
  const [content, setContent] = useState<ContentResult | null>(null)
  const [history, setHistory] = useState<ContentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activePlatform, setActivePlatform] = useState<Platform>('instagram')
  const [selectedTone, setSelectedTone] = useState<Tone>('animado')

  if (!premiumLoading && !isPremium) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Content Studio é Premium</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs">
          Gere legendas virais para Instagram, TikTok, WhatsApp e Twitter com as condições reais do mar.
        </p>
        <Button onClick={() => navigate('/premium')} className="gap-2">
          <Crown className="h-4 w-4" />Assinar Premium
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')} className="mt-2">Voltar ao início</Button>
      </div>
    )
  }

  async function generate() {
    setLoading(true)
    track('content_studio_generate_clicked', { tone: selectedTone })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Usuário não autenticado')

      const res = await fetch(`/api/content-agent?tone=${selectedTone}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Falha ao gerar conteúdo')
      const data = await res.json() as ContentResult
      const withTone = { ...data, tone: selectedTone }
      setContent(withTone)
      setHistory(prev => [withTone, ...prev].slice(0, 5))
      track('content_studio_generated', { best_spot: data.bestSpot.name, score: data.bestSpot.score, tone: selectedTone })
      toast.success('Conteúdo gerado com as condições de agora!')
    } catch {
      track('content_studio_error')
      toast.error('Não foi possível gerar o conteúdo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-base">Content Studio</h1>
            <p className="text-xs text-muted-foreground">Conteúdo viral gerado por IA</p>
          </div>
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">

        {/* Tom */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Tom do conteúdo:</p>
          <div className="flex gap-2">
            {TONES.map(tone => (
              <button
                key={tone.id}
                onClick={() => setSelectedTone(tone.id)}
                className={`flex-1 py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                  selectedTone === tone.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <div>{tone.label}</div>
                <div className={`text-[10px] font-normal mt-0.5 ${selectedTone === tone.id ? 'text-primary/70' : 'text-muted-foreground/60'}`}>
                  {tone.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Botão gerar */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-5">
            <div className="text-center space-y-3">
              <div className="text-sm text-muted-foreground">
                Gera legendas para Instagram, TikTok, WhatsApp e Twitter com as condições reais do mar agora
              </div>
              <Button onClick={generate} disabled={loading} className="w-full gap-2" size="lg">
                {loading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Gerando conteúdo...</>
                  : <><Zap className="w-4 h-4" />Gerar conteúdo agora</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>
        )}

        {/* Resultado */}
        {content && !loading && (
          <>
            {/* Condições usadas */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Baseado em:</span>
              <Badge variant="secondary" className="text-xs">{content.bestSpot.name}</Badge>
              <Badge variant="secondary" className="text-xs">{content.bestSpot.waveHeight}m · {content.bestSpot.swellPeriod}s</Badge>
              <Badge variant="secondary" className="text-xs">Score <ScoreBadge score={content.bestSpot.score} /></Badge>
            </div>

            {/* Seletor de plataforma */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {PLATFORMS.map(p => {
                const Icon = p.icon
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePlatform(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border flex-shrink-0 transition-all ${
                      activePlatform === p.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Conteúdo da plataforma ativa */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {(() => { const p = PLATFORMS.find(p => p.id === activePlatform)!; const Icon = p.icon; return <><Icon className="w-4 h-4" />{p.label}</> })()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PlatformContent content={content} platform={activePlatform} />
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={generate} className="flex-1 gap-2">
                <RefreshCw className="w-4 h-4" />Nova versão
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Gerado às {new Date(content.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}

        {/* Estado vazio */}
        {!content && !loading && (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <Sparkles className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm">Escolha o tom e clique em "Gerar conteúdo agora"</p>
            <p className="text-xs opacity-60">Instagram · TikTok · WhatsApp · Twitter/X</p>
          </div>
        )}

        {/* Histórico da sessão */}
        {history.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Gerados nesta sessão:</p>
            {history.slice(1).map((item, i) => (
              <HistoryItem key={i} item={item} onRestore={c => { setContent(c); setSelectedTone(c.tone) }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
