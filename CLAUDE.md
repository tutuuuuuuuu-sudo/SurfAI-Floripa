# SurfAI Floripa — Instruções para Claude Code

---

## 🏄 O QUE É ESTE PROJETO

**SurfAI Floripa** é um PWA (Progressive Web App) de surf forecast para Florianópolis.
Domínio: `surfaifloripa.com.br` — deploy automático via Vercel conectado ao GitHub (branch `main`).

### Modelo de negócio (freemium)
| Recurso | Free | Premium (R$ 29,90/mês) |
|---|---|---|
| Score de condições por pico | ✅ | ✅ |
| Relatório IA diário | ❌ | ✅ |
| Histórico de condições | ❌ | ✅ |
| Alertas de swell | ❌ | ✅ |
| Comparação de picos | ❌ | ✅ |
| ContentStudio (posts para redes) | ❌ | ✅ |

Pagamento via **Mercado Pago**. Lógica de acesso em `src/lib/premium.ts` (hook `usePremium()`).
Webhook em `api/mp-webhook.ts` e IPN em `api/mp-ipn.ts` atualizam a tabela `subscriptions` no Supabase.

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
│   ├── History.tsx            # Histórico de condições (premium)
│   ├── SurfLog.tsx            # Diário de sessões do usuário
│   ├── ContentStudio.tsx      # Gerador de posts para redes sociais (premium)
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
│   │   ├── SpotCard.tsx       # Card de pico na listagem
│   │   └── RegionFilter.tsx   # Filtro por região
│   ├── AppLogo.tsx
│   ├── BottomNav.tsx          # Navegação inferior mobile
│   ├── OnboardingModal.tsx    # Modal de boas-vindas / nível do surfista
│   ├── PWAInstallBanner.tsx   # Banner "Adicionar à tela inicial"
│   ├── error-boundary.tsx     # ⚠️ NÃO REMOVER
│   └── theme-toggle.tsx       # Toggle dark/light mode
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
├── surf.ts             # Fetch Open-Meteo Marine → processa dados brutos de surf
├── ai-report.ts        # Gera relatório IA (OpenAI) — exige Bearer token Supabase + premium
├── forecast.ts         # Forecast detalhado por pico
├── create-payment.ts   # Cria preferência de pagamento no Mercado Pago
├── mp-webhook.ts       # Webhook do MP → atualiza subscriptions no Supabase
├── mp-ipn.ts           # IPN (notificação instantânea) do MP
├── daily-report.ts     # Cron: envia relatório diário por email (Resend) para usuários premium
├── content-agent.ts    # Cron: gera sugestões de conteúdo para ContentStudio
├── email-welcome.ts    # Email de boas-vindas (Resend)
└── health.ts           # Cron health check (mantém serverless "quente")
```

**Crons configurados no `vercel.json`** (horário UTC):
- `health`: 10h e 22h diários
- `content-agent`: 13h e 22h diários
- `daily-report`: 10h e 22h diários

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

### Relatório IA — uma única busca por sessão
- `Home.tsx` tem `aiReportFetchedRef` (useRef) que impede re-fetch a cada ciclo de dados.
- O cache fica em `localStorage` por 30min (`src/lib/aiReport.ts`).
- `api/ai-report.ts` exige `Authorization: Bearer <supabase_token>` e verifica se o usuário é premium antes de chamar a OpenAI.
- Status 403 = usuário free → retorna `null` silenciosamente, sem erro.

### Auth e recuperação de senha
- `AuthContext.tsx` detecta `type=recovery` no hash da URL e seta `isPasswordRecovery = true`.
- Quando `isPasswordRecovery` é true, `App.tsx` só renderiza a rota `/reset-password`.
- **NÃO** adicionar detecção de recovery em `App.tsx` — já está no `AuthContext`.

### Picos (BEACHES)
- Definidos em `src/lib/surfData.ts` como array `BEACHES`.
- Coordenadas foram **confirmadas pelo usuário no Google Maps** — não alterar sem confirmação explícita.
- Cada pico tem `orientation` (graus) usado no cálculo de offshore/onshore.
- Sub-regiões têm `swellDirections` que determinam qual pico brilha em cada swell.

### Testes
- Suite vitest: `npm test` → deve manter **70/70 passando**.
- Arquivos de teste: `src/lib/*.test.ts` e `api/_scoreEngine.test.ts`.
- Qualquer mudança em `surfData.ts`, `rating.ts` ou `_scoreEngine.ts` exige rodar os testes.

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
- Relatório IA: 30min em `localStorage`

### Região "Centro" (filtro especial)
- No filtro da Home, "Centro" = praias do centro-sul da ilha.
- IDs: `['novo-campeche', 'joaquina', 'mole', 'barra-lagoa']` — constante `CENTRO_SPOT_IDS`.

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
recharts (gráficos)
sonner (toasts)
@sentry/react (erros em produção)
posthog-js (analytics)
```

### Backend / Infra
```
Vercel (deploy automático via GitHub main)
Supabase (Auth + Postgres + Realtime + Storage)
OpenAI (relatório IA)
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
- `ANTHROPIC_API_KEY`
- `MP_ACCESS_TOKEN` (Mercado Pago)
- `RESEND_API_KEY`

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
- Toggle: componente `<ThemeToggle />` em `src/components/theme-toggle.tsx` (botão sol/lua) e também na página `Settings.tsx` (seção "Aparência").

### Ícones
- **Sempre** `lucide-react` — nunca emojis como ícones na UI
- Exemplo: `import { Waves, MapPin, Crown } from 'lucide-react'`

### Componentes UI disponíveis (`src/components/ui/`)
**Layout**: `card`, `sheet`, `dialog`, `drawer`, `popover`, `tabs`, `accordion`, `scroll-area`, `separator`, `resizable`
**Forms**: `field`, `input`, `textarea`, `select`, `checkbox`, `switch`, `slider`, `calendar`, `combobox`
**Nav**: `navigation-menu`, `breadcrumb`, `dropdown-menu`, `command`
**Feedback**: `alert`, `alert-dialog`, `sonner`, `progress`, `skeleton`, `badge`, `spinner`, `empty`
**Data**: `table`, `chart`, `avatar`, `carousel`, `tooltip`, `toggle`
**Botões**: `button`, `button-group` (variants: default, destructive, outline, ghost, link)

---

## 🗄️ BANCO DE DADOS (Supabase)

### Tabelas relevantes
- `subscriptions` — plano de cada usuário (status: free/premium/cancelled, expires_at, mp_payment_id)
- `comments` — relatos da comunidade por pico
- `favorites` — picos favoritados por usuário
- `surf_log` — diário de sessões

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

- [ ] `npm test` → 70/70 passando (se mudou surfData/rating/_scoreEngine)
- [ ] `npx tsc --noEmit` → 0 erros TypeScript
- [ ] Não duplicou lógica de score (fonte: `api/_scoreEngine.ts`)
- [ ] Não criou nova classe de cor sem usar variável CSS do tema
- [ ] Não adicionou `require()` no código do browser
- [ ] Não removeu ErrorBoundary nem `__lasy_error_handler.js`
- [ ] Coordenadas de picos não foram alteradas sem confirmação do usuário
