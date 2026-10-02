// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calculateSurfScore, applyDirectionalExposure, explainSurfScore, southWindHits } from './_scoreEngine'
import { BEACH_REGISTRY } from './_beachRegistry'

describe('explainSurfScore', () => {
  it('a soma dos três componentes bate exatamente com calculateSurfScore (mesmos inputs)', () => {
    const cases: [number, number, number, string, number][] = [
      [2.5, 5, 11, 'W', 90],
      [1.0, 12, 9, 'S', 90],
      [0.4, 21, 7, 'SSE', 90],
      [1.30, 24, 7, 'S', 180],
    ]
    for (const args of cases) {
      const total = calculateSurfScore(...args)
      const breakdown = explainSurfScore(...args)
      expect(breakdown.total).toBe(total)
      const sum = Number((breakdown.waveBase + breakdown.windPenalty + breakdown.periodAdjust).toFixed(1))
      // Só diverge da soma bruta quando o clamp [1,10] do calculateSurfScore entra em ação
      const clamped = Math.min(10, Math.max(1, sum))
      expect(breakdown.total).toBe(clamped)
    }
  })

  it('classifica o vento como offshore/lateral/onshore de acordo com o ângulo até a praia', () => {
    // Praia orientação 90° (leste) — offshore é vento W (270°)
    expect(explainSurfScore(1, 5, 10, 'W', 90).windQuality).toBe('offshore')
    expect(explainSurfScore(1, 5, 10, 'N', 90).windQuality).toBe('lateral')
    expect(explainSurfScore(1, 5, 10, 'E', 90).windQuality).toBe('onshore')
  })
})

