import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { usePremium } from '@/lib/premium'
import { getFavorites } from '@/lib/favorites'
import { getCurrentConditions, fetchCurrentConditions } from '@/lib/surfData'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Crown, Heart, MessageCircle, Waves, Settings,
  LogOut, User, TrendingUp, MapPin, Star, Calendar, Award,
  Camera, Edit2, Check, X, Image, Wind, Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { getRatingInfo } from '@/lib/rating'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isPremium, subscription } = usePremium()
  const [favorites, setFavorites] = useState<string[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [favoriteSpots, setFavoriteSpots] = useState<any[]>([])
  const [editingBio, setEditingBio] = useState(false)
  const [bio, setBio] = useState('')
  const [bioInput, setBioInput] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const userName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'Surfista'
  const userInitial = userName.charAt(0).toUpperCase()
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [favs, spots] = await Promise.all([getFavorites(), fetchCurrentConditions()])
      setFavorites(favs)
      setFavoriteSpots(spots.filter(s => favs.includes(s.id)))
      if (user) {
        const { count } = await supabase
          .from('beach_comments')
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
          setAvatarUrl(profile.avatar_url ?? user.user_metadata?.avatar_url ?? null)
        } else {
          setAvatarUrl(user.user_metadata?.avatar_url ?? null)
        }
      }
      setLoading(false)
    }
    load()
  }, [user])

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
    if (file.size > 5 * 1024 * 1024) { toast.error('Foto muito grande. Máximo 5MB.'); return }
    setUploadingPhoto(true)
    setShowPhotoOptions(false)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = data.publicUrl + `?t=${Date.now()}`
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() })
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
      setAvatarUrl(publicUrl)
      toast.success('Foto de perfil atualizada! 📸')
    } catch {
      toast.error('Erro ao fazer upload da foto.')
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
          <div className="h-16 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/10" />
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
            { icon: Heart, label: 'Favoritas', value: favorites.length, color: '#ef4444', action: () => navigate('/favorites') },
            { icon: MessageCircle, label: 'Relatos', value: commentCount, color: '#06b6d4', action: undefined },
            { icon: Award, label: 'Nível', value: isPremium ? 'Pro' : 'Free', color: isPremium ? '#f59e0b' : '#6b7280', action: undefined },
          ].map(stat => (
            <Card key={stat.label} className={`text-center ${stat.action ? 'cursor-pointer hover:border-primary/30 transition-colors' : ''}`} onClick={stat.action}>
              <CardContent className="pt-4 pb-4 space-y-1">
                <stat.icon className="h-5 w-5 mx-auto" style={{ color: stat.color }} />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

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
          const best = getCurrentConditions().sort((a, b) => b.score - a.score)[0] ?? null
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
              { icon: Heart, label: 'Praias Favoritas', path: '/favorites', color: '#ef4444' },
              { icon: Waves, label: 'Todas as Praias', path: '/', color: '#06b6d4' },
              { icon: MapPin, label: 'Me Leva ao Pico', path: '/navigation', color: '#22c55e' },
              { icon: Settings, label: 'Configurações', path: '/settings', color: '#6b7280' },
            ].map(item => (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/20 transition-colors text-left">
                <item.icon className="h-5 w-5 flex-shrink-0" style={{ color: item.color }} />
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
