# SurfAI Floripa — Instruções para Claude Code

---

## 🏄 O QUE É ESTE PROJETO

**SurfAI Floripa** é um PWA (Progressive Web App) de surf forecast para Florianópolis.
Domínio: `surfaifloripa.com.br` — deploy automático via Vercel conectado ao GitHub (branch `main`).

### Modelo de negócio (freemium)
Dois planos pagos: **Mensal R$ 22,90/mês** ou **Anual R$ 202,80/ano** (equivale a R$ 16,90/mês) — preço de 02/out/2026 (antes R$ 16,90 e R$ 149,90). **Fonte única do preço: `src/lib/pricing.ts`** (sem imports, usado pelo app e pelos endpoints) — nunca escrever valor à mão. Escolha do plano em `src/pages/Premium.tsx` (`selectedPlan: 'monthly' | 'annual'`), preferência criada em `api/create-payment.ts`.

**Teste grátis (02/out/2026):** 15 dias de Premium, sem cartão, uma vez por conta — botão na página Premium chama a RPC `start_trial()` (só quem nunca teve linha em `subscriptions`). Vira linha `status='premium'`, `plan='trial'`, `amount=0`, `trial_started_at`; o resto do app trata como Premium normal. Quem assina durante o teste mantém os dias que sobraram (`activate_premium` soma). Relatório diário mostra "Teste grátis: N" separado de Premium/MRR. Lembretes de fim de teste/plano: `api/plan-reminders.ts` (abaixo).

| Recurso | Free | Premium |
|---|---|---|
| Nota de condições por pico | ✅ | ✅ |
| Previsão 3 dias | ✅ | ✅ |
| Previsão 14 dias | ❌ | ✅ |
| Chat com o Surf AI (IA) | ❌ | ✅ |
| Alertas de swell (push) | ❌ | ✅ |
| Histórico 30 dias | ❌ | ✅ |
| Melhor janela horária do dia | ❌ | ✅ |
| Comparação de picos | ❌ | ✅ |
| Sem anúncios | ❌ | ✅ |
| Badge Premium no perfil | ❌ | ✅ |

Pagamento via **Mercado Pago**. Lógica de acesso em `src/lib/premium.ts` (hook `usePremium()`).
Webhook em `api/mp-webhook.ts` e IPN em `api/mp-ipn.ts` atualizam a tabela `subscriptions` no Supabase.

**ContentStudio não é benefício de assinante** — é ferramenta de uso interno (`/content-studio`),
exclusiva pra quem está na tabela `admins`, pra gerar posts das redes sociais do próprio Surf AI.
Nunca foi anunciada no app pra clientes. Trava real via `api/is-admin.ts` + `verifyAdminToken`
(`api/_auth.ts`), não por `usePremium()`.

---

## 🗺️ ARQUITETURA DO SISTEMA

