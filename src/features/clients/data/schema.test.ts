import { describe, expect, it } from 'vitest'
import { isValidCpfCnpj } from './schema'

describe('isValidCpfCnpj (RF-008)', () => {
  it('aceita CPF válido (com e sem máscara)', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true)
    expect(isValidCpfCnpj('52998224725')).toBe(true)
  })
  it('rejeita CPF com dígito errado e repetidos', () => {
    expect(isValidCpfCnpj('529.982.247-24')).toBe(false)
    expect(isValidCpfCnpj('111.111.111-11')).toBe(false)
  })
  it('aceita CNPJ válido', () => {
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true)
  })
  it('rejeita CNPJ inválido e tamanhos errados', () => {
    expect(isValidCpfCnpj('11.222.333/0001-80')).toBe(false)
    expect(isValidCpfCnpj('123')).toBe(false)
  })
})
