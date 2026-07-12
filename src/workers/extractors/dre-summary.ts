// Fecha a conta da DRE a partir das linhas ANALÍTICAS extraídas e reconcilia
// com o resultado declarado pelo próprio documento. Zero erro de cálculo:
// se não bater ao centavo, o chamador transforma em inconsistência visível.
import { classifyKindByCode } from './classify'
import { classifyPdfRow } from './dre-pdf'
import { type ExtractedRow, type ExtractMeta } from './types'

type DreSummary = {
  receita_bruta: number
  deducoes: number
  despesas: number
  resultado: number
  /** Resultado declarado no documento (null quando o doc não declara). */
  declarado: number | null
  /** |resultado - declarado| <= 0.01 (true quando não há declarado). */
  conciliado: boolean
}

const abs = (v: string | null) => Math.abs(Number(v ?? 0))

/**
 * Convenção contábil do balancete: contas de resultado credoras (receitas)
 * saem com saldo negativo/entre parênteses; devedoras (deduções, CMV,
 * despesas) saem positivas. O valor da linha é o MÓDULO do saldo; o kind
 * decide o papel: resultado = receita − deduções − despesas.
 *
 * A classificação depende do TIPO do documento: balancete tem código de
 * conta (classifyKindByCode); a DRE em PDF não tem código — o papel vem da
 * ancestralidade dos grupos (classifyPdfRow). Usar código no PDF cai no
 * fallback por nome e erra a conta inteira.
 */
export function summarizeDre(
  rows: ExtractedRow[],
  meta: Pick<ExtractMeta, 'kind' | 'declaredResult'>
): DreSummary {
  let receita = 0
  let deducoes = 0
  let despesas = 0

  for (const r of rows) {
    if (r.synthetic || r.saldo === null) continue
    const kind =
      meta.kind === 'dre-pdf'
        ? classifyPdfRow(r).kind
        : classifyKindByCode(r.account_code, r.account_name)
    if (kind === 'revenue') receita += abs(r.saldo)
    else if (kind === 'deduction') deducoes += abs(r.saldo)
    else if (kind === 'expense') despesas += abs(r.saldo)
  }

  const resultado = receita - deducoes - despesas
  const declarado =
    meta.declaredResult === null ? null : Number(meta.declaredResult)

  return {
    receita_bruta: round2(receita),
    deducoes: round2(deducoes),
    despesas: round2(despesas),
    resultado: round2(resultado),
    declarado,
    conciliado:
      declarado === null ? true : Math.abs(resultado - declarado) <= 0.01,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