### Frontend (React PWA)
```
src/
├── App.tsx                    # BrowserRouter + AuthProvider + SurfDataProvider + rotas
├── main.tsx                   # Entry point — ErrorBoundary, ThemeProvider, monta App
├── index.css                  # Tailwind 4 + variáveis CSS de tema + cores de rating
├── pages/
│   ├── Landing.tsx            # Página pública de vendas (não requer auth)
│   ├── LoginPage.tsx          # Login/cadastro com email ou Google OAuth
│   ├── Home.tsx               # Dashboard principal — lista de picos + relatório IA
│   ├── SpotDetails.tsx        # Detalhe de um pico específico
│   ├── Favorites.tsx          # Picos favoritados pelo usuário
│   ├── Compare.tsx            # Comparação lado a lado de picos (premium)
│   ├── Forecast.tsx           # Previsão 14 dias (premium) — rotas /forecast, /forecast/:id. Histórico de 30 dias é feature separada, direto em SpotDetails.tsx via score_snapshots
│   ├── ForecastDay.tsx        # Detalhe de 1 dia da previsão (/forecast/:id/day/:dayIndex) — curva do dia arrastável (DayCurve), faixa de dias, condições da hora escolhida
│   ├── SurfLog.tsx            # Diário de sessões do usuário
│   ├── ContentStudio.tsx      # Gerador de posts pras redes sociais do Surf AI (uso interno, só admin)
│   ├── SeaLog.tsx             # Registro do mar real (/registro-do-mar, só admin): tamanho visto x o que o app mostrava na mesma hora — calibra api/_beachHeight.ts
│   ├── Premium.tsx            # Página de upgrade/assinatura
│   ├── Profile.tsx            # Perfil e nível do surfista
│   ├── Settings.tsx           # Configurações (notificações, preferências)
│   ├── Navigation.tsx         # Mapa/navegação até os picos
│   ├── ResetPassword.tsx      # Formulário de nova senha (fluxo recovery)
│   ├── Privacy.tsx            # Política de privacidade
│   └── NotFound.tsx           # 404
├── components/
│   ├── spot/                  # Componentes de SpotDetails (extraídos)
│   │   ├── WindCompass.tsx    # Rosa dos ventos clássica (estrela 16 pontas, anel graduado) + seta animada colorida pela força do vento
│   │   ├── TideChart.tsx      # Maré da aba Agora — usa DayTideChart (arrastável, marcador "agora")
│   │   ├── DayTideChart.tsx   # Maré do dia arrastável, mesmo estilo da DayCurve (hora/nível/enchendo-secando)
│   │   ├── CommentsSection.tsx# Relatos da comunidade via Supabase
│   │   ├── ScoreExplainer.tsx # Modal de breakdown do score (onda/período/vento)
│   │   ├── DayCurve.tsx       # "Linha do dia": nota hora a hora como onda contínua + arco do sol, arrastável (ForecastDay)
│   │   └── PicosSection.tsx   # Sub-regiões com matching de swell + links Maps/Waze
│   ├── landing/               # Landing "juntada" (28/set/2026): visual da antiga + peças vivas do app
│   │   ├── Hero.tsx           # Topo "a câmera sobe": foto da Praia Mole → aerofoto SC → satélite → mapa da ilha + lista (fim do topo = mapa em tempo real). Animação montada 1x (Web Animations) e tocada pela rolagem (ViewTimeline; sem ela, JS). Camadas em assets/landing/flyover/, geradas por .content-drafts/flyover/build*.py (fora do git)
│   │   ├── IslandBeachList.tsx# Lista de praias N→S (picos + nota) e resumo "Agora na ilha", ao lado do mapa do Hero
│   │   ├── useIslandBeaches.ts# Praias ordenadas N→S com posição no desenho (islandShape.ts, OpenStreetMap) + resumo por faixa
│   │   ├── DayCurveDemo.tsx   # DayCurve real com a previsão de amanhã (api/landing-day.ts, sem login)
│   │   ├── ChatDemo.tsx       # Conversa de exemplo com dado real, no tom do chat (Lomba x Caldeirão; fim de semana no sul)
│   │   ├── PremiumMorning.tsx # "Uma manhã com o Premium": linha do tempo alerta → Bora Surfar → comparação, com dado ao vivo
│   │   ├── LandingComponents.tsx  # Reveal (animação de entrada), FAQItem, GeoFinderMockup (card Bora Surfar)
│   │   │                      # (print único "hoje, hora a hora" em app-screens/today.webp, usado direto em Landing.tsx)
│   │   └── landingData.ts     # FAQS (instalação no celular é a última pergunta)
│   ├── home/                  # Componentes do Home
│   │   ├── AdBanner.tsx       # Banner de anúncio / upgrade
│   │   ├── NotificationPanel.tsx  # Painel de notificações
│   │   ├── SwellAlert.tsx     # Alerta de swell excepcional
│   │   ├── SwellPeriodWidget.tsx  # Widget de período de swell
│   │   └── TrendBadge.tsx     # Badge de tendência de score
│   ├── surf/
│   │   └── SpotCard.tsx       # Card de pico na listagem
│   ├── AppLogo.tsx
│   ├── BottomNav.tsx          # Navegação inferior mobile
│   ├── OnboardingModal.tsx    # Modal de boas-vindas / nível do surfista
│   ├── PWAInstallBanner.tsx   # Banner "Adicionar à tela inicial"
│   ├── error-boundary.tsx     # ⚠️ NÃO REMOVER
│   └── CookieConsent.tsx      # Banner de consentimento de cookies (LGPD)
├── contexts/
│   ├── AuthContext.tsx        # Auth Supabase — user, session, isPasswordRecovery
│   └── SurfDataContext.tsx    # Cache global de condições — conditions, loading, refresh
├── lib/
│   ├── surfData.ts            # Picos (BEACHES), fetchCurrentConditions(), getSpotById()
│   ├── rating.ts              # getRatingInfo(score) → label/color/bars — ÚNICA fonte
│   ├── aiReport.ts            # fetchAIReport() — cache localStorage 30min
│   ├── premium.ts             # usePremium() (isTrial, daysLeft, canStartTrial), startPremiumTrial(), createMercadoPagoCheckout()
│   ├── pricing.ts             # ⚠️ FONTE ÚNICA do preço (mensal/anual) e dos 15 dias de teste grátis — app e servidor importam daqui
│   ├── admin.ts               # useIsAdmin() via api/is-admin (Registro do mar real + atalho em Configurações)
│   ├── supabase.ts            # createClient() — cliente Supabase único
│   ├── monitoring.ts          # Sentry + PostHog — initMonitoring(), track(), captureError(). PostHog SÓ depois do "Aceitar" no CookieConsent (enableAnalytics/disableAnalytics) — LGPD, 29/set/2026
│   ├── landingStats.ts        # countLandingView/countLandingCta → api/landing-event.ts (só conta no domínio real, não em local/preview)
│   ├── favorites.ts           # getFavorites(), toggleFavorite() via Supabase
│   ├── comments.ts            # getComments(), addComment() via Supabase
│   ├── notifications.ts       # Alertas de condições boas
│   ├── tainha.ts              # isTainhaSeasonActive() — temporada de tainha (sazonalidade)
│   ├── publicSpots.ts         # PUBLIC_SPOT_IDS/TEASER_SPOT_IDS sem imports (app, spot-meta.ts e landing-day.ts usam)
│   ├── directions.ts          # directionName('ESE') → 'leste sudeste' (sigla + nome da direção; app mostra só direção, sem rótulo terral/maral — pedido do usuário 25/set/2026)
│   ├── weatherApi.ts          # getWindyForecast() — Open-Meteo Marine via Vercel API
│   ├── weatherData.ts         # getRealWaterTemp() — temperatura real da água
│   └── utils.ts               # cn() para classes Tailwind
└── hooks/
    └── use-mobile.ts          # Detecção mobile
```

