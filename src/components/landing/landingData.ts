import { BEACH_DIRECTORY } from '@/lib/beachDirectory'
import { TRIAL_DAYS } from '@/lib/pricing'

// Perguntas da landing (v2, 28/set/2026). Cada resposta foi conferida com o app: a nota usa
// onda, período e vento (api/_scoreEngine.ts), o chat tem 20 perguntas/dia e a semana
// inteira (api/surf-chat.ts), o mensal renova sozinho e o anual é avulso (api/create-payment.ts) e o
// reembolso de 7 dias vem dos Termos de Uso. A antiga seção "Instale no celular" virou a
// última pergunta daqui. Sem travessão no texto (pedido do usuário).
// Ordem pela latitude (api/_beachRegistry.ts), do Santinho ao Naufragados
export const BEACHES_NORTH_TO_SOUTH = [
  'Santinho', 'Moçambique', 'Barra da Lagoa', 'Praia Mole', 'Joaquina', 'Novo Campeche', 'Campeche',
  'Morro das Pedras', 'Armação', 'Matadeiro', 'Lagoinha do Leste', 'Açores', 'Solidão', 'Naufragados',
]

export const FAQS = [
  {
    q: 'Quais praias vocês cobrem?',
    // Todas, de norte a sul (02/out/2026: antes citava só 10 e chamava a costa leste de "Centro",
    // que pra quem é de Floripa é o centro da cidade). landingData.test.ts confere com BEACH_DIRECTORY
    a: `As ${BEACH_DIRECTORY.length} praias de surf da ilha, de norte a sul: ${BEACHES_NORTH_TO_SOUTH.slice(0, -1).join(', ')} e ${BEACHES_NORTH_TO_SOUTH[BEACHES_NORTH_TO_SOUTH.length - 1]}.`,
  },
  {
    q: 'De onde vêm os dados?',
    a: 'De modelos internacionais de onda e vento: o francês (Météo-France) como base da altura da onda e o europeu (ECMWF) como teto, lidos pra cada praia e calibrados pro litoral de Floripa. O app busca tudo de novo a cada 15 minutos.',
  },
  {
    q: 'Como a nota é calculada?',
    a: 'A nota vai de 0 a 10 e junta a altura e o período da onda com a força e a direção do vento, levando em conta pra que lado cada praia está virada. A maré aparece na tela de cada praia, mas não entra na nota.',
  },
  {
    q: 'O que o chat com o Surf AI sabe?',
    a: 'Ele conhece o mar de agora e a previsão da semana das 14 praias: tamanho da onda, maré, vento e melhor horário de cada dia. É só perguntar do seu jeito. É do Premium, com até 20 perguntas por dia.',
  },
  {
    q: 'O que é o Bora Surfar?',
    a: 'Você compartilha sua localização só naquele instante (a gente não guarda nada). O Surf AI compara a praia mais perto de você com a que está melhor por perto e diz se vale rodar um pouco mais. É do Premium.',
  },
  {
    q: 'Dá pra testar antes de pagar?',
    a: `Dá. São ${TRIAL_DAYS} dias de Premium grátis, com tudo liberado e sem pedir cartão. Você cria a conta e toca em "Começar meus ${TRIAL_DAYS} dias grátis" na página do Premium. No fim nada é cobrado: o app avisa uns dias antes e você decide se assina.`,
  },
  {
    q: 'Como funciona o pagamento?',
    a: 'Pelo Mercado Pago. O mensal renova sozinho no cartão todo mês e você cancela quando quiser em Configurações, sem multa (o Premium vale até o fim do mês já pago). Se preferir Pix ou boleto, dá pra pagar 1 mês avulso ou o anual, que são pagamentos únicos e não renovam sozinhos: o app avisa uns dias antes de acabar. Se não curtir, pede o dinheiro de volta em até 7 dias pelo email surfaifloripa@gmail.com.',
  },
  {
    q: 'Preciso baixar na loja?',
    a: 'Não. O Surf AI abre no navegador e dá pra colocar na tela inicial como um app. No iPhone: abra no Safari, toque em compartilhar (a seta pra cima) e depois em "Adicionar à Tela de Início". No Android: abra no Chrome, toque nos três pontinhos e depois em "Adicionar à tela inicial".',
  },
]
