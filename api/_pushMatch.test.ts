// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { beachMatches, favoritesByUser, isAlertHour, nextAlertBeach, markAlerted } from './_pushMatch'

describe('beachMatches', () => {
  const sub = { min_score: 7, favorite_only: true, beach_thresholds: { joaquina: 5 } }
  it('usa a nota da praia quando a pessoa definiu uma, senão a geral', () => {
    expect(beachMatches(sub, 'joaquina', 5.5, ['joaquina'])).toBe(true)
    expect(beachMatches(sub, 'campeche', 6.9, ['campeche'])).toBe(false)
    expect(beachMatches(sub, 'campeche', 7, ['campeche'])).toBe(true)
  })
  it('"só favoritas" barra praia que não é favorita', () => {
    expect(beachMatches(sub, 'campeche', 9, [])).toBe(false)
    expect(beachMatches({ ...sub, favorite_only: false }, 'campeche', 9, [])).toBe(true)
  })
})

// De 17/jun a 14/out/2026 a consulta pedia "spot_id" (a coluna é beach_id): o banco recusava, a
// lista voltava vazia e nenhum alerta com "só favoritas" saiu
describe('favoritesByUser', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('pede a coluna beach_id e agrupa por usuário', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve([{ user_id: 'u1', beach_id: 'campeche' }, { user_id: 'u1', beach_id: 'mole' }, { user_id: 'u2', beach_id: 'barra-lagoa' }]),
    })
    vi.stubGlobal('fetch', fetchMock)
    const favs = await favoritesByUser('https://x.supabase.co', 'key', ['u1', 'u2'])
    expect(fetchMock.mock.calls[0][0]).toContain('select=user_id,beach_id')
    expect(favs).toEqual({ u1: ['campeche', 'mole'], u2: ['barra-lagoa'] })
  })
})

describe('isAlertHour', () => {
  it('só de 5h às 18h', () => {
    expect(isAlertHour(4)).toBe(false)
    expect(isAlertHour(5)).toBe(true)
    expect(isAlertHour(18)).toBe(true)
    expect(isAlertHour(19)).toBe(false)
    expect(isAlertHour(3)).toBe(false)
  })
})

describe('um aviso por praia por dia', () => {
  const today = '2026-10-14'
  it('primeiro aviso do dia vai pra melhor praia', () => {
    expect(nextAlertBeach(['campeche', 'santinho'], { alerted_on: null, alerted_beaches: null }, today)).toBe('campeche')
  })
  it('praia já avisada hoje não repete; a próxima boa ainda avisa', () => {
    const sub = { alerted_on: today, alerted_beaches: ['campeche'] }
    expect(nextAlertBeach(['campeche'], sub, today)).toBeNull()
    expect(nextAlertBeach(['campeche', 'santinho'], sub, today)).toBe('santinho')
  })
  it('aviso de ontem não conta hoje', () => {
    expect(nextAlertBeach(['campeche'], { alerted_on: '2026-10-13', alerted_beaches: ['campeche'] }, today)).toBe('campeche')
  })
  it('markAlerted soma a praia na lista do dia e zera a de ontem', () => {
    expect(markAlerted({ alerted_on: today, alerted_beaches: ['campeche'] }, 'santinho', today)).toEqual({ alerted_on: today, alerted_beaches: ['campeche', 'santinho'] })
    expect(markAlerted({ alerted_on: '2026-10-13', alerted_beaches: ['campeche'] }, 'mole', today)).toEqual({ alerted_on: today, alerted_beaches: ['mole'] })
  })
})