### Backend (Vercel Serverless — pasta `api/`)
```
api/
├── _scoreEngine.ts     # ⚠️ FONTE ÚNICA do score. Importado por surfData.ts E pelos serverless
├── _beachRegistry.ts   # ⚠️ FONTE ÚNICA de id/nome/região/coordenadas/orientação pros crons de backend
│                          (content-agent, daily-report, email-alert, push-notify, snapshot, spot-meta) —
│                          nunca duplicar essa lista de novo (já divergiu 1x, ver auditoria de 22/ago/2026)
├── _auth.ts            # Helper de validação de Bearer token Supabase, compartilhado entre endpoints
├── surf.ts             # Fetch Open-Meteo Marine → processa dados brutos de surf
├── _beachHeight.ts     # Altura da onda NA PRAIA (01/out/2026): base = modelo francês (Météo-France, "modelo padrão" do Open-Meteo) × acréscimo de onda longa (8 s→10 s: até +30%), teto = ECMWF de mar aberto × fator do período. Aplicado em _liveConditions e _hourlyForecast
├── sea-log.ts          # Registro do mar real (só admin): GET lista com a comparação (RPC sea_log_recent), POST novo registro (sea_observations)
├── tide.ts             # Dados de maré por pico
├── surf-chat.ts        # Chat com o Surf AI (Gemini multi-turn, via api/_gemini.ts) — exige Bearer token Supabase + premium.
│                          Substituiu o antigo "Relatório do dia" automático em 23/ago/2026 (gastava
│                          chamada de IA toda vez que qualquer Premium abria o app, mesmo sem pedir)
├── forecast.ts         # Forecast detalhado por pico
├── landing-day.ts      # Um dia (até 7 à frente) hora a hora de uma praia aberta (publicSpots.ts), sem login, cache CDN 1h — demos da landing
├── landing-event.ts    # Contador anônimo da landing (+1 no dia: visita ou clique em botão, lista fechada) → tabela landing_stats (RPC bump_landing_stat, só service role). Sem cookie/IP → não depende do aviso de cookies
├── _dayDetail.ts       # Montagem do dia hora a hora (fonte única de forecast-day.ts e landing-day.ts)
├── _weatherCode.ts     # Tempo (sol/nublado/chuva) dos códigos WMO da Open-Meteo — fonte única do "agora" (surf.ts) e do resumo do céu do dia (_dayDetail: só horas de luz). Página do dia mostra Céu/Ar/Água (água só até ~10 dias)
├── create-payment.ts   # Cria preferência de pagamento no Mercado Pago (valor de src/lib/pricing.ts)
├── plan-reminders.ts   # Robô diário: avisa por e-mail + push quando o Premium/teste grátis está acabando (faltando ~5 dias, 1 dia e no dia que acabou). Regras e textos em _planReminders.ts; tabela plan_reminders impede aviso repetido no mesmo período
├── mp-webhook.ts       # Webhook do MP → atualiza subscriptions no Supabase
├── mp-ipn.ts           # IPN (notificação instantânea) do MP
├── delete-account.ts   # Exclusão de conta do usuário (LGPD)
├── daily-report.ts     # Envia relatório diário por WhatsApp (CallMeBot) — só pro founder, uso interno
├── email-alert.ts      # Alerta de "mar bom" por email (Resend) — só assinantes premium, opt-out em Configurações; olha as 14 praias (antes 8), dispara se alguma tiver nota ≥ 6
├── content-agent.ts    # Gera sugestões de conteúdo para ContentStudio (só admin, ver api/_auth.ts)
├── is-admin.ts         # Checa se o usuário logado está na tabela `admins` (a tabela em si não é lida pelo client, RLS bloqueia)
├── email-welcome.ts    # Email de boas-vindas (Resend)
├── push-subscribe.ts   # Registra subscription de push notification do usuário
├── push-notify.ts      # Envia push notifications (alertas de swell)
├── push-test.ts        # Alerta de teste pedido pelo usuário no painel (push de verdade só pros aparelhos dele)
├── _webPush.ts         # Assinatura VAPID + criptografia do push (compartilhado por push-notify e push-test). iPhone recebe só com o app instalado na tela de início (iOS 16.4+)
├── snapshot.ts         # Grava score_snapshots (histórico de condições) periodicamente
└── health.ts           # Health check (mantém serverless "quente")
```

