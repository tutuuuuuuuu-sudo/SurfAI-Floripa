const CACHE_KEY = 'ai_report_cache'

// O relatório automático foi substituído pelo Chat com o Surf AI (23/ago/2026) — a busca
// em si não existe mais, mas usuários que ainda têm cache antigo salvo no navegador (de
// antes dessa troca) precisam dele limpo no logout, senão fica lixo órfão no localStorage.
export function clearAIReportCache() {
  try {
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith(CACHE_KEY)) storage.removeItem(key)
      }
    }
  } catch { /* ignore */ }
}
