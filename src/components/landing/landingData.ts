import { BEACH_DIRECTORY, REGION_COUNT } from '@/lib/beachDirectory'

export const PLAN_FEATURES = [
  { label: 'Score de IA em tempo real', free: true, premium: true },
  { label: `${BEACH_DIRECTORY.length} praias monitoradas`, free: true, premium: true },
  { label: 'Praias favoritas', free: true, premium: true },
  { label: 'Comparação de praias', free: false, premium: true },
  { label: 'Log de sessões', free: true, premium: true },
  { label: 'Previsão de ondas', free: '3 dias', premium: '14 dias' },
  { label: 'Histórico de condições', free: false, premium: true },
  { label: 'Alertas de ondas push', free: false, premium: true },
  { label: 'Navegação até a praia', free: true, premium: true },
  { label: 'Experiência sem anúncios', free: false, premium: true },
  { label: 'Acesso antecipado a recursos', free: false, premium: true },
]

export const FAQS = [
  { q: 'O app funciona para todas as praias de Florianópolis?', a: `Sim! Monitoramos ${BEACH_DIRECTORY.length} praias distribuídas pelas ${REGION_COUNT} regiões da ilha: Norte, Leste, Centro e Sul. Cobrimos desde o Santinho até o Naufragados, de ponta a ponta da ilha, passando por Praia Mole, Joaquina, Campeche e muito mais.` },
  { q: 'Os dados são atualizados com que frequência?', a: 'Os dados de ondas, vento e maré são atualizados a cada 15 minutos, 24 horas por dia, 7 dias por semana. O score de IA é recalculado automaticamente a cada nova atualização.' },
  { q: 'O plano gratuito tem alguma limitação?', a: 'No plano gratuito você tem acesso ao score de IA em tempo real, previsão para os próximos 3 dias, favoritos, log de sessões e navegação até a praia. Para previsão de 14 dias, alertas push, histórico completo e comparação de praias, é necessário o Premium.' },
  { q: 'Como funciona o score de IA?', a: 'Nossa IA analisa múltiplas variáveis em conjunto: altura e período das ondas, direção e intensidade do vento, fase da maré e swell predominante. O resultado é uma nota de 0 a 10 que representa a qualidade real das condições.' },
  { q: 'Posso cancelar o Premium quando quiser?', a: 'Sim, sem multa e sem burocracia. Você pode cancelar a qualquer momento pelo próprio app. O acesso Premium continua até o fim do período pago.' },
  { q: 'O app funciona no iPhone e no Android?', a: 'Sim! O Surf AI funciona direto no navegador do seu celular, sem precisar baixar nada na loja. Adicione à tela inicial e use exatamente como um app nativo.' },
]

export const STATS = [
  { value: BEACH_DIRECTORY.length, suffix: '', label: 'Praias monitoradas' },
  { value: 24, suffix: '/7', label: 'Atualização contínua' },
  { value: 14, suffix: ' dias', label: 'Previsão Premium' },
  { value: REGION_COUNT, suffix: '', label: 'Regiões da ilha' },
]
