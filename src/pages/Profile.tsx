import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { usePremium } from '@/lib/premium'
import { getFavorites } from '@/lib/favorites'
import { useSurfData } from '@/contexts/SurfDataContext'
import { supabase, getUserDisplayName } from '@/lib/supabase'
import { getTopContribution, TopContribution } from '@/lib/ranking'
import {
  ArrowLeft, Crown, Heart, MessageCircle, Waves, Settings,
  LogOut, User, TrendingUp, MapPin, Star, Calendar, Award,
  Camera, Edit2, Check, X, Wind, Clock, Flame, Trophy
} from 'lucide-react'
import { toast } from 'sonner'
import { getRatingInfo } from '@/lib/rating'

const MAX_AVATAR_DIMENSION = 1280
const AVATAR_JPEG_QUALITY = 0.82

/** Redimensiona (lado maior <= 1280px) e reexporta como JPEG antes do upload. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('unreadable_image')
  })
  const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('unreadable_image')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', AVATAR_JPEG_QUALITY)
  )
  if (!blob) throw new Error('unreadable_image')
  return blob
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isPremium, subscription } = usePremium()
  const { conditions } = useSurfData()
  const [favorites, setFavorites] = useState<string[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [favoriteSpots, setFavoriteSpots] = useState<import('@/lib/surfData').BeachCondition[]>([])
  const [editingBio, setEditingBio] = useState(false)
  const [bio, setBio] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [sessionDates, setSessionDates] = useState<string[]>([])
  const [streak, setStreak] = useState(0)
  const [topContribution, setTopContribution] = useState<TopContribution | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPhotoOptions, setShowPhotoOptions] = useState(false)

  const userName = user ? getUserDisplayName(user) : 'Surfista'
  const userInitial = userName.charAt(0).toUpperCase()
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'

  // Filtra spots favoritos a partir dos dados já no contexto — sem fetch extra
  useEffect(() => {
    if (conditions.length > 0 && favorites.length > 0) {
      setFavoriteSpots(conditions.filter(s => favorites.includes(s.id)))
    }
  }, [conditions, favorites])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      // Não faz fetchCurrentConditions — usa o contexto global
      const favs = await getFavorites().catch(() => [] as string[])
      setFavorites(favs)
      setFavoriteSpots(conditions.filter(s => favs.includes(s.id)))
      if (user) {
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        setCommentCount(count ?? 0)
        const { data: profile } = await supabase
          .from('profiles')
          .select('bio, avatar_url')
          .eq('id', user.id)
          .single()
        if (profile) {
          setBio(profile.bio ?? '')
          setBioInput(profile.bio ?? '')
          setAvatarUrl(profile.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null)
        } else {
          setAvatarUrl((user.user_metadata?.avatar_url as string | undefined) ?? null)
        }
      }
      // Busca datas de sessões do surf log para o heatmap (últimas 52 semanas)
      if (user) {
        const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const { data: sessions } = await supabase
          .from('surf_sessions')
          .select('date')
          .eq('user_id', user.id)
          .gte('date', since)
          .order('date', { ascending: false })
        if (sessions && sessions.length > 0) {
          const dates = sessions.map((s: { date: string }) => s.date as string)
          setSessionDates(dates)

          // Calcula streak: dias consecutivos com sessão até hoje
          const todayStr = new Date().toISOString().split('T')[0]
          const dateSet = new Set(dates)
          let s = 0
          const cur = new Date()
          while (true) {
            const d = cur.toISOString().split('T')[0]
            if (dateSet.has(d)) { s++; cur.setDate(cur.getDate() - 1) }
            else if (d === todayStr) { cur.setDate(cur.getDate() - 1) } // hoje sem sessão ainda
            else break
          }
          setStreak(s)
        }
      }

      if (user) {
        getTopContribution().then(setTopContribution).catch(() => {})
      }

      setLoading(false)
    }
    load()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Até logo! 🤙')
    navigate('/')
  }

  const handleSaveBio = async () => {
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, bio: bioInput, updated_at: new Date().toISOString() })
    if (error) { toast.error('Erro ao salvar bio.'); return }
    setBio(bioInput)
    setEditingBio(false)
    toast.success('Bio atualizada! 🤙')
  }

  const handlePhotoUpload = async (file: File) => {
    if (!user || !file) return
    if (file.size > 30 * 1024 * 1024) { toast.error('Arquivo muito grande. Escolha uma foto menor.'); return }
    setUploadingPhoto(true)
    setShowPhotoOptions(false)
    try {
      const compressed = await compressImage(file)
      const path = `avatars/${user.id}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = data.publicUrl + `?t=${Date.now()}`
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() })
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
      setAvatarUrl(publicUrl)
      toast.success('Foto de perfil atualizada! 📸')
    } catch (err) {
      if (err instanceof Error && err.message === 'unreadable_image') {
        toast.error('Não conseguimos ler essa imagem. Tente outra foto (JPG ou PNG).')
      } else {
        toast.error('Erro ao fazer upload da foto.')
      }
    }
    setUploadingPhoto(false)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <User className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">Faça login para ver seu perfil</p>
            <Button onClick={() => navigate('/login')} className="w-full">Entrar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <input ref={fileInputRef} id="photo-file-input" type="file"
        accept="image/*,image/heic,image/heif" className="hidden"
        onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />

      {/* ✅ Header sem ThemeToggle */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <h1 className="text-lg font-bold">Perfil</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-5">

        <Card className="anim-slide overflow-hidden" style={{ animationDelay: '0s' }}>
          <div className="h-16 bg-primary/10" />
          <CardContent className="pb-5 -mt-8">
            <div className="flex items-end justify-between">
              <div className="relative">
                <label htmlFor="photo-file-input" className="cursor-pointer block">
                  <div className="w-20 h-20 rounded-full bg-primary/20 border-4 border-background flex items-center justify-center overflow-hidden shadow-lg">
                    {uploadingPhoto ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted/50">
                        <Waves className="h-6 w-6 text-primary animate-bounce" />
                      </div>
                    ) : avatarUrl ? (
                      <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-primary">{userInitial}</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </label>
                <label htmlFor="photo-file-input"
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-background cursor-pointer">
                  <Camera className="h-3 w-3 text-white" />
                </label>
                {isPremium && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center border-2 border-background">
                    <Crown className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
                <LogOut className="h-4 w-4 mr-1.5" />Sair
              </Button>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{userName}</h2>
                {isPremium && (
                  <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                    <Crown className="h-3 w-3 mr-1" />Premium
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />Membro desde {memberSince}
              </p>
            </div>

            <div className="mt-4">
              {editingBio ? (
                <div className="space-y-2">
                  <textarea value={bioInput} onChange={e => setBioInput(e.target.value)}
                    placeholder="Conta um pouco sobre você... praia favorita, nível de surf, onde mora..."
                    className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-muted/20 outline-none focus:border-primary transition-colors resize-none"
                    rows={3} maxLength={200} autoFocus />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{bioInput.length}/200</span>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingBio(false); setBioInput(bio) }}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/30 transition-colors">
                        <X className="h-3 w-3" />Cancelar
                      </button>
                      <button onClick={handleSaveBio}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        <Check className="h-3 w-3" />Salvar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 cursor-pointer group"
                  onClick={() => { setEditingBio(true); setBioInput(bio) }}>
                  {bio
                    ? <p className="text-sm text-muted-foreground flex-1">{bio}</p>
                    : <p className="text-sm text-muted-foreground/50 italic flex-1">Adicionar bio...</p>
                  }
                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                </div>
              )}
            </div>

            {isPremium && subscription?.expires_at && (
              <div className="mt-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-xs text-yellow-600 dark:text-yellow-400">
                ✨ Premium ativo até {new Date(subscription.expires_at).toLocaleDateString('pt-BR')}
              </div>
            )}

            {/* ✅ Texto corrigido: 14 dias, sem câmeras */}
            {!isPremium && (
              <button onClick={() => navigate('/premium')}
                className="mt-3 w-full p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 hover:bg-yellow-500/10 transition-colors text-left">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <div>
                    <div className="text-xs font-semibold text-yellow-500">Upgrade para Premium</div>
                    <div className="text-xs text-muted-foreground">Previsão 14 dias, sem anúncios</div>
                  </div>
                </div>
              </button>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3 anim-slide" style={{ animationDelay: '0.1s' }}>
          {[
            { icon: Heart, label: 'Favoritas', value: favorites.length, cls: 'text-destructive', action: () => navigate('/favorites') },
            { icon: MessageCircle, label: 'Relatos', value: commentCount, cls: 'text-primary', action: undefined },
            { icon: Award, label: 'Nível', value: isPremium ? 'Pro' : 'Free', cls: isPremium ? 'text-rating-excellent' : 'text-muted-foreground', action: undefined },
          ].map(stat => (
            <Card key={stat.label} className={`text-center ${stat.action ? 'cursor-pointer hover:border-primary/30 transition-colors' : ''}`} onClick={stat.action}>
              <CardContent className="pt-4 pb-4 space-y-1">
                <stat.icon className={`h-5 w-5 mx-auto ${stat.cls}`} />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Card de streak + heatmap */}
        {sessionDates.length > 0 && (() => {
          // Gera heatmap das últimas 16 semanas (112 dias)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const dateSet = new Set(sessionDates)
          const weeks: string[][] = []
          // Começa na segunda-feira da semana atual e vai 16 semanas para trás
          const startDay = new Date(today)
          startDay.setDate(startDay.getDate() - (startDay.getDay() === 0 ? 6 : startDay.getDay() - 1))
          startDay.setDate(startDay.getDate() - 15 * 7)

          for (let w = 0; w < 16; w++) {
            const week: string[] = []
            for (let d = 0; d < 7; d++) {
              const day = new Date(startDay)
              day.setDate(startDay.getDate() + w * 7 + d)
              week.push(day.toISOString().split('T')[0])
            }
            weeks.push(week)
          }

          return (
            <Card className="anim-slide" style={{ animationDelay: '0.15s' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-400" />Suas Sessões
                  </div>
                  {streak > 0 && (
                    <div className="flex items-center gap-1.5 bg-orange-500/10 px-3 py-1 rounded-full">
                      <Flame className="h-3.5 w-3.5 text-orange-400" />
                      <span className="text-xs font-bold text-orange-400">{streak} dias seguidos</span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="overflow-x-auto">
                  <div className="flex gap-0.5 min-w-max">
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-0.5">
                        {week.map(dateStr => {
                          const hasSession = dateSet.has(dateStr)
                          const isToday = dateStr === today.toISOString().split('T')[0]
                          const isFuture = dateStr > today.toISOString().split('T')[0]
                          return (
                            <div
                              key={dateStr}
                              title={dateStr}
                              className={`w-3 h-3 rounded-sm transition-colors ${
                                isFuture
                                  ? 'bg-transparent'
                                  : hasSession
                                    ? 'bg-primary'
                                    : isToday
                                      ? 'bg-muted border border-border'
                                      : 'bg-muted/40'
                              }`}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">{sessionDates.length} sessões no último ano</p>
                  <button onClick={() => navigate('/surf-log')} className="text-xs text-primary hover:underline">
                    Ver diário →
                  </button>
                </div>
              </CardContent>
            </Card>
          )
        })()}

        {topContribution && (
          <Card className="anim-slide cursor-pointer hover:border-primary/30 transition-colors" style={{ animationDelay: '0.18s' }}
            onClick={() => navigate(`/spot/${topContribution.beachId}`)}>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  #{topContribution.position} no ranking de {topContribution.beachName}
                </p>
                <p className="text-xs text-muted-foreground">{topContribution.count} confirmações este mês</p>
              </div>
            </CardContent>
          </Card>
        )}

        {favoriteSpots.length > 0 && (
          <Card className="anim-slide" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500 fill-red-500" />Suas Praias Favoritas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {favoriteSpots.map((spot, idx) => {
                const rating = getRatingInfo(spot.score)
                return (
                  <button key={spot.id} onClick={() => navigate(`/spot/${spot.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
                    style={{ animation: `slideUp 0.3s ${idx * 0.06}s ease-out both` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ backgroundColor: rating.scoreColor }}>
                      {spot.score.toFixed(1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{spot.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{spot.region} da Ilha
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold" style={{ color: rating.scoreColor }}>{rating.label}</div>
                      <div className="text-xs text-muted-foreground">{spot.waveHeight.toFixed(1)}m</div>
                    </div>
                  </button>
                )
              })}
              <button onClick={() => navigate('/favorites')} className="w-full text-xs text-primary hover:underline text-center py-1">
                Ver todas as favoritas →
              </button>
            </CardContent>
          </Card>
        )}

        {!loading && (() => {
          const best = [...conditions].sort((a, b) => b.score - a.score)[0] ?? null
          if (!best) return null
          const rating = getRatingInfo(best.score)
          return (
            <Card className="anim-slide" style={{ animationDelay: '0.3s' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />Melhor Pico Agora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <button onClick={() => navigate(`/spot/${best.id}`)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-muted/20 transition-colors text-left">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white text-lg flex-shrink-0" style={{ backgroundColor: rating.scoreColor }}>
                    {best.score.toFixed(1)}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-base">{best.name}</div>
                    <div className="text-xs text-muted-foreground">{best.region} da Ilha</div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Waves className="h-3 w-3 text-primary" />{best.waveHeight.toFixed(1)}m</span>
                      <span className="flex items-center gap-1"><Wind className="h-3 w-3 text-accent" />{Math.round(best.windSpeed)}km/h</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.round(best.swellPeriod)}s</span>
                    </div>
                  </div>
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                </button>
              </CardContent>
            </Card>
          )
        })()}

        <Card className="anim-slide" style={{ animationDelay: '0.4s' }}>
          <CardContent className="py-3 space-y-1">
            {[
              { icon: Heart, label: 'Praias Favoritas', path: '/favorites', cls: 'text-destructive' },
              { icon: Waves, label: 'Todas as Praias', path: '/', cls: 'text-primary' },
              { icon: MapPin, label: 'Me Leva ao Pico', path: '/navigation', cls: 'text-rating-good' },
              { icon: Settings, label: 'Configurações', path: '/settings', cls: 'text-muted-foreground' },
            ].map(item => (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/20 transition-colors text-left">
                <item.icon className={`h-5 w-5 flex-shrink-0 ${item.cls}`} />
                <span className="text-sm font-medium">{item.label}</span>
                <span className="ml-auto text-muted-foreground text-sm">→</span>
              </button>
            ))}
            <Separator className="my-1" />
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/5 transition-colors text-left text-destructive">
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">Sair da conta</span>
            </button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
