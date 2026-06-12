import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Copy, Check, RefreshCw, Instagram, Sparkles, Zap, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { track } from '@/lib/monitoring'
import { getRatingInfo } from '@/lib/rating'

interface ContentResult {
  instagram: { caption: string; hashtags: string; fullPost: string }
  tiktok: { hook: string; caption: string; hashtags: string; fullPost: string }
  bestSpot: {
    name: string; score: number; waveHeight: number
    swellPeriod: number; windSpeed: number; windDirection: string
  }
  generatedAt: string
}

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

export default function ContentStudio() {
  const navigate = useNavigate()
  const [content, setContent] = useState<ContentResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    track('content_studio_generate_clicked')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Usuário não autenticado')

      const res = await fetch('/api/content-agent', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Falha ao gerar conteúdo')
      const data = await res.json() as ContentResult
      setContent(data)
      track('content_studio_generated', { best_spot: data.bestSpot.name, score: data.bestSpot.score })
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
      {/* Header */}
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

      <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">

        {/* Botão principal */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-5">
            <div className="text-center space-y-3">
              <div className="text-sm text-muted-foreground">
                Gera legendas otimizadas para Instagram e TikTok baseadas nas condições reais do mar agora
              </div>
              <Button onClick={generate} disabled={loading} className="w-full gap-2" size="lg">
                {loading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Gerando conteúdo...</>
                  : <><Zap className="w-4 h-4" /> Gerar conteúdo agora</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-52 w-full rounded-xl" />
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>
        )}

        {/* Resultado */}
        {content && !loading && (
          <>
            {/* Condições usadas */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Baseado em:</span>
              <Badge variant="secondary" className="gap-1 text-xs">
                {content.bestSpot.name}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                {content.bestSpot.waveHeight}m · {content.bestSpot.swellPeriod}s
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                Score <ScoreBadge score={content.bestSpot.score} />
              </Badge>
            </div>

            {/* Instagram */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Instagram className="w-4 h-4" />
                  Instagram
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Legenda */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Legenda</span>
                    <CopyButton text={content.instagram.caption} label="Legenda" />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {content.instagram.caption}
                  </div>
                </div>

                {/* Hashtags */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Hashtags
                    </span>
                    <CopyButton text={content.instagram.hashtags} label="Hashtags" />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                    {content.instagram.hashtags}
                  </div>
                </div>

                {/* Post completo */}
                <CopyButton text={content.instagram.fullPost} label="Post completo" />
              </CardContent>
            </Card>

            {/* TikTok */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  TikTok
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Hook */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Hook (primeiros 2s)</span>
                    <CopyButton text={content.tiktok.hook} label="Hook" />
                  </div>
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm font-medium">
                    {content.tiktok.hook}
                  </div>
                </div>

                {/* Legenda */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Legenda</span>
                    <CopyButton text={content.tiktok.caption} label="Legenda TikTok" />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed">
                    {content.tiktok.caption}
                  </div>
                </div>

                {/* Hashtags */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Hashtags
                    </span>
                    <CopyButton text={content.tiktok.hashtags} label="Hashtags TikTok" />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
                    {content.tiktok.hashtags}
                  </div>
                </div>

                {/* Post completo */}
                <CopyButton text={content.tiktok.fullPost} label="Post TikTok completo" />
              </CardContent>
            </Card>

            {/* Gerar novamente */}
            <Button variant="outline" onClick={generate} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Gerar nova versão
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Gerado às {new Date(content.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}

        {/* Estado vazio */}
        {!content && !loading && (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <Sparkles className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm">Clique em "Gerar conteúdo agora" para criar legendas baseadas nas condições reais do mar</p>
          </div>
        )}
      </div>
    </div>
  )
}
