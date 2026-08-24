import { BEACH_DIRECTORY, REGION_COUNT } from '@/lib/beachDirectory'

export const FAQS = [
  { q: 'O app funciona para todas as praias de Florianópolis?', a: `Sim! Monitoramos ${BEACH_DIRECTORY.length} praias distribuídas pelas ${REGION_COUNT} regiões da ilha: Norte, Centro e Sul. Cobrimos desde o Santinho até o Naufragados, de ponta a ponta da ilha, passando por Praia Mole, Joaquina, Campeche e muito mais.` },
  { q: 'Os dados são atualizados com que frequência?', a: 'Os dados de ondas, vento e maré são atualizados a cada 15 minutos, 24 horas por dia, 7 dias por semana. A nota de IA é recalculada automaticamente a cada nova atualização.' },
  { q: 'Como funciona o chat com o Surf AI?', a: 'É um chat de verdade: pergunta sobre qualquer uma das praias monitoradas, sobre suas condições agora, ou sobre o próprio app, e a IA responde na hora com base em dado real, sem enrolação. É exclusivo Premium, com limite de 20 mensagens por dia por usuário.' },
  { q: 'O que é o Bora Surfar?', a: 'Você compartilha sua localização só naquele instante (a gente não guarda nada) e o Surf AI compara a praia mais perto de você com a que está com a melhor condição por perto — e te diz se vale a pena rodar um pouco mais longe.' },
  { q: 'O plano gratuito tem alguma limitação?', a: 'No plano gratuito você tem acesso à nota de IA em tempo real, previsão para os próximos 3 dias, favoritos, diário de surf e navegação até a praia. Chat com IA, Bora Surfar, melhor janela do dia, previsão de 14 dias, alertas push, histórico completo e comparação de praias são exclusivos do Premium.' },
  { q: 'Como funciona a nota de IA?', a: 'Nossa IA analisa múltiplas variáveis em conjunto: altura e período das ondas, direção e intensidade do vento, fase da maré e swell predominante. O resultado é uma nota de 0 a 10 que representa a qualidade real das condições.' },
  { q: 'Posso cancelar o Premium quando quiser?', a: 'Sim, sem multa e sem burocracia. Você pode cancelar a qualquer momento pelo próprio app. O acesso Premium continua até o fim do período pago.' },
  { q: 'O app funciona no iPhone e no Android?', a: 'Sim! O Surf AI funciona direto no navegador do seu celular, sem precisar baixar nada na loja. Adicione à tela inicial e use exatamente como um app nativo.' },
]

export const STATS = [
  { value: BEACH_DIRECTORY.length, suffix: '', label: 'Praias monitoradas' },
  { value: 24, suffix: '/7', label: 'Atualização contínua' },
  { value: 14, suffix: ' dias', label: 'Previsão Premium' },
  { value: REGION_COUNT, suffix: '', label: 'Regiões da ilha' },
]
