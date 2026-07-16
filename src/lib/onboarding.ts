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
