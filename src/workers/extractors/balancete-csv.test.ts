// Teste de ACEITAÇÃO com o balancete REAL exportado pela contadora
// (MATERIAIS MDW LTDA, 2025). Os números têm que bater ao centavo com o que
// o documento declara — é a garantia de zero erro de cálculo nos charts.
import { describe, expect, it } from 'vitest'
import fixtureUrl from '../../../docs/fixtures/balancete-mdw-2025.csv?url'
import {
  extractBalanceteCsv,
  splitClassificacao,
  parsePeriodo,
} from './balancete-csv'
import { classifyCategoryByCode, classifyKindByCode } from './classify'
import { detectKind } from './detect'
import { summarizeDre } from './dre-summary'
import { decodeSmart } from './encoding'

async function loadFixture() {
  const res = await fetch(fixtureUrl)
  const buf = await res.arrayBuffer()
  return decodeSmart(buf)
}

describe('balancete real (MATERIAIS MDW LTDA, 2025)', () => {
  it('detecta CP1252 e decodifica acentos', async () => {
    const { text, encoding } = await loadFixture()
    expect(encoding).toBe('windows-1252')
    expect(text).toContain('Classificação')
    expect(text).toContain('Período: 01/01/2025 a 31/12/2025')
  })

  it('detecta o tipo balancete-csv pelo conteúdo', async () => {
    const { text } = await loadFixture()
    expect(
      detectKind({
        fileName: 'balancete-mdw-2025.csv',
        head: text.slice(0, 4096),
      })
    ).toBe('balancete-csv')
  })

  it('extrai metadados do cabeçalho', async () => {
    const { text } = await loadFixture()
    const { meta } = extractBalanceteCsv(text)
    expect(meta.company).toBe('MATERIAIS MDW LTDA')
    expect(meta.cnpj).toBe('48.386.085/0001-14')
    expect(meta.periodStart).toBe('2025-01-01')
    expect(meta.periodEnd).toBe('2025-12-31')
    // (232.696,03) credor no documento = LUCRO de 232.696,03
    expect(meta.declaredResult).toBe('232696.03')
  })

  it('separa sintéticas (S) de analíticas e extrai valores', async () => {
    const { text } = await loadFixture()
    const { rows } = extractBalanceteCsv(text)

    const ativo = rows.find((r) => r.account_code === '1')
    expect(ativo?.synthetic).toBe(true)
    expect(ativo?.saldo).toBe('1756202.63')

    const sicredi = rows.find((r) => r.account_code === '1.1.01.002.001')
    expect(sicredi?.synthetic).toBe(false)
    expect(sicredi?.account_name).toBe('Banco Sicredi')
    expect(sicredi?.level).toBe(5)
    expect(sicredi?.saldo).toBe('223282.26')
    // saldo = anterior + débito − crédito (conta devedora)
    expect(sicredi?.saldo_ant).toBe('109985.54')
    expect(sicredi?.debit).toBe('1582977.14')
    expect(sicredi?.credit).toBe('1469680.42')
  })

  it('RECONCILIA: toda sintética bate com a soma dos filhos (ao centavo)', async () => {
    const { text } = await loadFixture()
    const { checks } = extractBalanceteCsv(text)
    expect(checks.length).toBeGreaterThan(20)
    const broken = checks.filter((c) => !c.ok)
    expect(broken).toEqual([])
  })

  it('fecha a DRE com os números do documento (zero erro de cálculo)', async () => {
    const { text } = await loadFixture()
    const { rows, meta } = extractBalanceteCsv(text)
    const dre = summarizeDre(rows, meta)

    // Receita = vendas (1.046.954,21) + outras receitas (26.142,40)
    expect(dre.receita_bruta).toBe(1073096.61)
    expect(dre.deducoes).toBe(56658.69)
    // Despesas = CMV (683.880,78) + operacionais (99.861,11)
    expect(dre.despesas).toBe(783741.89)
    // Resultado calculado == declarado no documento
    expect(dre.resultado).toBe(232696.03)
    expect(dre.declarado).toBe(232696.03)
    expect(dre.conciliado).toBe(true)
  })

  it('classifica por código: balanço fora da DRE, grupos certos', async () => {
    expect(classifyKindByCode('1.1.01.002.001', 'Banco Sicredi')).toBe('other')
    expect(classifyKindByCode('2.1.03.001.029', 'Fornecedor X')).toBe('other')
    expect(classifyKindByCode('3.1.01.003.001.007', 'Vendas de cadernos')).toBe(
      'revenue'
    )
    expect(classifyKindByCode('3.1.03.005.002', '(-) ICMS')).toBe('deduction')
    expect(
      classifyKindByCode('3.2.03.001.015', 'Custo Mercadoria Vendida')
    ).toBe('expense')
    expect(classifyKindByCode('3.7.03.001.001', 'Salários')).toBe('expense')
    expect(classifyKindByCode('3', 'RESULTADO DO PERÍODO')).toBe('other')

    expect(classifyCategoryByCode('3.2.03.001.015', null)).toBe(
      'Custo das mercadorias'
    )
    expect(classifyCategoryByCode('3.7.03.001.008', 'FGTS')).toBe('Pessoal')
    expect(classifyCategoryByCode('3.7.09.001.003', null)).toBe('Tributárias')
    expect(classifyCategoryByCode('3.7.11.001.002', null)).toBe('Financeiras')
    expect(classifyCategoryByCode('3.7.03.015.007', null)).toBe(
      'Despesas gerais'
    )
  })
})

describe('helpers puros', () => {
  it('splitClassificacao', () => {
    expect(splitClassificacao('1.1.01.002.001   Banco Sicredi')).toEqual({
      code: '1.1.01.002.001',
      name: 'Banco Sicredi',
      level: 5,
    })
    expect(splitClassificacao('não é conta')).toBeNull()
  })

  it('parsePeriodo', () => {
    expect(parsePeriodo('Período: 01/01/2025 a 31/12/2025')).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    })
  })
})
