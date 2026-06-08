import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

export function initMonitoring() {
  // Sentry — captura erros em produção
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN
  if (sentryDsn) {
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
  }

  // PostHog — analytics de comportamento
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only', // só cria perfil quando o usuário faz login
      capture_pageview: true,             // rastreia navegação entre páginas automaticamente
      capture_pageleave: true,            // rastreia quando o usuário sai
      autocapture: false,                 // eventos manuais são mais precisos para surf app
    })
  }
}

// Identifica o usuário no PostHog e Sentry após login
export function identifyUser(id: string, email: string, name?: string) {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.identify(id, { email, name: name ?? '' })
  }
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser({ id, email })
  }
}

// Remove identidade ao fazer logout
export function resetUser() {
  if (import.meta.env.VITE_POSTHOG_KEY) posthog.reset()
  if (import.meta.env.VITE_SENTRY_DSN) Sentry.setUser(null)
}

// Rastreia evento customizado
export function track(event: string, properties?: Record<string, unknown>) {
  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.capture(event, properties)
  }
}

// Captura erro avulso
export function captureError(error: unknown, context?: Record<string, string>) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.withScope(scope => {
    if (context) scope.setExtras(context)
    Sentry.captureException(error)
  })
}