**Crons — no agendador do Supabase desde 30/set/2026** (pg_cron + pg_net, horário UTC). O
GitHub Actions atrasava até 6 h (alertas "de hora em hora" rodavam a cada 5-6 h). Cada job chama
`public.call_robot('/api/...')`, que manda a senha do cofre (vault `cron_secret`) no cabeçalho
`x-cron-secret`; o robô confere com `isSchedulerCall` (`api/_auth.ts` → RPC `check_cron_secret`).
Cada chamada fica em `robot_runs` (resultado copiado por `collect_robot_results`, job a cada 10 min)
e o relatório diário mostra "Robôs 24h: N ok, N falhas". Ver jobs: `select * from cron.job`.
- `robo-snapshot`: toda hora (:00)
- `robo-push-notify`: toda hora (:05)
- `robo-refresh-windy-cache`: a cada 2 h
- `robo-email-alert`: 9h e 18h
- `robo-daily-report`: 12h e 23h (9h e 20h em Brasília)
- `robo-health`: 10h e 22h
- `robo-lembretes`: 12h (9h em Brasília) — `api/plan-reminders.ts`
- `robo-resultados`: a cada 10 min (registra o resultado das chamadas)

Os arquivos em `.github/workflows/` ficaram só com execução manual (`workflow_dispatch`, senhas
antigas de cada robô continuam valendo). `content-agent.yml` não tem mais horário automático: o
resultado era descartado e gastava cota do Gemini — o ContentStudio usa o endpoint sob demanda.
`cronitor.yml` só enxerga execuções do GitHub (manuais) — o monitoramento dos horários agora é o
`robot_runs` no relatório diário.

`vercel.json` não tem mais nenhum cron configurado — só headers de segurança/cache e rewrites de SPA. Motivo de não usar cron da Vercel: o plano Hobby bloqueava deploys silenciosamente acima de 2 crons/1x-dia.

---

## 🔑 REGRAS INVIOLÁVEIS DESTE PROJETO

