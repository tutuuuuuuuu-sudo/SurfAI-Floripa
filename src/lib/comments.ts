import { supabase, getUserDisplayName } from './supabase'

export interface Comment {
  id: string
  beach_id: string
  beach_name: string
  user_id: string
  user_name: string
  content: string
  wave_height?: number
  score?: number
  created_at: string
}

export async function getComments(beachId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('beach_id', beachId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return []
  return data ?? []
}

export async function addComment(
  beachId: string,
  beachName: string,
  content: string,
  waveHeight?: number,
  score?: number
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const userName = getUserDisplayName(user)

  const { error } = await supabase.from('comments').insert({
    beach_id: beachId,
    beach_name: beachName,
    user_id: user.id,
    user_name: userName,
    content,
    wave_height: waveHeight,
    score,
  })

  if (error) return false
  return true
}

export async function deleteComment(commentId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id)

  if (error) return false
  return true
}

export interface LatestComment {
  beach_id: string
  user_name: string
  content: string
  created_at: string
}

export async function getLatestCommentsForSpots(beachIds: string[]): Promise<Record<string, LatestComment>> {
  if (beachIds.length === 0) return {}

  const { data, error } = await supabase
    .from('comments')
    .select('beach_id, user_name, content, created_at')
    .in('beach_id', beachIds)
    .order('created_at', { ascending: false })
    .limit(beachIds.length * 3)

  if (error || !data) return {}

  const result: Record<string, LatestComment> = {}
  for (const row of data) {
    if (!result[row.beach_id as string]) {
      result[row.beach_id as string] = row as LatestComment
    }
  }
  return result
}

export function formatCommentTime(createdAt: string): string {
  const now = new Date()
  const date = new Date(createdAt)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'agora mesmo'
  if (diffMins < 60) return `há ${diffMins} min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return 'ontem'
  return `há ${diffDays} dias`
}
