import { describe, it, expect } from 'vitest'
import { BEACHES_NORTH_TO_SOUTH, FAQS } from './landingData'
import { BEACH_DIRECTORY } from '@/lib/beachDirectory'
import { BEACH_REGISTRY } from '../../../api/_beachRegistry'

describe('FAQ das praias', () => {
  it('cita todas as praias do app, sem faltar nem sobrar', () => {
    expect([...BEACHES_NORTH_TO_SOUTH].sort()).toEqual(BEACH_DIRECTORY.map(b => b.name).sort())
  })

  it('está mesmo de norte a sul', () => {
    const lat = (name: string) => BEACH_REGISTRY.find(b => b.name === name)!.lat
    const lats = BEACHES_NORTH_TO_SOUTH.map(lat)
    expect(lats).toEqual([...lats].sort((a, b) => b - a))
  })

  it('a resposta mostra a lista inteira', () => {
    const answer = FAQS.find(f => f.q === 'Quais praias vocês cobrem?')!.a
    for (const name of BEACHES_NORTH_TO_SOUTH) expect(answer).toContain(name)
    expect(answer).not.toContain('Centro')
  })
})
