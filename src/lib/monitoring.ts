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

  // PostHog — analytics de comportamento (respeita consentimento LGPD)
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY
  const analyticsConsent = (() => { try { return localStorage.getItem('analytics_consent') } catch { return null } })()
  if (posthogKey && analyticsConsent !== 'declined') {
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
    })
    if (analyticsConsent === null) {
      // Consentimento ainda não dado — coleta anonimamente até o usuário decidir
      posthog.opt_in_capturing()
    }
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
