# SurfAI Floripa — Instruções para Claude Code

---

## 🏄 O QUE É ESTE PROJETO

**SurfAI Floripa** é um PWA (Progressive Web App) de surf forecast para Florianópolis.
Domínio: `surfaifloripa.com.br` — deploy automático via Vercel conectado ao GitHub (branch `main`).

### Modelo de negócio (freemium)
Dois planos pagos: **Mensal R$ 16,90/mês** ou **Anual R$ 149,90/ano** (equivale a R$ 12,49/mês). Escolha do plano em `src/pages/Premium.tsx` (`selectedPlan: 'monthly' | 'annual'`), preferência criada em `api/create-payment.ts`.

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
│   ├── SurfLog.tsx            # Diário de sessões do usuário
│   ├── ContentStudio.tsx      # Gerador de posts pras redes sociais do Surf AI (uso interno, só admin)
│   ├── Premium.tsx            # Página de upgrade/assinatura
│   ├── Profile.tsx            # Perfil e nível do surfista
│   ├── Settings.tsx           # Configurações (notificações, preferências)
│   ├── Navigation.tsx         # Mapa/navegação até os picos
│   ├── ResetPassword.tsx      # Formulário de nova senha (fluxo recovery)
│   ├── Privacy.tsx            # Política de privacidade
│   └── NotFound.tsx           # 404
├── components/
│   ├── spot/                  # Componentes de SpotDetails (extraídos)
│   │   ├── WindCompass.tsx    # Bússola SVG com seta de direção do vento
│   │   ├── TideChart.tsx      # Gráfico de maré interativo com modal expansível
│   │   ├── CommentsSection.tsx# Relatos da comunidade via Supabase
│   │   ├── ScoreExplainer.tsx # Modal de breakdown do score (onda/período/vento)
│   │   └── PicosSection.tsx   # Sub-regiões com matching de swell + links Maps/Waze
│   ├── landing/               # Componentes de Landing (extraídos)
│   │   ├── LandingComponents.tsx  # useReveal, Reveal, OceanWaves, AppMockup3D, etc
│   │   └── landingData.ts     # Arrays estáticos (TESTIMONIALS, FAQS, STATS, etc)
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
│   ├── premium.ts             # usePremium(), createMercadoPagoCheckout()
│   ├── supabase.ts            # createClient() — cliente Supabase único
│   ├── monitoring.ts          # Sentry + PostHog — initMonitoring(), track(), captureError()
│   ├── favorites.ts           # getFavorites(), toggleFavorite() via Supabase
│   ├── comments.ts            # getComments(), addComment() via Supabase
│   ├── notifications.ts       # Alertas de condições boas
│   ├── tainha.ts              # isTainhaSeasonActive() — temporada de tainha (sazonalidade)
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
├── tide.ts             # Dados de maré por pico
├── surf-chat.ts        # Chat com o Surf AI (Gemini multi-turn, via api/_gemini.ts) — exige Bearer token Supabase + premium.
│                          Substituiu o antigo "Relatório do dia" automático em 23/ago/2026 (gastava
│                          chamada de IA toda vez que qualquer Premium abria o app, mesmo sem pedir)
├── forecast.ts         # Forecast detalhado por pico
├── create-payment.ts   # Cria preferência de pagamento no Mercado Pago
├── mp-webhook.ts       # Webhook do MP → atualiza subscriptions no Supabase
├── mp-ipn.ts           # IPN (notificação instantânea) do MP
├── delete-account.ts   # Exclusão de conta do usuário (LGPD)
├── daily-report.ts     # Envia relatório diário por WhatsApp (CallMeBot) — só pro founder, uso interno
├── email-alert.ts      # Alerta de "mar bom" por email (Resend) — só assinantes premium, opt-out em Configurações
├── content-agent.ts    # Gera sugestões de conteúdo para ContentStudio (só admin, ver api/_auth.ts)
├── is-admin.ts         # Checa se o usuário logado está na tabela `admins` (a tabela em si não é lida pelo client, RLS bloqueia)
├── email-welcome.ts    # Email de boas-vindas (Resend)
├── push-subscribe.ts   # Registra subscription de push notification do usuário
├── push-notify.ts      # Envia push notifications (alertas de swell)
├── snapshot.ts         # Grava score_snapshots (histórico de condições) periodicamente
└── health.ts           # Health check (mantém serverless "quente")
```

**Crons — migrados do `vercel.json` para GitHub Actions** (`.github/workflows/`, horário UTC):
- `health.yml`: 10h e 22h diários
- `content-agent.yml`: 13h e 22h diários
- `daily-report.yml`: 12h e 23h diários
- `email-alert.yml`: 9h e 18h diários
- `push-notify.yml`: a cada hora
- `snapshot.yml`: a cada hora
- `cronitor.yml`: monitoramento dos jobs acima

`vercel.json` não tem mais nenhum cron configurado — só headers de segurança/cache e rewrites de SPA. Motivo da migração: o plano Hobby da Vercel bloqueava deploys silenciosamente acima de 2 crons/1x-dia.

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
  rate limit persistido (40 msgs/usuário/dia) e usa `callGeminiChat` (multi-turn, em
  `api/_gemini.ts`) com histórico salvo em `chat_messages` (Supabase, RLS por usuário).
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
- Cada pico tem `orientation` (graus) usado no cálculo de offshore/onshore.
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
- **PostHog**: analytics de comportamento (`VITE_POSTHOG_KEY`) — autocapture desativado, usar `track()` manualmente
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
