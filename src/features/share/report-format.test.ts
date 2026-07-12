// Formatação do relatório público (deck + PDF, uma fonte só).
import { describe, expect, it } from 'vitest'
import { fmtMoney, fmtPeriod, humanizeKey } from './report-format'

describe('fmtPeriod', () => {
  it('dd/mm/aaaa a dd/mm/aaaa', () => {
    expect(fmtPeriod('2025-01-01', '2025-12-31')).toBe('01/01/2025 a 31/12/2025')
  })
  it('nulls viram vazio', () => {
    expect(fmtPeriod(null, '2025-12-31')).toBe('')
    expect(fmtPeriod('2025-01-01', null)).toBe('')
  })
})

describe('humanizeKey', () => {
  it('chave conhecida ganha rótulo', () => {
    expect(humanizeKey('saldo_anterior')).toBe('Saldo anterior')
  })
  it('snake_case cru vira frase capitalizada', () => {
    expect(humanizeKey('total_geral_do_mes')).toBe('Total geral do mes')
  })
})

describe('fmtMoney', () => {
  it('número vira BRL', () => {
    expect(fmtMoney(1234.5)).toContain('1.234,50')
  })
  it('não-número → null', () => {
    expect(fmtMoney('abc')).toBeNull()
    expect(fmtMoney(undefined)).toBeNull()
  })
})