describe('calculateSurfScore', () => {
  // ── Limites absolutos ────────────────────────────────────────────────────────

  it('nunca retorna score abaixo de 1', () => {
    const score = calculateSurfScore(0, 50, 1, 'E', 90)
    expect(score).toBeGreaterThanOrEqual(1)
  })

  it('nunca retorna score acima de 10', () => {
    const score = calculateSurfScore(3, 0, 20, 'W', 90)
    expect(score).toBeLessThanOrEqual(10)
  })

  // ── Altura de onda ───────────────────────────────────────────────────────────

  it('ondas 2.5m+ com condições ideais retorna 10', () => {
    // Praia orientação 90° (leste), vento W (offshore), vento leve, período bom.
    // Valores em metros reais — desde 28/ago/2026 a fonte principal (fetchOpenMeteo,
    // modelo ecmwf_wam) não infla mais o valor por MODEL_BIAS_CORRECTION, então o
    // waveHeight que chega aqui já é o metro real, sem multiplicador (ver comentário
    // no topo de explainSurfScore).
    const score = calculateSurfScore(2.5, 5, 16, 'W', 90)
    expect(score).toBe(10)
  })

  it('ondas 1.2m produz waveBase 8.0', () => {
    // Testa o waveBase isolado (não o total) porque, com vento/período agora somando
    // pontos de verdade em vez de só neutralizar, não existe mais uma combinação
    // "neutra" de vento+período pra isolar a contribuição da onda via total.
    const breakdown = explainSurfScore(1.2, 5, 10, 'W', 90)
    expect(breakdown.waveBase).toBe(8.0)
  })

  it('ondas muito pequenas (0.3m) com vento e período ruins penaliza bastante', () => {
    const score = calculateSurfScore(0.3, 25, 3, 'E', 90)
    expect(score).toBeLessThan(3)
  })

  // ── Vento offshore / onshore ─────────────────────────────────────────────────

  it('vento offshore leve soma pontos (não só deixa de penalizar)', () => {
    // Praia leste (90°), offshore é W (270°)
    const scoreOffshore = calculateSurfScore(1.0, 8, 10, 'W', 90)
    const scoreOnshore  = calculateSurfScore(1.0, 8, 10, 'E', 90)
    expect(scoreOffshore).toBeGreaterThan(scoreOnshore)
  })

  it('vento onshore forte penaliza fortemente', () => {
    const scoreLight  = calculateSurfScore(1.0, 5,  10, 'E', 90)
    const scoreStrong = calculateSurfScore(1.0, 30, 10, 'E', 90)
    expect(scoreStrong).toBeLessThan(scoreLight)
  })

  it('offshore leve é melhor que offshore forte', () => {
    const offshoreLight  = calculateSurfScore(1.0, 5,  10, 'W', 90)
    const offshoreStrong = calculateSurfScore(1.0, 25, 10, 'W', 90)
    expect(offshoreLight).toBeGreaterThan(offshoreStrong)
  })

  it('offshore a qualquer intensidade é melhor que onshore à mesma intensidade', () => {
    const offshore = calculateSurfScore(1.0, 15, 10, 'W', 90)
    const onshore  = calculateSurfScore(1.0, 15, 10, 'E', 90)
    expect(offshore).toBeGreaterThan(onshore)
  })

  // ── Período do swell ─────────────────────────────────────────────────────────

  it('período longo (16s+) adiciona bônus', () => {
    const long  = calculateSurfScore(1.0, 5, 16, 'W', 90)
    const short = calculateSurfScore(1.0, 5, 6,  'W', 90)
    expect(long).toBeGreaterThan(short)
  })

  it('período muito curto (5s) penaliza', () => {
    const medium = calculateSurfScore(1.0, 5, 10, 'W', 90)
    const short  = calculateSurfScore(1.0, 5, 5,  'W', 90)
    expect(short).toBeLessThan(medium)
  })

  it('período segue a tabela de 30/set/2026 e anda em linha reta entre os pontos', () => {
    const p = (t: number) => explainSurfScore(1.0, 5, t, 'W', 90).periodAdjust
    expect([5, 6, 7, 8, 9, 10, 11].map(p)).toEqual([-1.2, -0.7, 0.2, 0.7, 1.0, 1.2, 1.4])
    expect(p(6.5)).toBe(-0.2) // meio caminho entre -0,7 e +0,2 (-0,25, arredondado)
    expect(p(4)).toBe(-1.2)
    expect(p(14)).toBe(1.4)
  })

  // ── Vento sul (30/set/2026) ──────────────────────────────────────────────────

  it('vento sul em praia exposta: 10 km/h −1,5 · 15 −3 · 17 −4 · 20 −5,5 · 25 −7 (01/out/2026)', () => {
    for (const orientation of [70, 90, 130, 180]) {
      for (const dir of ['S', 'SSE', 'SSW']) {
        const p = (v: number) => explainSurfScore(1.0, v, 9, dir, orientation).windPenalty
        expect([10, 15, 17, 20, 25, 30].map(p)).toEqual([-1.5, -3, -4, -5.5, -7, -8])
      }
    }
  })

  it('swell bom com sul de 20 km/h no Campeche fica ruim; no Matadeiro (protegido) segue bom', () => {
    // "o mar fica extremamente ruim, não tem formação" — usuário, 01/out/2026
    expect(calculateSurfScore(1.2, 20, 10, 'S', 90)).toBeLessThan(4)
    const matadeiro = calculateSurfScore(1.2, 20, 10, 'S', 110, 0.5)
    const armacao = calculateSurfScore(1.2, 20, 10, 'S', 115, 0.85)
    expect(matadeiro).toBeGreaterThanOrEqual(7)
    expect(armacao).toBeGreaterThan(calculateSurfScore(1.2, 20, 10, 'S', 100))
    expect(armacao).toBeLessThan(matadeiro)
  })

  it('mar médio com sul de 17 km/h em praia exposta cai pra ruim (antes ficava em 5,3)', () => {
    expect(calculateSurfScore(1.0, 17, 7, 'S', 90)).toBeLessThan(4)
  })

  it('proteção ao sul só mexe no vento sul', () => {
    expect(calculateSurfScore(1.0, 20, 9, 'E', 110, 0.5)).toBe(calculateSurfScore(1.0, 20, 9, 'E', 110))
  })

  it('sul de 21 km/h com onda curta não passa de "ruim" (usuário, 30/set/2026)', () => {
    // Campeche 30/set à tarde: ~1 m na praia, período 6 s, sul 21 km/h
    expect(calculateSurfScore(0.98, 21, 6, 'S', 90)).toBeLessThan(4)
  })

  it('vento sul é o pior vento: nunca fica mais brando que outra direção na mesma velocidade', () => {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    for (const speed of [5, 8, 10, 12, 15, 18, 20, 25, 30]) {
      const south = explainSurfScore(1.0, speed, 9, 'S', 90).windPenalty
      for (const dir of dirs) {
        expect(south).toBeLessThanOrEqual(explainSurfScore(1.0, speed, 9, dir, 90).windPenalty)
      }
    }
  })

  it('outros ventos não descontam nada até 10 km/h', () => {
    for (const dir of ['N', 'NE', 'E', 'SE', 'W', 'NW']) {
      expect(explainSurfScore(1.0, 10, 9, dir, 90).windPenalty).toBeGreaterThanOrEqual(0)
    }
  })

  it('1 km/h a mais de vento nunca derruba a nota de uma vez', () => {
    for (const dir of ['S', 'E', 'N', 'W']) {
      for (let v = 0; v < 30; v++) {
        const a = explainSurfScore(1.0, v, 9, dir, 90).windPenalty
        const b = explainSurfScore(1.0, v + 1, 9, dir, 90).windPenalty
        expect(Math.abs(a - b)).toBeLessThanOrEqual(0.51)
      }
    }
  })

  it('casos reais do usuário: calibração de set/2026 mantida e Campeche com sul corrigido', () => {
    // 0,75 m, período 9-10 s, terral fraco = nota ~8; 0,6 m nas mesmas condições = ~7
    expect(calculateSurfScore(0.75, 5, 9.5, 'W', 90)).toBeGreaterThanOrEqual(7.8)
    expect(calculateSurfScore(0.75, 5, 9.5, 'W', 90)).toBeLessThan(8.5)
    expect(calculateSurfScore(0.6, 5, 9.5, 'W', 90)).toBeGreaterThanOrEqual(6.8)
    expect(calculateSurfScore(0.6, 5, 9.5, 'W', 90)).toBeLessThan(7.5)
    // Campeche, 1,5 m, 5 s, sul 15 km/h: antes 8,3 (excelente), agora abaixo de 7
    expect(calculateSurfScore(1.5, 15, 5, 'S', 90)).toBeLessThan(7)
    // 1,4 m com 6 s e quase sem vento não é mais "épico" (≥ 8,5)
    expect(calculateSurfScore(1.4, 3, 6, 'NNE', 90)).toBeLessThan(8.5)
  })

  // ── Direção desconhecida ─────────────────────────────────────────────────────

  it('direção de vento desconhecida não causa crash', () => {
    expect(() => calculateSurfScore(1.0, 10, 10, 'DESCONHECIDO', 90)).not.toThrow()
  })

  // ── Orientações de praia ─────────────────────────────────────────────────────

  it('mesmo vento é offshore para praia leste e onshore para praia oeste', () => {
    // Vento E: offshore para praia W (270°), onshore para praia E (90°)
    const asOffshore = calculateSurfScore(1.0, 15, 10, 'E', 270)
    const asOnshore  = calculateSurfScore(1.0, 15, 10, 'E', 90)
    expect(asOffshore).toBeGreaterThan(asOnshore)
  })
})

