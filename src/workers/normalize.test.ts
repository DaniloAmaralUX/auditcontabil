import { describe, expect, it } from 'vitest'
import { normalizeRow, parseDateBR, parseDecimal } from './normalize'
import { type ColumnMapping } from './parse-protocol'

const mapping: ColumnMapping = {
  account_code: 'Conta',
  period: 'Data',
  debit: 'Débito',
  credit: 'Crédito',
}

describe('parseDecimal', () => {
  it('converte formato brasileiro "1.234,56"', () => {
    expect(parseDecimal('1.234,56')).toEqual({
      value: '1234.56',
      coerced: true,
    })
  })
  it('aceita número limpo sem coerção', () => {
    expect(parseDecimal('1234.56')).toEqual({
      value: '1234.56',
      coerced: false,
    })
    expect(parseDecimal(1234.56)).toEqual({ value: '1234.56', coerced: false })
  })
  it('trata negativo entre parênteses', () => {
    expect(parseDecimal('(500,00)').value).toBe('-500.00')
  })
  it('devolve null para lixo', () => {
    expect(parseDecimal('abc').value).toBeNull()
  })
})

describe('parseDateBR', () => {
  it('aceita dd/mm/yyyy', () => {
    expect(parseDateBR('05/06/2026').value).toBe('2026-06-05')
  })
  it('aceita ISO', () => {
    expect(parseDateBR('2026-06-05').value).toBe('2026-06-05')
  })
  it('mm/yyyy vira dia 1 (coagido)', () => {
    expect(parseDateBR('06/2026')).toEqual({
      value: '2026-06-01',
      coerced: true,
    })
  })
  it('devolve null para lixo', () => {
    expect(parseDateBR('ontem').value).toBeNull()
  })
})

describe('normalizeRow — nenhuma linha é descartada', () => {
  it('linha válida vira status ok', () => {
    const { row, errors } = normalizeRow(
      1,
      { Conta: '1.1.01', Data: '05/06/2026', Débito: '100.00', Crédito: '' },
      mapping
    )
    expect(row.status).toBe('ok')
    expect(row.account_code).toBe('1.1.01')
    expect(errors).toHaveLength(0)
  })

  it('valor pt-BR gera coerced com mensagem', () => {
    const { row } = normalizeRow(
      2,
      { Conta: '1.1.01', Data: '05/06/2026', Débito: '1.234,56', Crédito: '' },
      mapping
    )
    expect(row.status).toBe('coerced')
    expect(row.debit).toBe('1234.56')
    expect(row.message.length).toBeGreaterThan(0)
  })

  it('linha inválida é PRESERVADA com status invalid + RowError', () => {
    const { row, errors } = normalizeRow(
      3,
      { Conta: '', Data: 'data-quebrada', Débito: 'xx', Crédito: '' },
      mapping
    )
    expect(row.status).toBe('invalid')
    expect(row.message).toContain('conta')
    expect(errors.length).toBeGreaterThan(0)
    // a linha permanece no lote (o chamador a envia mesmo assim)
    expect(row.row_number).toBe(3)
    expect(row.original).toEqual({
      Conta: '',
      Data: 'data-quebrada',
      Débito: 'xx',
      Crédito: '',
    })
  })
})
