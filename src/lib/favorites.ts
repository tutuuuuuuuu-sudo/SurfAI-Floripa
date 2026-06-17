import { supabase } from './supabase'

// Cache em memória por user_id para evitar requests duplicados
const favoritesCache = new Map<string, { ids: string[]; fetchedAt: number }>()
const CACHE_TTL_MS = 60_000 // 1 minuto

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function isCacheValid(userId: string): boolean {
  const entry = favoritesCache.get(userId)
  return Boolean(entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS)
}

export async function getFavorites(forceRefresh = false): Promise<string[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  if (!forceRefresh && isCacheValid(userId)) {
    return favoritesCache.get(userId)!.ids
  }

  const { data, error } = await supabase
    .from('favorites')
    .select('beach_id')
    .eq('user_id', userId)

  if (error) return favoritesCache.get(userId)?.ids ?? []

  const ids = data?.map(f => f.beach_id) ?? []
  favoritesCache.set(userId, { ids, fetchedAt: Date.now() })
  return ids
}

export async function isFavorite(spotId: string): Promise<boolean> {
  const favorites = await getFavorites()
  return favorites.includes(spotId)
}

export async function toggleFavorite(spotId: string, spotName: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (!userId) return false

  const cached = favoritesCache.get(userId)
  const isCurrentlyFavorite = cached?.ids.includes(spotId) ?? (await isFavorite(spotId))

  if (isCurrentlyFavorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('beach_id', spotId)

    if (error) return false

    if (cached) {
      cached.ids = cached.ids.filter(id => id !== spotId)
      cached.fetchedAt = Date.now()
    }
    return false
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, beach_id: spotId, beach_name: spotName })

    if (error) return false

    if (cached) {
      cached.ids = [...cached.ids, spotId]
      cached.fetchedAt = Date.now()
    }
    return true
  }
}

export async function clearFavorites(): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) return

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)

  if (error) return

  favoritesCache.delete(userId)
}

/** Invalida o cache local (útil após login/logout) */
export function invalidateFavoritesCache(userId?: string): void {
  if (userId) {
    favoritesCache.delete(userId)
  } else {
    favoritesCache.clear()
  }
}
