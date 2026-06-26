import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { AppLogo } from '@/components/AppLogo'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectToPremium = searchParams.get('plan') === 'premium'

  const handleForgotPassword = async () => {
    if (!email.trim()) { setError('Digite seu email primeiro.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      setError('Não foi possível enviar o email. Verifique o endereço.')
    } else {
      setMessage('Email enviado! Verifique sua caixa de entrada para redefinir a senha.')
    }
  }

  const handleSubmit = async () => {
    setError('')
    setMessage('')
    setLoading(true)

    if (tab === 'login') {
      const { error } = await signInWithEmail(email, password)
      if (error) {
        setError('Email ou senha incorretos.')
      } else {
        navigate(redirectToPremium ? '/premium' : '/')
      }
    } else {
      if (!name.trim()) { setError('Informe seu nome.'); setLoading(false); return }
      if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); setLoading(false); return }
      if (!acceptedTerms) { setError('Você precisa aceitar a Política de Privacidade para criar uma conta.'); setLoading(false); return }
      const { error } = await signUpWithEmail(name, email, password)
      if (error) {
        setError(error)
      } else {
        setMessage('Conta criada! Verifique seu email para confirmar o cadastro.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* Painel esquerdo — visível apenas em telas médias+ */}
      <div className="hidden md:flex flex-col justify-between flex-1 p-12 relative overflow-hidden bg-card border-r border-border">
        <AppLogo size={44} variant="full" />
        <div>
          <h2 className="text-foreground text-3xl font-bold leading-snug mb-3">
            Onde está melhor<br />para surfar agora?
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            IA analisa vento, swell, maré e batimetria<br />
            para indicar o melhor pico em tempo real.
          </p>
        </div>
        <div className="flex gap-8">
          {[['15', 'praias'], ['4', 'regiões'], ['24/7', 'ao vivo']].map(([val, label]) => (
            <div key={label}>
              <p className="text-primary text-2xl font-bold">{val}</p>
              <p className="text-muted-foreground text-xs">{label}</p>
            </div>
          ))}
        </div>
        {/* Onda decorativa */}
        <svg className="absolute bottom-0 left-0 right-0 opacity-10" viewBox="0 0 400 100" preserveAspectRatio="none">
          <path d="M0,50 Q50,10 100,40 Q150,70 200,30 Q250,0 300,40 Q350,70 400,20 L400,100 L0,100 Z" fill="currentColor" className="text-primary" />
        </svg>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">

          {/* Tab selector */}
          <div className="flex border border-border rounded-xl overflow-hidden mb-6">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setMessage('') }}
                className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {t === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">
            {tab === 'login' ? 'Bem-vindo de volta' : 'Criar sua conta'}
          </h1>
          <p className="text-primary text-sm mb-6">
            {tab === 'login' ? 'Veja as condições das suas praias favoritas' : 'Grátis para começar — premium quando quiser'}
          </p>

          {/* Google OAuth */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition mb-4"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            {tab === 'login' ? 'Continuar com Google' : 'Cadastrar com Google'}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <hr className="flex-1 border-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <hr className="flex-1 border-border" />
          </div>

          {/* Nome (só no signup) */}
          {tab === 'signup' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-3.5 py-2.5 border border-input rounded-xl text-sm bg-background text-foreground outline-none focus:border-primary transition"
              />
            </div>
          )}

          {/* Email */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-3.5 py-2.5 border border-input rounded-xl text-sm bg-background text-foreground outline-none focus:border-primary transition"
            />
          </div>

          {/* Senha */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              {tab === 'login' && (
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  Esqueci a senha
                </button>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder={tab === 'signup' ? 'Mínimo 8 caracteres' : '••••••••'}
              className="w-full px-3.5 py-2.5 border border-input rounded-xl text-sm bg-background text-foreground outline-none focus:border-primary transition"
            />
          </div>

          {/* Feedback */}
          {error && (
            <div className="mb-3 px-3.5 py-2.5 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-3 px-3.5 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary">
              {message}
            </div>
          )}

          {/* Aceite dos termos — só no signup */}
          {tab === 'signup' && (
            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Li e aceito a{' '}
                <Link to="/privacy" target="_blank" className="text-primary underline underline-offset-2">
                  Política de Privacidade
                </Link>
                {' '}e concordo com o tratamento dos meus dados conforme a LGPD.
              </span>
            </label>
          )}

          {/* Submit */}
          <Button
            className="w-full h-11"
            onClick={handleSubmit}
            disabled={loading || (tab === 'signup' && !acceptedTerms)}
          >
            {loading ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar conta grátis'}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            {tab === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
            <button
              onClick={() => { setTab(tab === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
              className="text-primary font-medium hover:underline"
            >
              {tab === 'login' ? 'Criar agora' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
