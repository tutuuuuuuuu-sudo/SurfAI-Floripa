import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'
import { ArrowLeft } from 'lucide-react'
import { PRICE_MONTHLY, PRICE_ANNUAL, PRICE_ANNUAL_PER_MONTH, TRIAL_DAYS, formatBRL } from '@/lib/pricing'

const SECTIONS = [
  {
    title: '1. Sobre o Surf AI',
    content: `O Surf AI é um serviço de previsão de surf para as praias de Florianópolis, operado por Arthur Garraza (pessoa física, em processo de formalização como empresa). Ao usar o app em surfaifloripa.com.br, você aceita estes Termos de Uso.`,
  },
  {
    title: '2. O que o Surf AI é (e o que não é)',
    content: `O Surf AI calcula uma nota de 0 a 10 para cada praia com base em altura da onda, período e vento, usando modelos meteorológicos de terceiros (Open-Meteo e, em caráter de reserva, Windy).

**As condições reais no mar podem ser diferentes da nota mostrada no app.** Modelos meteorológicos têm margem de erro, e o mar muda rápido. O Surf AI é uma ferramenta de apoio à decisão, não uma garantia de condição de surf nem um serviço de segurança marítima.

Surfar envolve riscos (correnteza, afogamento, colisão com outros surfistas, fauna marinha, entre outros). A decisão de entrar no mar, avaliar as condições no local e usar equipamento de segurança é sempre sua.`,
  },
  {
    title: '3. Cadastro e conta',
    content: `Para usar recursos que exigem login, você precisa fornecer um email válido e criar uma senha (ou entrar com sua conta Google). Você é responsável por manter sua senha em sigilo e por tudo que acontecer na sua conta.

Você deve ter pelo menos 13 anos para criar uma conta. Não crie mais de uma conta pessoal, nem use dados de terceiros sem autorização.`,
  },
  {
    title: '4. Plano gratuito e Premium',
    content: `O Surf AI tem um plano gratuito (nota em tempo real, previsão de 3 dias, favoritos, diário de surf e navegação até a praia) e um plano Premium pago, com o restante das funcionalidades listadas na página de assinatura.

**Preço:** ${formatBRL(PRICE_MONTHLY)}/mês (mensal) ou ${formatBRL(PRICE_ANNUAL)}/ano (anual, equivalente a ${formatBRL(PRICE_ANNUAL_PER_MONTH)}/mês). Os valores podem mudar; se isso acontecer, avisamos com antecedência dentro do app antes de cobrar o novo valor de quem já é assinante.

**Teste grátis:** cada conta pode testar o Premium uma vez, por ${TRIAL_DAYS} dias, sem informar cartão. No fim do teste nada é cobrado: o acesso volta ao plano gratuito, a não ser que você decida assinar.

**Como funciona o pagamento:** o pagamento é processado pelo Mercado Pago, de dois jeitos:

• **Mensal com renovação automática (cartão de crédito):** é uma assinatura. O valor é cobrado no cartão uma vez por mês, na mesma data, até você cancelar. Você cancela quando quiser em Configurações, sem multa: nada mais é cobrado e o Premium continua até o fim do mês já pago. Se o cartão recusar a cobrança 3 vezes seguidas, o Mercado Pago cancela a assinatura sozinho.
• **Anual ou mensal avulso (cartão, Pix ou boleto):** é um pagamento único, sem renovação. O acesso Premium vale por 365 dias (anual) ou 30 dias (mensal avulso) e, ao final, você decide se quer pagar de novo. Avisamos por e-mail uns dias antes de acabar.

**Direito de arrependimento:** por ser uma compra feita à distância (pela internet), você tem direito a cancelar a compra em até 7 dias corridos da data do pagamento e receber o valor de volta na íntegra, conforme o Art. 49 do Código de Defesa do Consumidor, mesmo que já tenha usado o Premium nesse período. Pra isso, entre em contato pelo email no fim desta página.`,
  },
  {
    title: '5. Uso permitido',
    content: `Você pode usar o Surf AI pra fins pessoais e não comerciais. Não é permitido:

• Tentar burlar o pagamento do plano Premium ou os limites do plano gratuito.
• Copiar, revender ou redistribuir os dados e notas do app.
• Usar robôs, scraping ou automação pra extrair dados do app em volume.
• Enviar conteúdo ofensivo, falso ou ilegal nos comentários da comunidade ou no chat com IA.
• Fazer engenharia reversa do app ou tentar acessar áreas administrativas sem autorização.`,
  },
  {
    title: '6. Conteúdo da comunidade',
    content: `Comentários e relatos que você publicar sobre as condições de uma praia são públicos pra outros usuários do app. Você é responsável pelo que publica. Podemos remover comentários que violem estes termos, sem aviso prévio.`,
  },
  {
    title: '7. Chat com o Surf AI',
    content: `O chat usa inteligência artificial (Google Gemini, com Groq e OpenRouter de reserva) pra responder suas perguntas com base nas condições monitoradas. As respostas são geradas automaticamente e podem conter imprecisões. Não são aconselhamento profissional de nenhum tipo. O uso do chat é limitado a um número de mensagens por dia, informado no próprio app.`,
  },
  {
    title: '8. Cancelamento e exclusão de conta',
    content: `Você pode excluir sua conta a qualquer momento nas configurações do app. Isso remove seus dados pessoais conforme descrito na nossa Política de Privacidade. Se você tiver o mensal com renovação automática, pode cancelar só a renovação em Configurações (a conta continua). Excluir a conta também cancela a renovação no Mercado Pago antes de apagar seus dados, então nenhuma cobrança futura acontece.

Podemos suspender ou encerrar contas que violem estes termos, especialmente em caso de fraude no pagamento ou abuso do serviço.`,
  },
  {
    title: '9. Propriedade intelectual',
    content: `A marca Surf AI, o código do app, o design e a forma como a nota é calculada são propriedade do Surf AI. Os dados meteorológicos brutos pertencem às suas respectivas fontes (Open-Meteo, Windy).`,
  },
  {
    title: '10. Limitação de responsabilidade',
    content: `O Surf AI é oferecido "como está". Na medida em que a lei permitir, não nos responsabilizamos por danos, acidentes ou prejuízos decorrentes do uso do app ou de decisões tomadas com base nele, incluindo a decisão de entrar no mar. Também não nos responsabilizamos por indisponibilidade temporária do serviço (manutenção, falha de fornecedores externos como Vercel, Supabase ou as fontes de dados meteorológicos).`,
  },
  {
    title: '11. Alterações nestes termos',
    content: `Podemos atualizar estes Termos de Uso periodicamente. Mudanças significativas serão avisadas por email ou dentro do app. Continuar usando o Surf AI depois de uma alteração significa que você concorda com os novos termos.`,
  },
  {
    title: '12. Lei aplicável',
    content: `Estes termos são regidos pelas leis do Brasil. Qualquer disputa será resolvida no foro da comarca de Florianópolis, SC, salvo disposição diferente da legislação do consumidor.`,
  },
  {
    title: '13. Contato',
    content: `Dúvidas sobre estes termos, cancelamento ou reembolso:\n\n**Email:** surfaifloripa@gmail.com\n\nVer também nossa **Política de Privacidade** pra saber como tratamos seus dados.`,
  },
]

export default function Terms() {
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
            <h1 className="text-base font-bold leading-none">Termos de Uso</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Surf AI · Atualizado em outubro de 2026</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="rounded-2xl p-6 mb-8 border border-primary/20 bg-primary/5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estes termos explicam o que você pode esperar do <strong className="text-foreground">Surf AI</strong>, como funciona o plano Premium e quais são
            as responsabilidades de cada lado. Leia com atenção antes de criar sua conta.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map(({ title, content }) => (
            <section key={title}>
              <h2 className="text-base font-bold mb-3 text-foreground">{title}</h2>
              <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                {content.split('\n').map((line, i) => {
                  if (!line.trim()) return null
                  const parts = line.split(/\*\*(.*?)\*\*/)
                  return (
                    <p key={i}>
                      {parts.map((part, j) =>
                        j % 2 === 1
                          ? <strong key={j} className="text-foreground">{part}</strong>
                          : part
                      )}
                    </p>
                  )
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
