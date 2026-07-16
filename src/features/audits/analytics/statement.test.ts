// A DRE do deck — ordem contábil, sinais e valores.
import { describe, expect, it } from 'vitest'
import { buildIncomeStatement } from './statement'
import { type AnalyticsConsolidado } from './types'

const c: AnalyticsConsolidado = {
  receita_bruta: 1_073_096.61,
  deducoes: 56_658.69,
  receita_liquida: 1_016_437.92,
  despesas: 783_741.89,
  resultado: 232_696.03,
  despesa_receita_pct: 77.1,
  margem_pct: 22.9,
}

describe('buildIncomeStatement', () => {
  it('ordem contábil: receita → deduções → líquida → despesas → resultado', () => {
    expect(buildIncomeStatement(c).map((l) => l.key)).toEqual([
      'receita_bruta',
      'deducoes',
      'receita_liquida',
      'despesas',
      'resultado',
    ])
  })

  it('deduções e despesas saem NEGATIVAS (parênteses contábeis na view)', () => {
    const lines = buildIncomeStatement(c)
    expect(lines.find((l) => l.key === 'deducoes')!.value).toBeLessThan(0)
    expect(lines.find((l) => l.key === 'despesas')!.value).toBeLessThan(0)
    expect(lines.find((l) => l.key === 'receita_bruta')!.sign).toBe('+')
  })

  it('receita líquida é subtotal; resultado é result', () => {
    const lines = buildIncomeStatement(c)
    expect(lines.find((l) => l.key === 'receita_liquida')!.kind).toBe(
      'subtotal'
    )
    expect(lines.find((l) => l.key === 'resultado')!.kind).toBe('result')
  })

  it('os valores do balancete real fecham: resultado 232.696,03', () => {
    const result = buildIncomeStatement(c).find((l) => l.key === 'resultado')!
    expect(result.value).toBe(232_696.03)
  })
})