// Orientação medida no mapa + guias de surf de Floripa (01/out/2026)
describe('vento por praia com a orientação real', () => {
  const beach = (id: string) => BEACH_REGISTRY.find(b => b.id === id)!

  it('na Barra da Lagoa o sul sopra da terra e conta como terral', () => {
    const barra = beach('barra-lagoa')
    expect(southWindHits('S', barra.orientation)).toBe(false)
    const b = explainSurfScore(1.0, 15, 9, 'S', barra.orientation, barra.southExposure ?? 1)
    expect(b.windQuality).toBe('offshore')
    expect(b.windPenalty).toBeGreaterThan(0)
  })

  it('nas praias expostas o sul continua derrubando a nota', () => {
    for (const id of ['campeche', 'novo-campeche', 'morro-pedras', 'joaquina', 'mole', 'mocambique', 'santinho']) {
      const b = beach(id)
      expect(southWindHits('S', b.orientation)).toBe(true)
      expect(calculateSurfScore(1.2, 20, 10, 'S', b.orientation, b.southExposure ?? 1)).toBeLessThan(4)
    }
  })

  it('Matadeiro: sul ainda pega (protegido pela metade), sul-sudoeste já é terral', () => {
    const m = beach('matadeiro')
    expect(southWindHits('S', m.orientation)).toBe(true)
    expect(southWindHits('SSW', m.orientation)).toBe(false)
    const protegido = calculateSurfScore(1.2, 20, 10, 'S', m.orientation, m.southExposure ?? 1)
    expect(protegido).toBeGreaterThan(calculateSurfScore(1.2, 20, 10, 'S', beach('campeche').orientation))
  })

  it('noroeste é terral na costa leste, como dizem os guias', () => {
    for (const id of ['campeche', 'novo-campeche', 'joaquina', 'mole', 'mocambique', 'santinho', 'lagoinha-leste']) {
      expect(explainSurfScore(1.0, 8, 9, 'NW', beach(id).orientation).windQuality).toBe('offshore')
    }
  })

  it('norte não vem mais do mar na Mole, Moçambique e Santinho', () => {
    for (const id of ['mole', 'mocambique', 'santinho']) {
      expect(explainSurfScore(1.0, 8, 9, 'N', beach(id).orientation).windQuality).not.toBe('onshore')
    }
  })
})

describe('applyDirectionalExposure', () => {
  it('swell alinhado com a praia não reduz a altura', () => {
    // Praia orientação 90° (leste), swell vindo de E (90°) — bate de frente
    const result = applyDirectionalExposure(1.0, 'E', 90)
    expect(result).toBe(1.0)
  })

  it('swell perpendicular à praia reduz bastante a altura', () => {
    // Praia orientação 90° (leste), swell vindo de N (0°) — bate de lado
    const result = applyDirectionalExposure(1.0, 'N', 90)
    expect(result).toBeLessThan(1.0)
  })

  it('nunca reduz abaixo do piso de 30%', () => {
    // Swell vindo de trás da praia (180° de diferença) — pior caso possível
    const result = applyDirectionalExposure(1.0, 'W', 90)
    expect(result).toBeGreaterThanOrEqual(0.3)
  })

  it('quanto maior o desalinhamento, maior a redução', () => {
    const aligned  = applyDirectionalExposure(1.0, 'E', 90)
    const oblique  = applyDirectionalExposure(1.0, 'SE', 90)
    const sideways = applyDirectionalExposure(1.0, 'N', 90)
    expect(aligned).toBeGreaterThan(oblique)
    expect(oblique).toBeGreaterThan(sideways)
  })

  it('direção de swell desconhecida retorna a altura original', () => {
    const result = applyDirectionalExposure(1.0, 'DESCONHECIDO', 90)
    expect(result).toBe(1.0)
  })
})
