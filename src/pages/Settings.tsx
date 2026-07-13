import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { usePremium } from '@/lib/premium'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, LogOut, User, Bell, MapPin, Crown,
  Sliders, ChevronRight, Shield, Waves, Trash2, Sun, Moon
} from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type SkillLevel = 'Iniciante' | 'Intermediário' | 'Avançado' | ''
type Region = 'all' | 'Sul' | 'Centro' | 'Leste' | 'Norte'


const SKILL_LEVELS: { value: SkillLevel; label: string; desc: string }[] = [
  { value: 'Iniciante', label: 'Iniciante', desc: 'Prefiro ondas pequenas e tranquilas' },
  { value: 'Intermediário', label: 'Intermediário', desc: 'Me viro bem em ondas de até 1m' },
  { value: 'Avançado', label: 'Avançado', desc: 'Curto ondas grandes e desafiadoras' },
]

const REGIONS: { value: Region; label: string }[] = [
  { value: 'all', label: 'Todas as regiões' },
  { value: 'Sul', label: 'Sul da Ilha' },
  { value: 'Centro', label: 'Centro (Mole, Joaquina)' },
  { value: 'Leste', label: 'Leste da Ilha' },
  { value: 'Norte', label: 'Norte da Ilha' },
]

function loadPref<T>(key: string, fallback: T): T {
  try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback }
  catch { return fallback }
}
function savePref(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* modo privado ou quota */ }
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { isPremium } = usePremium()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [skillLevel, setSkillLevel] = useState<SkillLevel>(loadPref('pref_skill', ''))
  const [defaultRegion, setDefaultRegion] = useState<Region>(loadPref('pref_region', 'all'))
  const [notifMinScore, setNotifMinScore] = useState<number>(loadPref('notif_minScore', 7))
  const [notifFavOnly, setNotifFavOnly] = useState<boolean>(loadPref('notif_favOnly', false))

  // Carrega preferências do Supabase ao montar (override do localStorage se existir)
  useEffect(() => {
    if (!user) return
    supabase
      .from('user_preferences')
      .select('pref_skill, pref_region, notif_min_score, notif_fav_only')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        if (data.pref_skill != null) { setSkillLevel(data.pref_skill as SkillLevel); savePref('pref_skill', data.pref_skill) }
        if (data.pref_region != null) { setDefaultRegion(data.pref_region as Region); savePref('pref_region', data.pref_region) }
        if (data.notif_min_score != null) { setNotifMinScore(data.notif_min_score); savePref('notif_minScore', data.notif_min_score) }
        if (data.notif_fav_only != null) { setNotifFavOnly(data.notif_fav_only); savePref('notif_favOnly', data.notif_fav_only) }
      })
  }, [user])

  const [deletingAccount, setDeletingAccount] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sessão inválida')
      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erro ao excluir conta')
      await signOut()
      navigate('/landing')
      toast.success('Conta excluída com sucesso.')
    } catch {
      toast.error('Não foi possível excluir a conta. Tente novamente.')
    } finally {
      setDeletingAccount(false)
    }
  }

  const save = (key: string, value: unknown, label: string) => {
    savePref(key, value)
    toast.success(`${label} salvo!`)
    // Sync assíncrono com Supabase — falha silenciosa (não bloqueia UX)
    if (user) {
      const colMap: Record<string, string> = {
        pref_skill: 'pref_skill',
        pref_region: 'pref_region',
        notif_minScore: 'notif_min_score',
        notif_favOnly: 'notif_fav_only',
      }
      const col = colMap[key]
      if (col) {
        supabase.from('user_preferences').upsert(
          { user_id: user.id, [col]: value, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ).then(() => {})
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <AppLogo size={40} variant="icon" />
              <div>
                <h1 className="text-2xl font-bold">Configurações</h1>
                <p className="text-xs text-muted-foreground">Surf AI</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24 space-y-5 max-w-lg">

        {/* Perfil */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium truncate max-w-[180px]">{user?.email}</span>
            </div>
            {user?.user_metadata?.full_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nome</span>
                <span className="text-sm font-medium">{user.user_metadata.full_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plano</span>
              <span className={`text-sm font-bold ${isPremium ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {isPremium ? 'Premium' : 'Gratuito'}
              </span>
            </div>
            {!isPremium && (
              <Button variant="outline" size="sm" className="w-full border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                onClick={() => navigate('/premium')}>
                <Crown className="h-4 w-4 mr-2" />
                Upgrade para Premium — R$ 16,90/mês
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Aparência */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sun className="h-4 w-4 text-primary" />
              Aparência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl border transition-colors ${
                  theme === 'light'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Sun className="h-4 w-4" />
                Claro
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl border transition-colors ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Moon className="h-4 w-4" />
                Escuro
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Meu nível de surf */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sliders className="h-4 w-4 text-primary" />
              Meu nível de surf
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Usamos isso para personalizar as recomendações de praias e o relatório de IA.
            </p>
            {SKILL_LEVELS.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => { setSkillLevel(value); save('pref_skill', value, 'Nível de surf') }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  skillLevel === value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                {skillLevel === value && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Região padrão */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Região padrão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              O app vai abrir mostrando essa região por padrão.
            </p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setDefaultRegion(value); save('pref_region', value, 'Região padrão') }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    defaultRegion === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Preferências de alerta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-semibold mb-2">Score mínimo para alertar</div>
              <div className="flex gap-2">
                {[6, 7, 8, 9].map(score => (
                  <button
                    key={score}
                    onClick={() => { setNotifMinScore(score); save('notif_minScore', score, 'Score mínimo') }}
                    className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${
                      notifMinScore === score
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {score}+
                  </button>
                ))}
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Alertar só favoritas</div>
                <div className="text-xs text-muted-foreground">Filtra pelos seus spots favoritos</div>
              </div>
              <button
                onClick={() => { const v = !notifFavOnly; setNotifFavOnly(v); save('notif_favOnly', v, 'Filtro de favoritas') }}
                className={`relative w-11 h-6 rounded-full transition-colors ${notifFavOnly ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notifFavOnly ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Minhas sessões */}
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate('/surf-log')}>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Waves className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">Minhas sessões de surf</div>
                <div className="text-xs text-muted-foreground">Registre e veja seu histórico</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        {/* Premium */}
        {!isPremium && (
          <Card className="border-yellow-500/30 bg-yellow-500/5 cursor-pointer hover:bg-yellow-500/10 transition-colors"
            onClick={() => navigate('/premium')}>
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-yellow-500">Assinar Premium</div>
                  <div className="text-xs text-muted-foreground">Previsão 14 dias, sem anúncios e mais</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-yellow-500" />
            </CardContent>
          </Card>
        )}

        {/* Conta */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Seus dados são armazenados de forma segura e nunca compartilhados com terceiros.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate('/privacy')}>
              <Shield className="h-4 w-4 mr-2" />
              Política de Privacidade
            </Button>
            <Button variant="destructive" className="w-full" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair da conta
            </Button>
            <Separator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" disabled={deletingAccount}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deletingAccount ? 'Excluindo...' : 'Excluir minha conta'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os seus dados serão removidos: favoritos, diário de surf, preferências e assinatura. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir permanentemente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Surf AI · Florianópolis, SC · v{__APP_VERSION__}
        </p>
      </main>
    </div>
  )
}
