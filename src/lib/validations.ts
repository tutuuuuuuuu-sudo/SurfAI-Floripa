import { supabase, getUserDisplayName } from './supabase'

export interface ValidationSummary {
  matched: number
  total: number
  /** Voto do usuário atual hoje, se já votou */
  userVote: boolean | null
}

function todaySP(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

export async function submitValidation(beachId: string, beachName: string, matched: boolean): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase.from('spot_validations').upsert(
    {
      beach_id: beachId,
      beach_name: beachName,
      user_id: user.id,
      user_name: getUserDisplayName(user),
      matched,
      validation_date: todaySP(),
    },
    { onConflict: 'beach_id,user_id,validation_date' }
  )

  return !error
}

export async function getValidationSummary(beachId: string): Promise<ValidationSummary> {
  const date = todaySP()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('spot_validations')
    .select('user_id, matched')
    .eq('beach_id', beachId)
    .eq('validation_date', date)

  if (error || !data) return { matched: 0, total: 0, userVote: null }

  const matched = data.filter(v => v.matched).length
  const userVote = user ? data.find(v => v.user_id === user.id)?.matched ?? null : null

  return { matched, total: data.length, userVote }
}

/** Busca o resumo de validação de vários picos em um único request — usado na listagem da Home */
export async function getValidationSummaries(beachIds: string[]): Promise<Record<string, ValidationSummary>> {
  if (beachIds.length === 0) return {}
  const date = todaySP()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('spot_validations')
    .select('beach_id, user_id, matched')
    .in('beach_id', beachIds)
    .eq('validation_date', date)

  if (error || !data) return {}

  const result: Record<string, ValidationSummary> = {}
  for (const id of beachIds) result[id] = { matched: 0, total: 0, userVote: null }

  for (const row of data) {
    const beachId = row.beach_id as string
    if (!result[beachId]) result[beachId] = { matched: 0, total: 0, userVote: null }
    result[beachId].total += 1
    if (row.matched) result[beachId].matched += 1
    if (user && row.user_id === user.id) result[beachId].userVote = row.matched as boolean
  }

  return result
}
