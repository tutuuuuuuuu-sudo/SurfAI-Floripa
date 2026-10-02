import { supabase } from './supabase'

// Fallback em memória para quando localStorage está bloqueado (Safari modo privado
// restritivo, storage desabilitado por política). Não sobrevive a um reload, mas
// evita que o onboarding reapareça repetidamente durante a mesma sessão de aba.
let onboardingDoneMemoryFallback = false

export function isOnboardingDone(): boolean {
  try {
    if (localStorage.getItem('onboarding_done') === '1') return true
  } catch { /* localStorage indisponível — cai para o fallback em memória */ }
  return onboardingDoneMemoryFallback
}

export function markOnboardingDone(): void {
  onboardingDoneMemoryFallback = true
  try {
    localStorage.setItem('onboarding_done', '1')
  } catch { /* modo privado ou storage bloqueado — fallback em memória já cobre a sessão atual */ }
}

/**
 * localStorage é por navegador/dispositivo, não por conta — sem isso, quem já
 * respondeu o onboarding num aparelho volta a ver o quiz em qualquer outro
 * (ou depois de limpar dados do site). Persiste também em `user_preferences`,
 * atrelado ao user_id, pra funcionar como fonte única entre dispositivos.
 */
export function markOnboardingDoneRemote(userId: string): void {
  supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, onboarding_done_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .then(() => {})
}

/** Verifica no Supabase se essa conta já completou o onboarding em outro dispositivo. */
export async function syncOnboardingDoneFromServer(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_preferences')
      .select('onboarding_done_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.onboarding_done_at) {
      markOnboardingDone()
      return true
    }
  } catch { /* rede indisponível — mantém a decisão local por enquanto */ }
  return false
}
