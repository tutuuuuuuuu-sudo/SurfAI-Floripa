import { describe, it, expect } from 'vitest'
import { cleanChatReply } from './_chatText'

describe('cleanChatReply', () => {
  it('tira negrito do nome da praia', () => {
    expect(cleanChatReply('O **Campeche** tá bom hoje')).toBe('O Campeche tá bom hoje')
  })
  it('troca travessão por vírgula', () => {
    expect(cleanChatReply('Joaquina tá boa — vento fraco de manhã')).toBe('Joaquina tá boa, vento fraco de manhã')
    expect(cleanChatReply('Mole – 1m')).toBe('Mole, 1m')
  })
  it('tira marcador de lista e título mas mantém as quebras de linha', () => {
    expect(cleanChatReply('# Resumo\n* Campeche 1m\n* Joaquina 1.2m')).toBe('Resumo\nCampeche 1m\nJoaquina 1.2m')
  })
  it('não estraga hífen normal nem faixa de altura', () => {
    expect(cleanChatReply('onda de 0.9-1.3m no pico-da-cruz')).toBe('onda de 0.9-1.3m no pico-da-cruz')
  })
  it('não deixa vírgula antes de ponto final', () => {
    expect(cleanChatReply('Bora cedo —.')).toBe('Bora cedo.')
  })
})