### Score — fonte única de verdade
- **TODA** lógica de score vive em `api/_scoreEngine.ts` → `calculateSurfScore(waveHeight, windSpeed, swellPeriod, windDir, beachOrientation)`
- `src/lib/surfData.ts` **importa** de lá. **NUNCA** duplique a lógica de score em outro lugar.
- O prefixo `_` no nome indica que não é endpoint HTTP — o Vercel não expõe como rota.

### Cores de rating — classes semânticas
- Usar **sempre** as classes CSS: `text-rating-epic`, `text-rating-excellent`, `text-rating-good`, `text-rating-fair`, `text-rating-poor`
- E suas variantes: `bg-rating-*`, `from-rating-*/30`, etc.
- Definidas como variáveis OKLCH em `src/index.css` (light + dark mode).
- Função centralizadora: `getRatingInfo(score)` em `src/lib/rating.ts` — **nunca replicar** o switch de faixas.
- Thresholds: ≥8.5 ÉPICO | ≥7 EXCELENTE | ≥5.5 BOM | ≥4 REGULAR | <4 RUIM

### Chat com o Surf AI — substituiu o relatório automático (23/ago/2026)
- O antigo "Relatório do dia" (`fetchAIReport`, `api/ai-report.ts`) foi removido — disparava
  uma chamada de IA sozinho toda vez que qualquer Premium abria a Home, mesmo sem querer ler.
  `src/lib/aiReport.ts` ficou só com `clearAIReportCache()` (limpa cache órfão de usuários
  antigos no logout — não busca mais nada).
- Entrada única de IA na Home agora é o card "Converse com o Surf AI" (Premium), que abre
  `SurfChatPanel.tsx` (painel full-screen animado) e chama `api/surf-chat.ts` só quando o
  usuário manda uma mensagem de verdade — sob demanda, não automático.
- `api/surf-chat.ts` exige `Authorization: Bearer <supabase_token>`, verifica premium, aplica
  rate limit persistido (20 msgs/usuário/dia, `CHAT_DAILY_MAX`) e usa `callGeminiChat` (multi-turn, em
  `api/_gemini.ts`) com histórico salvo em `chat_messages` (Supabase, RLS por usuário).
- Contexto do chat (25/set/2026): condições de agora + **previsão de 7 dias** das 14 praias
  (`api/_chatForecast.ts`: onda, melhor horário via `_goldenWindow`, vento sigla+nome, maré
  enchendo/secando, período; horários de maré alta/baixa), cache 1h no Supabase
  (`live_conditions_cache`, chave `chat:forecast-week-v2`). Memória: últimas 6 mensagens.
  Prioridade ao falar de uma praia: onda → maré → vento (direção+velocidade) → melhor horário.
  Toda resposta passa por `cleanChatReply` (`api/_chatText.ts`) — tira asterisco/markdown/
  travessão no código, não depende do modelo obedecer. Não usar terral/maral/lateral.
- **Cota do Gemini**: conta ainda está no Free Tier do Google AI Studio — **20 chamadas por
  dia, TOTAL, pra todo o app** (relatório antigo + content-agent + daily-report + chat, tudo
  na mesma cota). Usuário está ciente e decidiu não ativar cobrança por enquanto (23/ago/2026).
  Se "a IA parou de responder" for reportado, checar isso antes de investigar como bug.

### Auth e recuperação de senha
- `AuthContext.tsx` detecta `type=recovery` no hash da URL e seta `isPasswordRecovery = true`.
- Quando `isPasswordRecovery` é true, `App.tsx` só renderiza a rota `/reset-password`.
- **NÃO** adicionar detecção de recovery em `App.tsx` — já está no `AuthContext`.

### Picos (BEACHES)
- Definidos em `src/lib/surfData.ts` como array `BEACHES` (rico — inclui subRegions, bestTimeWindow, hikeAccess, usado só pelo frontend).
- Backend (crons) usa `api/_beachRegistry.ts` (id/nome/região/coordenadas/orientação) — **nunca criar uma terceira cópia**, os dois já precisam ser mantidos em sincronia manualmente.
- Coordenadas foram **confirmadas pelo usuário no Google Maps** — não alterar sem confirmação explícita, nos dois arquivos.
- Cada pico tem `orientation` (graus, pra onde a praia está virada) usado no cálculo de offshore/onshore. Refeita em 01/out/2026 com OK do usuário: medida no contorno da costa (OpenStreetMap) e conferida com 5 guias de surf (ver comentário em `api/_beachRegistry.ts`) — a costa leste estava 30-50° virada pro norte demais.
- Vento sul: curva própria, mais dura (`WIND_SOUTH` em `_scoreEngine.ts`), exceto onde ele sopra da terra (`southWindHits`: S/SSW na Barra, SSW no Matadeiro). `southExposure` no registro = proteção parcial (Matadeiro 0,5, Barra 0,7 pro SSE, Armação 0,85); Mole, Moçambique e Santinho ficam expostas (guias concordam/conflitam → mostrar menos).
- Sub-regiões têm `swellDirections` que determinam qual pico brilha em cada swell.

