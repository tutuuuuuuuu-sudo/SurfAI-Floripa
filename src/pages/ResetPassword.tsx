import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { AppLogo } from '@/components/AppLogo'
import { Button } from '@/components/ui/button'
import { Waves, CheckCircle2, XCircle } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState<boolean | null>(null)

  useEffect(() => {
    // O Supabase processa o token da URL automaticamente via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
      }
    })

    // Timeout: se não chegou evento de recovery em 3s, link inválido ou expirado
    const timeout = setTimeout(() => {
      setValidSession(prev => prev === null ? false : prev)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async () => {
    setError('')

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('Não foi possível redefinir a senha. Tente solicitar um novo link.')
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/'), 3000)
  }

  // Carregando — aguardando Supabase processar o token
  if (validSession === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Waves className="h-10 w-10 text-primary animate-bounce" />
          <p className="text-sm text-muted-foreground">Verificando link...</p>
        </div>
      </div>
    )
  }

  // Link inválido ou expirado
  if (validSession === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <XCircle className="h-14 w-14 text-destructive mx-auto" />
          <div>
            <h1 className="text-xl font-bold mb-2">Link inválido ou expirado</h1>
            <p className="text-sm text-muted-foreground">
              Este link de redefinição de senha não é mais válido. Solicite um novo.
            </p>
          </div>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Voltar ao login
          </Button>
        </div>
      </div>
    )
  }

  // Senha redefinida com sucesso
  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          <div>
            <h1 className="text-xl font-bold mb-2">Senha redefinida!</h1>
            <p className="text-sm text-muted-foreground">
              Sua senha foi atualizada com sucesso. Redirecionando...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Formulário de nova senha
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <AppLogo size={48} variant="icon" />
          </div>
          <h1 className="text-2xl font-bold">Nova senha</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Digite sua nova senha abaixo
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Nova senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full px-3.5 py-2.5 border border-input rounded-xl text-sm bg-background text-foreground outline-none focus:border-primary transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3.5 py-2.5 border border-input rounded-xl text-sm bg-background text-foreground outline-none focus:border-primary transition"
            />
          </div>
        </div>

        {error && (
          <div className="px-3.5 py-2.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive">
            {error}
          </div>
        )}

        <Button className="w-full h-11" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Salvando...' : 'Redefinir senha'}
        </Button>

        <button
          onClick={() => navigate('/login')}
          className="w-full text-xs text-muted-foreground text-center hover:text-foreground transition-colors"
        >
          Cancelar e voltar ao login
        </button>
      </div>
    </div>
  )
}
