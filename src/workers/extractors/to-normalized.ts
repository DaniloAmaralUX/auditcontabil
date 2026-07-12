// Converte o resultado da extração (balancete CSV / DRE PDF) para o formato
// NormalizedRow do pipeline existente — com a convenção que mantém o SQL de
// analytics correto SEM mudanças na agregação:
//   receita/dedução → credit = |saldo| · despesa → debit = |saldo|
//   sintéticas/balanço → kind 'other' (preservadas, fora dos cálculos)
// Os valores originais (saldo anterior, débito, crédito do período) ficam
// íntegros em `original` para a trilha de auditoria.
import { type NormalizedRow } from '../parse-protocol'
import { classifyCategoryByCode, classifyKindByCode } from './classify'
import { classifyPdfRow } from './dre-pdf'
import { summarizeDre } from './dre-summary'
import { type ExtractResult } from './types'

const absStr = (v: string | null) =>
  v === null ? null : Math.abs(Number(v)).toFixed(2)

export function extractedToNormalized(result: ExtractResult): NormalizedRow[] {
  const { meta, rows, checks } = result
  const period = meta.periodEnd
  const entity_code = meta.cnpj ?? meta.company
  const entity_name = meta.company ?? meta.cnpj

  const out: NormalizedRow[] = rows.map((r, i) => {
    const { kind, category } =
      meta.kind === 'dre-pdf'
        ? classifyPdfRow(r)
        : r.synthetic
          ? { kind: 'other' as const, category: null }
          : {
              kind: classifyKindByCode(r.account_code, r.account_name),
              category: null as string | null,
            }
    const finalCategory =
      kind === 'expense'
        ? (category ?? classifyCategoryByCode(r.account_code, r.account_name))
        : null

    const value = absStr(r.saldo)
    const credit = kind === 'revenue' || kind === 'deduction' ? value : null
    const debit = kind === 'expense' ? value : null

    return {
      row_number: i + 1,
      original: {
        ...r.raw,
        saldo_anterior: r.saldo_ant,
        debito_periodo: r.debit,
        credito_periodo: r.credit,
        saldo: r.saldo,
        sintetica: r.synthetic,
      },
      normalized: {
        // 'origem' marca linha de documento EXTRAÍDO: debit/credit carregam a
        // convenção de agregação (|saldo| na natureza), não movimentos — as
        // regras R001/R002 pulam essas linhas (a conferência é o selo abaixo).
        origem: meta.kind,
        account_code: r.account_code,
        account_name: r.account_name,
        kind,
        category: finalCategory,
        valor: value,
      },
      account_code: r.account_code,
      account_name: r.account_name,
      period,
      opening_balance: r.saldo_ant,
      debit,
      credit,
      closing_balance: r.saldo,
      entity_code,
      entity_name,
      category: finalCategory,
      kind,
      status: 'ok',
      message: r.synthetic
        ? 'Conta sintética (totalizadora) — conferida e fora dos cálculos.'
        : '',
    }
  })

  // Marcador de reconciliação: a prova de que os números conferem (ou não)
  // fica registrada na trilha da auditoria como uma linha do arquivo.
  const dre = summarizeDre(rows, meta)
  const broken = checks.filter((c) => !c.ok)
  const ok = dre.conciliado && broken.length === 0
  out.push({
    row_number: out.length + 1,
    original: { checks_total: checks.length, checks_quebrados: broken.length },
    normalized: {
      origem: meta.kind,
      resultado_calculado: dre.resultado.toFixed(2),
      resultado_declarado: dre.declarado?.toFixed(2) ?? null,
    },
    account_code: null,
    account_name: 'Conferência com o documento',
    period,
    opening_balance: null,
    debit: null,
    credit: null,
    closing_balance: null,
    entity_code,
    entity_name,
    category: null,
    kind: 'other',
    status: ok ? 'ok' : 'invalid',
    message: ok
      ? `Números conferidos com o documento: resultado ${fmt(dre.resultado)} confere com o declarado${checks.length ? ` e ${checks.length} totalizadores batem ao centavo` : ''}.`
      : `DIVERGÊNCIA na conferência: calculado ${fmt(dre.resultado)} × declarado ${dre.declarado === null ? '—' : fmt(dre.declarado)}${broken.length ? `; ${broken.length} totalizador(es) não batem` : ''}.`,
  })

  return out
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