### Testes
- Suite vitest: `npm test` → deve manter todos os testes passando (rodar pra ver o número atual — já mudou várias vezes e qualquer contagem fixa aqui fica desatualizada rápido).
- Arquivos de teste: `src/lib/*.test.ts` e `api/*.test.ts`.
- Qualquer mudança em `surfData.ts`, `rating.ts`, `_scoreEngine.ts` ou `_beachRegistry.ts` exige rodar os testes.

### BrowserRouter
- Já está em `App.tsx` (não no `main.tsx` como o template genérico sugere).
- `App.tsx` contém o `<BrowserRouter>` + `<AuthProvider>` + `<SurfDataProvider>`.

### Arquivos protegidos — nunca remover ou modificar
- `src/components/error-boundary.tsx`
- `public/__lasy_error_handler.js`
- `public/sw.js` (service worker do PWA)

---

## 🌊 DADOS DE SURF — COMO FUNCIONA

### Fluxo de dados
```
Open-Meteo Marine API
    → api/surf.ts (serverless Vercel)
        → src/lib/weatherApi.ts (getWindyForecast)
            → src/lib/surfData.ts (fetchCurrentConditions)
                → SurfDataContext (cache 15min, atualiza todos os componentes)
```

### Temperatura da água
- Fonte real: Open-Meteo Marine (`sea_surface_temperature`) via `src/lib/weatherData.ts`.
- Fallback 1: NOAA ERDDAP
- Fallback 2: sazonalidade calibrada para Floripa
- Lag normal: 6-12h (modelo oceanográfico)

### Cache
- Dados de surf: 15min em memória (`conditionsState` em `surfData.ts`)
- Evita race condition: promise `inflight` garante que fetches simultâneos esperem o mesmo resultado
- Limite de concorrência: 5 praias por lote (para não exceder limites do Vercel Free)

### Regiões da ilha
- Três regiões reais, direto no campo `region` de cada praia (não é mais um filtro sobreposto): `Norte`, `Centro`, `Sul`.
- Norte: Santinho, Moçambique. Centro: Novo Campeche, Joaquina, Praia Mole, Barra da Lagoa. Sul: as demais 8 praias.
- Antigamente existia uma quarta região "Leste" e um filtro especial `CENTRO_SPOT_IDS` que sobrepunha praias de "Leste"/"Sul" como "Centro" — unificado em 17/ago/2026 (o que já era mostrado como "Centro" em quase toda a UI virou o dado real; Moçambique corrigido de "Leste" pra "Norte", também mais correto geograficamente).

---

## 🛠️ STACK E CONFIGURAÇÃO

### Frontend
```
React 19 + TypeScript
Vite 7
Tailwind CSS 4 + @tailwindcss/vite
shadcn/ui + radix-ui
React Router DOM (BrowserRouter em App.tsx)
next-themes (dark/light)
lucide-react (ícones — nunca emojis)
sonner (toasts)
@sentry/react (erros em produção)
posthog-js (analytics)
```

### Backend / Infra
```
Vercel (deploy automático via GitHub main)
Supabase (Auth + Postgres + Realtime + Storage)
Google Gemini (relatório IA — api/_gemini.ts, GEMINI_API_KEY)
Mercado Pago (pagamentos)
Resend (emails transacionais)
```

