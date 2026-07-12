// Teste de ACEITAÇÃO com a DRE REAL em PDF (CENTRO DE EDUCACAO MDW LTDA,
// 2024). O lucro calculado das folhas tem que bater ao centavo com o
// "(=) LUCRO LIQUIDO DO EXERCICIO" declarado no documento.
import { describe, expect, it } from 'vitest'
import fixtureUrl from '../../../docs/fixtures/dre-educacao-2024.pdf?url'
import { classifyPdfRow, extractDreFromItems } from './dre-pdf'
import { loadPdfItems } from './pdf-loader'
import { detectKind } from './detect'

async function loadFixture() {
  const res = await fetch(fixtureUrl)
  const buf = await res.arrayBuffer()
  return loadPdfItems(buf)
}

describe('DRE real em PDF (CENTRO DE EDUCACAO MDW LTDA, 2024)', () => {
  it('detecta o tipo dre-pdf', () => {
    expect(
      detectKind({ fileName: 'dre-educacao-2024.pdf', head: '%PDF-1.7' })
    ).toBe('dre-pdf')
  })

  it('extrai metadados do cabeçalho', async () => {
    const pages = await loadFixture()
    const { meta } = extractDreFromItems(pages)
    expect(meta.company).toContain('CENTRO DE EDUCACAO MDW LTDA')
    expect(meta.cnpj).toBe('47.078.185/0001-10')
    expect(meta.periodStart).toBe('2024-01-01')
    expect(meta.periodEnd).toBe('2024-12-31')
    expect(meta.declaredResult).toBe('1346640.06')
  })

  it('extrai linhas com hierarquia por indentação', async () => {
    const pages = await loadFixture()
    const { rows } = extractDreFromItems(pages)
    expect(rows.length).toBeGreaterThan(50)

    // pdfjs fragmenta palavras — compara sem espaços
    const flat = (s: string | null) => (s ?? '').toUpperCase().replace(/\s+/g, '')
    const receita = rows.find((r) =>
      /RECEITAOPERACIONALBRUTA/.test(flat(r.account_name))
    )
    expect(receita?.synthetic).toBe(true)
    expect(receita?.saldo).toBe('7537018.64')

    const servicos = rows.find((r) =>
      /Presta.*Servi.*Prazo/i.test(r.account_name ?? '')
    )
    expect(servicos?.synthetic).toBe(false)
    expect(servicos?.saldo).toBe('7493822.78')

    // negativo em parênteses vira valor negativo
    const iss = rows.find((r) => /\(-\) ISS/i.test(r.account_name ?? ''))
    expect(iss?.saldo).toBe('-374685.84')
  })

  it('fecha o LUCRO com as folhas (zero erro de cálculo)', async () => {
    const pages = await loadFixture()
    const { rows, meta } = extractDreFromItems(pages)

    let receita = 0
    let deducoes = 0
    let despesas = 0
    for (const r of rows) {
      const { kind } = classifyPdfRow(r)
      const v = Math.abs(Number(r.saldo ?? 0))
      if (kind === 'revenue') receita += v
      else if (kind === 'deduction') deducoes += v
      else if (kind === 'expense') despesas += v
    }
    const round2 = (n: number) => Math.round(n * 100) / 100

    // Receitas: operacional bruta 7.537.018,64 + não operacional 10.000,00
    expect(round2(receita)).toBe(7547018.64)
    expect(round2(deducoes)).toBe(1439538.32)

    const resultado = round2(receita - deducoes - despesas)
    expect(resultado).toBe(Number(meta.declaredResult))
  })

  it('categoriza despesas pelo grupo do documento', async () => {
    const pages = await loadFixture()
    const { rows } = extractDreFromItems(pages)

    const porCategoria = new Map<string, number>()
    for (const r of rows) {
      const { kind, category } = classifyPdfRow(r)
      if (kind !== 'expense' || !category) continue
      porCategoria.set(
        category,
        (porCategoria.get(category) ?? 0) + Math.abs(Number(r.saldo ?? 0))
      )
    }
    // grupos reais do documento
    expect(porCategoria.has('Pessoal')).toBe(true)
    expect(porCategoria.has('Financeiras')).toBe(true)
    expect(porCategoria.has('Tributárias')).toBe(true)
    // Financeiras declaradas no doc: 257.381,34
    expect(Math.round(porCategoria.get('Financeiras')! * 100) / 100).toBe(
      257381.34
    )
  })
})
