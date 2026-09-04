import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkAndNotifyGoodConditions } from './notifications'

function spot(id: string, score: number) {
  return { id, name: id, score }
}

describe('checkAndNotifyGoodConditions — nota mínima por praia', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('Notification', { permission: 'granted' })
  })

  it('usa a nota mínima global quando a praia não tem override', async () => {
    const sent = await checkAndNotifyGoodConditions(
      [spot('campeche', 7)], [], 8, false, {}
    )
    expect(sent).toBe(0) // 7 < 8 (global)
  })

  it('override por praia mais exigente bloqueia mesmo passando da nota global', async () => {
    const sent = await checkAndNotifyGoodConditions(
      [spot('campeche', 7)], [], 6, false, { campeche: 8 }
    )
    expect(sent).toBe(0) // 7 < 8 (override), mesmo 7 >= 6 (global)
  })

  it('override por praia mais permissivo libera mesmo abaixo da nota global', async () => {
    const sent = await checkAndNotifyGoodConditions(
      [spot('campeche', 7)], [], 9, false, { campeche: 6 }
    )
    expect(sent).toBe(1) // 7 >= 6 (override), mesmo 7 < 9 (global)
  })

  it('praias sem override continuam usando a nota global de forma independente', async () => {
    const sent = await checkAndNotifyGoodConditions(
      [spot('campeche', 9), spot('joaquina', 5)], [], 7, false, { joaquina: 4 }
    )
    // campeche: 9 >= 7 (global) → passa · joaquina: 5 >= 4 (override) → passa
    expect(sent).toBe(2)
  })
})
