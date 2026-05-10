import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'
import { ArrowLeft } from 'lucide-react'

const SECTIONS = [
  {
    title: '1. Informações que coletamos',
    content: `Coletamos as seguintes informações quando você usa o Surf AI:

• **Dados de conta**: endereço de email e senha (armazenados com criptografia) fornecidos no cadastro.
• **Preferências**: nível de surf, região preferida e configurações de notificação salvas localmente no seu dispositivo.
• **Sessões de surf**: registros que você mesmo insere voluntariamente no app.
• **Dados de uso**: páginas acessadas e interações dentro do app, de forma anônima e agregada.
• **Dados de pagamento**: processados integralmente pelo Mercado Pago. Não armazenamos dados de cartão.`,
  },
  {
    title: '2. Como usamos suas informações',
    content: `Usamos suas informações para:

• Fornecer e personalizar as funcionalidades do Surf AI.
• Enviar notificações push de alertas de ondas (somente se você autorizar).
• Processar pagamentos do plano Premium com segurança.
• Melhorar nosso serviço com base em dados de uso agregados e anônimos.
• Comunicar atualizações importantes sobre o serviço (sem spam).`,
  },
  {
    title: '3. Compartilhamento de dados',
    content: `Não vendemos, alugamos nem compartilhamos seus dados pessoais com terceiros, exceto:

• **Supabase**: nosso provedor de banco de dados e autenticação, sujeito à sua própria política de privacidade.
• **Mercado Pago**: para processamento de pagamentos do plano Premium.
• **Autoridades legais**: quando exigido por lei ou ordem judicial.

Nenhum dado identificável é compartilhado com anunciantes ou parceiros comerciais.`,
  },
  {
    title: '4. Segurança dos dados',
    content: `Adotamos medidas técnicas e organizacionais para proteger seus dados:

• Comunicações criptografadas via HTTPS/TLS em todos os acessos.
• Senhas armazenadas com hash seguro (bcrypt) via Supabase Auth.
• Tokens de acesso com expiração automática.
• Acesso aos dados restrito a endpoints autenticados e autorizados.`,
  },
  {
    title: '5. Seus direitos (LGPD)',
    content: `De acordo com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), você tem o direito de:

• **Acessar** os dados que temos sobre você.
• **Corrigir** dados incorretos ou desatualizados.
• **Excluir** sua conta e todos os dados associados.
• **Revogar** consentimentos concedidos anteriormente.
• **Solicitar portabilidade** dos seus dados em formato legível.

Para exercer qualquer um desses direitos, entre em contato pelo email abaixo.`,
  },
  {
    title: '6. Retenção de dados',
    content: `Mantemos seus dados enquanto sua conta estiver ativa. Ao excluir sua conta, seus dados pessoais são removidos permanentemente dos nossos sistemas em até 30 dias, exceto onde a retenção for exigida por lei.`,
  },
  {
    title: '7. Cookies e armazenamento local',
    content: `O Surf AI usa localStorage do navegador para salvar preferências (nível de surf, região, tema) e cache de dados. Isso não envolve cookies de rastreamento de terceiros. Você pode limpar esses dados a qualquer momento pelo seu navegador.`,
  },
  {
    title: '8. Notificações push',
    content: `As notificações push são opcionais. Você pode ativá-las ou desativá-las a qualquer momento nas configurações do app ou do seu dispositivo. Nunca enviamos notificações sem sua autorização explícita.`,
  },
  {
    title: '9. Alterações nesta política',
    content: `Podemos atualizar esta política periodicamente. Notificaremos mudanças significativas por email ou aviso dentro do app. O uso continuado do serviço após as alterações indica aceitação da nova política.`,
  },
  {
    title: '10. Contato',
    content: `Para dúvidas, solicitações ou exercício dos seus direitos, entre em contato:\n\nEmail: privacidade@surfai.com.br\n\nResponderemos em até 15 dias úteis.`,
  },
]

export default function Privacy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3 max-w-3xl">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <AppLogo size={32} variant="icon" />
          <div>
            <h1 className="text-base font-bold leading-none">Política de Privacidade</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Surf AI · Atualizado em maio de 2025</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="rounded-2xl p-6 mb-8 border border-primary/20 bg-primary/5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sua privacidade é importante para nós. Esta política descreve como o <strong className="text-foreground">Surf AI</strong> coleta, usa e protege
            suas informações em conformidade com a <strong className="text-foreground">Lei Geral de Proteção de Dados (LGPD)</strong>.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map(({ title, content }) => (
            <section key={title}>
              <h2 className="text-base font-bold mb-3 text-foreground">{title}</h2>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                {content.split('\n').map((line, i) => {
                  if (!line.trim()) return null
                  const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
                  return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/40 text-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao app
          </Button>
        </div>
      </main>
    </div>
  )
}
