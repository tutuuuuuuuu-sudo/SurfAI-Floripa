// Sentry (~44KB comprimidos em produção — só aparece no build da Vercel, não no local,
// porque só entra quando VITE_SENTRY_DSN existe) e posthog-js (~11% do bundle principal)
// só são baixados sob demanda, depois do primeiro render — nenhum dos dois precisa
// bloquear a tela inicial. Promise cacheada garante uma única chamada de import() mesmo
// com identifyUser/resetUser/track/captureError disparando em sequência.
let posthogPromise: Promise<typeof import('posthog-js').default> | null = null
function getPosthog() {
  if (!posthogPromise) posthogPromise = import('posthog-js').then(m => m.default)
  return posthogPromise
}

let sentryPromise: Promise<typeof import('@sentry/react')> | null = null
function getSentry() {
  if (!sentryPromise) sentryPromise = import('@sentry/react')
  return sentryPromise
}

export function initMonitoring() {
  // Sentry — captura erros em produção
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN
  if (sentryDsn) {
    getSentry().then(Sentry => {
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_SENTRY_RELEASE ?? 'surf-ai@dev',
        tracesSampleRate: 0.2,
        replaysSessionSampleRate: 0,
        integrations: [Sentry.browserTracingIntegration()],
        beforeSend(event) {
          const url = event.request?.url ?? ''
          if (url.includes('chrome-extension') || url.includes('moz-extension')) return null
          return event
        },
      })
    })
  }

  // PostHog — analytics de comportamento. LGPD (29/set/2026): só liga depois do "Aceitar" no
  // aviso de privacidade (CookieConsent.tsx). Antes coletava anonimamente enquanto a pessoa não
  // decidia — e a landing nem mostra o aviso, então todo visitante era coletado sem aceitar.
  // Na landing, visitas e cliques são contados sem cookie por src/lib/landingStats.ts.
  if (readConsent() === 'accepted') enableAnalytics()
}

let analyticsOn = false
function readConsent() {
  try { return localStorage.getItem('analytics_consent') } catch { return null }
}

// Liga o PostHog (no início, se já aceitou antes; ou na hora em que aceita no aviso)
export function enableAnalytics() {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY
  if (!posthogKey || analyticsOn) return
  analyticsOn = true
  getPosthog().then(posthog => {
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
    })
  })
}

// Recusou: o PostHog nem chega a ser baixado; se estava ligado, para de coletar
export function disableAnalytics() {
  if (!analyticsOn) return
  analyticsOn = false
  getPosthog().then(posthog => posthog.opt_out_capturing())
}

// Identifica o usuário no PostHog e Sentry após login
export function identifyUser(id: string, email: string, name?: string) {
  if (analyticsOn) {
    getPosthog().then(posthog => posthog.identify(id, { email, name: name ?? '' }))
  }
  if (import.meta.env.VITE_SENTRY_DSN) {
    getSentry().then(Sentry => Sentry.setUser({ id, email }))
  }
}

// Remove identidade ao fazer logout
export function resetUser() {
  if (analyticsOn) getPosthog().then(posthog => posthog.reset())
  if (import.meta.env.VITE_SENTRY_DSN) getSentry().then(Sentry => Sentry.setUser(null))
}

// Rastreia evento customizado
export function track(event: string, properties?: Record<string, unknown>) {
  if (analyticsOn) {
    getPosthog().then(posthog => posthog.capture(event, properties))
  }
}

// Captura erro avulso
export function captureError(error: unknown, context?: Record<string, string>) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  getSentry().then(Sentry => {
    Sentry.withScope(scope => {
      if (context) scope.setExtras(context)
      Sentry.captureException(error)
    })
  })
}