### Variáveis de ambiente
**Frontend** (`import.meta.env.VITE_*`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_SENTRY_DSN`, `VITE_SENTRY_RELEASE`
- `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`

**Serverless** (`process.env.*`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (Google AI Studio, ai.google.dev — **ainda Free Tier**, teto de 20
  chamadas/dia pra TODO o app, ver seção "Chat com o Surf AI" acima. Usado por
  api/surf-chat.ts, api/content-agent.ts e api/daily-report.ts via api/_gemini.ts, fonte
  única da chamada ao modelo. Trocou a Anthropic em 21/ago/2026 — sem tier grátis contínuo,
  ficou sem crédito e derrubava o relatório da Home sem avisar ninguém)
- `MP_ACCESS_TOKEN` (Mercado Pago)
- `RESEND_API_KEY` (ainda usado por `api/email-alert.ts` e `api/health.ts` — NÃO pelo `daily-report.ts`, ver abaixo)
- `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` (WhatsApp pessoal do founder via CallMeBot, serviço
  gratuito de terceiro — usado só por `api/daily-report.ts`, trocou o envio por e-mail em
  25/ago/2026 a pedido do usuário, "polui demais o email". `CALLMEBOT_PHONE` é o número sem o
  9 extra, formato que o WhatsApp do usuário reportou pro serviço no cadastro)

### Alias de importação
```typescript
// ✅ Sempre usar @/ para src/
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

---

## 🎨 SISTEMA DE DESIGN

### Cores
- **NUNCA** use cores diretas: `bg-blue-500`, `text-red-600`
- **NUNCA** use gradientes CSS inline (`linear-gradient`, `radial-gradient`)
- Use variáveis de tema: `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`
- Para mudar cores globais: edite variáveis em `src/index.css`
- Para cores de rating: use classes `text-rating-*` / `bg-rating-*`

### Tema
- Gerenciado por `<ThemeProvider>` do `next-themes` em `src/main.tsx` (envolve `<App />`), com `attribute="class"`, `defaultTheme="dark"`, `storageKey="theme"`.
- Padrão: **dark mode** para quem ainda não escolheu (sem preferência salva em `localStorage`).
- Usuário pode alternar para light mode e a escolha persiste via `next-themes`.
- Toggle: seção "Aparência" em `src/pages/Settings.tsx` (usa `useTheme()` do `next-themes` diretamente, com botões Claro/Escuro). Era o único lugar do app com esse controle — o componente `<ThemeToggle />` alternativo (botão sol/lua) nunca foi montado em nenhuma página e foi removido na auditoria de 22/ago/2026.

### Ícones
- **Sempre** `lucide-react` — nunca emojis como ícones na UI
- Exemplo: `import { Waves, MapPin, Crown } from 'lucide-react'`

### Componentes UI disponíveis (`src/components/ui/`)
Só 12 primitivos do shadcn/ui — os outros ~42 gerados pelo scaffold inicial nunca chegaram
a ser usados em nenhuma tela e foram removidos na auditoria de 22/ago/2026 (junto das
dependências que só existiam pra sustentá-los: recharts, react-day-picker, cmdk, vaul,
embla-carousel-react, react-resizable-panels, input-otp, @base-ui/react).
- **Layout**: `card`, `glass-card`, `popover`, `separator`
- **Feedback**: `alert`, `alert-dialog`, `sonner`, `progress`, `skeleton`, `badge`, `spinner`
- **Botão**: `button` (variants: default, destructive, outline, ghost, link)

Precisa de um componente que não está nessa lista (ex: `dialog`, `select`, `tabs`)? Rodar
o CLI do shadcn (`npx shadcn@latest add <nome>`) pra gerar de novo, em vez de recriar à mão.

---

## 🗄️ BANCO DE DADOS (Supabase)

### Tabelas relevantes
- `subscriptions` — plano de cada usuário (`status`: free/premium/cancelled, `plan`: monthly/annual, `amount`, `expires_at`, `mp_payment_id`). `expires_at` respeita a duração do plano via `activate_premium(p_duration_days, p_plan, ...)` — 30 dias mensal / 365 dias anual.
- `payments` — histórico de pagamentos aprovados (mp_payment_id, amount, payment_method)
- `profiles` — dados de perfil do usuário (nível de surf, etc)
- `comments` — relatos da comunidade por pico
- `favorites` — picos favoritados por usuário
- `surf_log` — diário de sessões
- `surf_sessions` — sessões de surf registradas pelo usuário
- `user_preferences` — preferências salvas (notificações, filtros)
- `push_subscriptions` — inscrições de push notification (VAPID)
- `score_snapshots` — histórico periódico de score por pico (gravado por `api/snapshot.ts`)
- `plan_reminders` — um registro por lembrete de fim de plano enviado (user_id, kind d5/d1/ended, period_end); RLS sem política, só o servidor

### Realtime
- `subscriptions` tem listener realtime em `usePremium()` para detectar upgrade imediato

### RLS
- Row Level Security ativo em todas as tabelas de usuário
- Serverless functions usam `SUPABASE_SERVICE_ROLE_KEY` para operações admin

### Cliente
```typescript
// src/lib/supabase.ts — único cliente, importar daqui
import { supabase } from '@/lib/supabase'
// Frontend usa VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

---

## 📊 MONITORING

- **Sentry**: captura erros em produção (`VITE_SENTRY_DSN`)
- **PostHog**: analytics de comportamento (`VITE_POSTHOG_KEY`) — autocapture desativado, usar `track()` manualmente. Só é ligado depois do "Aceitar" no aviso de privacidade (antes disso `track()` não faz nada). A landing não mostra o aviso: lá quem conta visitas e cliques é o contador anônimo (`landing_stats`, ver `api/landing-event.ts`) — pra ver os números: `select * from landing_stats order by day desc`
- Funções: `initMonitoring()`, `identifyUser()`, `resetUser()`, `track()`, `captureError()` em `src/lib/monitoring.ts`

---

## 🚫 REGRAS DE COMUNICAÇÃO (PLATAFORMA LASY)

O CLAUDE.md anterior desta plataforma tinha regras gerais de UX — mantidas aqui em resumo:

1. **Responder sempre em português brasileiro**
2. **Nunca sugerir comandos ao usuário** — tudo é executado automaticamente
3. **Nunca usar jargão técnico** sem traduzir para o impacto visual/funcional
4. **ES6 modules** — nunca `require()` no código do browser
5. **Automatizar tudo** — criar arquivos, o servidor já inicia sozinho

---

## ✅ CHECKLIST ANTES DE FINALIZAR QUALQUER MUDANÇA

- [ ] `npm test` → todos passando (se mudou surfData/rating/_scoreEngine/_beachRegistry)
- [ ] `npm run type-check` (`tsc -b --noEmit`) → 0 erros TypeScript. **Nunca rodar `npx tsc --noEmit` sozinho** — o `tsconfig.json` raiz usa project references (`files: []` + `references`), então sem `-b` o comando não segue as referências e sempre retorna "0 erros" mesmo com erros reais (bug descoberto em auditoria de 13/ago/2026).
- [ ] `npm run lint` e `npm audit` de vez em quando (não fazem parte do fluxo rápido de toda mudança, mas rodar periodicamente — nenhum dos dois tinha sido rodado antes da auditoria de 13/ago/2026, achou 50 problemas de lint e 36 vulnerabilidades de dependência acumuladas, incluindo `react-router-dom` desatualizado com falhas de segurança altas)
- [ ] **`type-check` + `test` + `build` passando não é "está tudo funcionando"** — são checagens automáticas, não cobrem comportamento em runtime. Antes de considerar terminada qualquer mudança que mexa em hook com efeito colateral (`useEffect` com listener, subscription, canal realtime do Supabase, `setInterval`, etc.) ou em componente que pode acabar renderizado dentro de outro que já usa o mesmo hook, **abrir o app de verdade (local ou produção) e testar o fluxo afetado no navegador** antes de dar por encerrado. Ninguém tinha feito isso nas correções de 13/ago/2026 até o usuário pedir explicitamente — apareceu um crash real: `Home.tsx` e `NotificationPanel.tsx` (renderizado dentro dela) chamavam `usePremium()` cada um, e as duas instâncias brigavam pelo mesmo canal realtime (`subscription:${user.id}`), derrubando a Home inteira pra qualquer usuário logado. `type-check`/testes/build passavam limpos o tempo todo — só apareceu testando ao vivo no navegador.
- [ ] Não duplicou lógica de score (fonte: `api/_scoreEngine.ts`)
- [ ] Não criou nova classe de cor sem usar variável CSS do tema
- [ ] Não adicionou `require()` no código do browser
- [ ] Não removeu ErrorBoundary nem `__lasy_error_handler.js`
- [ ] Coordenadas de picos não foram alteradas sem confirmação do usuário
