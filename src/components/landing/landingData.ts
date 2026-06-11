export const TESTIMONIALS = [
  { name: 'Lucas T.', role: 'Intermediário · Coqueiros', avatar: 'LT', handle: '@lucast.surf', stars: 5, text: 'Fui na Mole ontem cedo, o score tava 8.4. Mar perfeito, quase vazio. Antes eu ia no achismo e voltava bastante frustrado. Agora pelo menos sei antes de sair de casa.' },
  { name: 'Ana F.', role: 'Iniciante · Norte da ilha', avatar: 'AF', handle: '@anaf.floripa', stars: 4, text: 'Pra mim que sou iniciante foi ótimo porque sempre fui na praia errada. Agora olho quais tão mais calmas e vou pra lá. Simples assim. Não perco mais tempo.' },
  { name: 'Bruno M.', role: 'Surfista · Campeche', avatar: 'BM', handle: '@brunomsurf', stars: 5, text: 'Usei pra planejar a semana de folga. Dos 6 dias que fui, 5 o mar tava bom mesmo. Não é 100% mas bem melhor do que depender de grupo de WhatsApp.' },
  { name: 'Rafael S.', role: 'Avançado · Joaquina', avatar: 'RS', handle: '@rafaelsurf_fpolis', stars: 5, text: 'O alerta de ondas mudou meu jogo. Acordo com a notificação, chego no pico quando ainda tá vazio. Melhor investimento do mês.' },
]

export const PLAN_FEATURES = [
  { label: 'Score de IA em tempo real', free: true, premium: true },
  { label: '17 praias monitoradas', free: true, premium: true },
  { label: 'Favoritos e comparação', free: true, premium: true },
  { label: 'Log de sessões', free: true, premium: true },
  { label: 'Previsão de ondas', free: '3 dias', premium: '14 dias' },
  { label: 'Histórico de condições', free: false, premium: true },
  { label: 'Alertas de ondas push', free: false, premium: true },
  { label: 'Navegação até a praia', free: false, premium: true },
  { label: 'Experiência sem anúncios', free: false, premium: true },
  { label: 'Acesso antecipado a recursos', free: false, premium: true },
]

export const FAQS = [
  { q: 'O app funciona para todas as praias de Florianópolis?', a: 'Sim! Monitoramos 17 praias distribuídas pelas 4 regiões da ilha: Norte, Leste, Centro e Sul. Cobrimos desde o Santinho até o Naufragados, passando por Praia Mole, Joaquina, Campeche e muito mais.' },
  { q: 'Os dados são atualizados com que frequência?', a: 'Os dados de ondas, vento e maré são atualizados a cada hora, 24 horas por dia, 7 dias por semana. O score de IA é recalculado automaticamente a cada nova atualização.' },
  { q: 'O plano gratuito tem alguma limitação?', a: 'No plano gratuito você tem acesso ao score de IA em tempo real, previsão para os próximos 3 dias, favoritos, log de sessões e comparação de praias. Para previsão de 14 dias, alertas push, histórico completo e navegação, é necessário o Premium.' },
  { q: 'Como funciona o score de IA?', a: 'Nossa IA analisa múltiplas variáveis em conjunto: altura e período das ondas, direção e intensidade do vento, fase da maré e swell predominante. O resultado é uma nota de 0 a 10 que representa a qualidade real das condições.' },
  { q: 'Posso cancelar o Premium quando quiser?', a: 'Sim, sem multa e sem burocracia. Você pode cancelar a qualquer momento pelo próprio app. O acesso Premium continua até o fim do período pago.' },
  { q: 'O app funciona no iPhone e no Android?', a: 'Sim! O Surf AI é um Progressive Web App (PWA) — funciona diretamente no navegador do seu celular, sem precisar baixar nada na loja. Adicione à tela inicial e use como um app nativo.' },
]

export const STATS = [
  { value: 17, suffix: '', label: 'Praias monitoradas' },
  { value: 24, suffix: '/7', label: 'Atualização contínua' },
  { value: 14, suffix: ' dias', label: 'Previsão Premium' },
  { value: 4, suffix: '', label: 'Regiões da ilha' },
]

export const MOCK_SPOTS = [
  { beach: 'Praia Mole', score: 9.1, wave: '1.2m', wind: '12km/h', period: '13s', color: '#8b5cf6', label: 'ÉPICO' },
  { beach: 'Joaquina', score: 7.8, wave: '1.0m', wind: '15km/h', period: '11s', color: '#06b6d4', label: 'EXCELENTE' },
  { beach: 'Campeche', score: 6.5, wave: '0.8m', wind: '18km/h', period: '10s', color: '#22c55e', label: 'BOM' },
  { beach: 'Santinho', score: 4.2, wave: '0.6m', wind: '25km/h', period: '7s', color: '#f59e0b', label: 'REGULAR' },
]

export const PAIN_POINTS = [
  { emoji: '😤', problem: 'Chegou na praia e o mar estava péssimo', solution: 'Score em tempo real antes de sair de casa' },
  { emoji: '⏰', problem: 'Perdeu o horário de pico porque não sabia', solution: 'Alertas quando seu spot atingir o score ideal' },
  { emoji: '📍', problem: 'Sempre vai na mesma praia sem saber se tem melhor opção', solution: 'Compare 17 praias lado a lado em segundos' },
]

export const PREMIUM_SCROLL_THRESHOLD = 2200
