// Utilitário centralizado de rating — use este em TODOS os componentes
// Evita duplicar a mesma lógica em SpotCard, Favorites, SpotDetails, History, etc.

export interface RatingInfo {
  label: string
  color: string
  bg: string
  bars: number
  scoreColor: string
}

export function getRatingInfo(score: number): RatingInfo {
  if (score >= 8.5) return { label: 'ÉPICO',     color: 'text-rating-epic',      bg: 'bg-rating-epic',      bars: 5, scoreColor: 'var(--rating-epic)' }
  if (score >= 7)   return { label: 'EXCELENTE', color: 'text-rating-excellent', bg: 'bg-rating-excellent', bars: 4, scoreColor: 'var(--rating-excellent)' }
  if (score >= 5.5) return { label: 'BOM',       color: 'text-rating-good',      bg: 'bg-rating-good',      bars: 3, scoreColor: 'var(--rating-good)' }
  if (score >= 4)   return { label: 'REGULAR',   color: 'text-rating-fair',      bg: 'bg-rating-fair',      bars: 2, scoreColor: 'var(--rating-fair)' }
  return              { label: 'RUIM',       color: 'text-rating-poor',      bg: 'bg-rating-poor',      bars: 1, scoreColor: 'var(--rating-poor)' }
}

export function getScoreColor(score: number): string {
  return getRatingInfo(score).scoreColor
}

export function getThemeGradient(score: number): string {
  if (score >= 8.5) return 'from-rating-epic/30 via-background to-background'
  if (score >= 7)   return 'from-rating-excellent/30 via-background to-background'
  if (score >= 5.5) return 'from-rating-good/30 via-background to-background'
  if (score >= 4)   return 'from-rating-fair/30 via-background to-background'
  return                   'from-rating-poor/30 via-background to-background'
}
