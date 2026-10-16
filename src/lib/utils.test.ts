// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { lsGet, lsSet, lsRemove, lsGetJson, lsSetJson } from './utils'

// jsdom provê localStorage — cada teste começa limpo
beforeEach(() => localStorage.clear())

describe('lsGet / lsSet / lsRemove', () => {
  it('set e get retornam o mesmo valor', () => {
    lsSet('key', 'hello')
    expect(lsGet('key')).toBe('hello')
  })

  it('get de chave inexistente retorna null', () => {
    expect(lsGet('nao-existe')).toBeNull()
  })

  it('remove apaga a chave', () => {
    lsSet('key', 'value')
    lsRemove('key')
    expect(lsGet('key')).toBeNull()
  })
})

describe('lsGetJson / lsSetJson', () => {
  it('serializa e deserializa objetos corretamente', () => {
    const obj = { score: 8.5, name: 'Mole' }
    lsSetJson('spot', obj)
    expect(lsGetJson('spot', null)).toEqual(obj)
  })

  it('retorna fallback para chave inexistente', () => {
    expect(lsGetJson('nao-existe', { default: true })).toEqual({ default: true })
  })

  it('retorna fallback para JSON inválido', () => {
    localStorage.setItem('broken', '{invalid json')
    expect(lsGetJson('broken', 42)).toBe(42)
  })

  it('serializa arrays', () => {
    lsSetJson('ids', ['campeche', 'mole'])
    expect(lsGetJson<string[]>('ids', [])).toEqual(['campeche', 'mole'])
  })

  it('serializa booleanos', () => {
    lsSetJson('flag', false)
    expect(lsGetJson('flag', true)).toBe(false)
  })
})
