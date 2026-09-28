import { BEACH_DIRECTORY, REGION_COUNT } from '@/lib/beachDirectory'

// Perguntas da landing (v2, 28/set/2026). Cada resposta foi conferida com o app: a nota usa
// onda, período e vento (api/_scoreEngine.ts), o chat tem 20 perguntas/dia e a semana
// inteira (api/surf-chat.ts), o pagamento é avulso sem renovação (api/create-payment.ts) e o
// reembolso de 7 dias vem dos Termos de Uso. A antiga seção "Instale no celular" virou a
// última pergunta daqui. Sem travessão no texto (pedido do usuário).
export const FAQS = [
  {
    q: 'Quais praias vocês cobrem?',
    a: `${BEACH_DIRECTORY.length} praias, nas ${REGION_COUNT} regiões da ilha (Norte, Centro e Sul): do Santinho e Moçambique, passando por Barra da Lagoa, Mole, Joaquina e Campeche, até Matadeiro, Lagoinha do Leste, Solidão e Naufragados.`,
  },
  {
    q: 'De onde vêm os dados?',
    a: 'De modelos meteorológicos internacionais de onda e vento (ECMWF), lidos pra cada praia e calibrados pro litoral de Floripa. O app busca tudo de novo a cada 15 minutos.',
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
    q: 'Como funciona o pagamento?',
    a: 'É um pagamento único pelo Mercado Pago: 30 dias no mensal ou 12 meses no anual. Não existe cobrança automática, então quando acabar você decide se renova. Se não curtir, pede o dinheiro de volta em até 7 dias pelo email surfaifloripa@gmail.com.',
  },
  {
    q: 'Preciso baixar na loja?',
    a: 'Não. O Surf AI abre no navegador e dá pra colocar na tela inicial como um app. No iPhone: abra no Safari, toque em compartilhar (a seta pra cima) e depois em "Adicionar à Tela de Início". No Android: abra no Chrome, toque nos três pontinhos e depois em "Adicionar à tela inicial".',
  },
]
