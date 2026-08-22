# Surf IA - Aplicativo Inteligente de Surf

## Sobre o App

**Surf IA** é um aplicativo inteligente que usa Inteligência Artificial para indicar qual região de Florianópolis está com as melhores ondas em tempo real.

### Problema que resolve
Responde à pergunta clássica de todo surfista:
> "Onde está melhor para surfar agora, considerando vento, swell, maré e crowd?"

## Funcionalidades

### 🎯 Principais Recursos

1. **Análise em Tempo Real**
   - Score de qualidade (0-10) para cada praia
   - Atualização automática a cada minuto
   - Indicação do melhor pico no momento

2. **Dados Analisados**
   - Direção e velocidade do vento (terral, lateral, frontal)
   - Tamanho, direção e período do swell
   - Estado e altura da maré
   - Batimetria e orientação das praias

3. **Inteligência Artificial**
   - Classificação por nível: 🟢 Iniciante | 🟡 Intermediário | 🔴 Avançado
   - Previsão de melhor janela para surfar
   - Sugestão de prancha ideal (shortboard, fish, longboard, funboard)
   - Alerta de lotação (vazio, pouca gente, cheio)

4. **Regiões de Florianópolis**
   - Sul da Ilha (Campeche, Armação)
   - Leste (Joaquina, Mole, Moçambique, Barra da Lagoa)
   - Norte (Santinho, Cachoeira do Bom Jesus)
   - Centro

## Como Usar

1. **Tela Principal**
   - Veja o melhor pico destacado no topo
   - Navegue por todas as praias em cards organizados
   - Filtre por região (Sul, Leste, Norte, Centro)

2. **Detalhes de Cada Praia**
   - Clique em qualquer card para ver detalhes completos
   - Análise inteligente das condições
   - Dados técnicos de vento, ondas e maré
   - Recomendação de prancha

3. **Indicadores Visuais**
   - **Score 8.0+**: 🔥 Condições EXCELENTES
   - **Score 6.5-7.9**: ✅ Boas condições
   - **Score 5.0-6.4**: ⚠️ Condições medianas
   - **Score abaixo de 5.0**: ❌ Condições ruins

## Tecnologias

- **React 19** + TypeScript
- **Tailwind CSS 4** (tema oceano personalizado)
- **Vite 7** (desenvolvimento rápido)
- **shadcn/ui** (componentes modernos)
- **Lucide Icons** (ícones profissionais)
- **React Router** (navegação entre telas)

## Dados Simulados

Atualmente o app usa dados simulados que variam conforme o horário do dia:
- **Manhã (6h-10h)**: Condições melhores, mais gente
- **Tarde (14h-18h)**: Condições moderadas
- **Outros horários**: Condições variadas

### Próximos Passos (Integração Real)

Para transformar em app real, seria necessário integrar com APIs como:
- **Windy API** - Dados de vento
- **Surfline/Stormglass API** - Dados de swell e ondas
- **Open-Meteo** - Previsões meteorológicas
- **Tábua de Marés** - Dados oficiais de maré

## Estrutura do Projeto

```
src/
├── pages/
│   ├── Home.tsx              # Tela principal com lista de praias
│   └── SpotDetails.tsx       # Detalhes de cada praia
├── components/
│   └── surf/
│       ├── SpotCard.tsx      # Card de cada praia
│       └── RegionFilter.tsx  # Filtro por região
├── lib/
│   └── surfData.ts           # Dados e lógica de análise
└── index.css                 # Tema oceano personalizado
```

## Praias Disponíveis

### Sul da Ilha
- Campeche
- Armação

### Leste
- Joaquina
- Praia Mole
- Moçambique
- Barra da Lagoa

### Norte
- Santinho
- Cachoeira do Bom Jesus

---

**Desenvolvido com Lasy AI** 🌊
