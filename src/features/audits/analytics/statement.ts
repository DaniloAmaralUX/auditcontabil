// DRE como view-model puro (sem React) — consumida pelo deck, pela aba
// interna e pelo PDF. Espelha o padrão de onboarding-logic.ts: derivação
// testável, formatação fica em types.ts (brl/pct — não duplicar).
import { type AnalyticsConsolidado } from './types'

type StatementLine = {
  key:
    | 'receita_bruta'
    | 'deducoes'
    | 'receita_liquida'
    | 'despesas'
    | 'resultado'
  label: string
  value: number
  kind: 'base' | 'subtotal' | 'result'
  sign: '+' | '−' | '='
}

/** Monta as linhas da DRE na ordem contábil (receita → deduções → líquida → despesas → resultado). */
export function buildIncomeStatement(c: AnalyticsConsolidado): StatementLine[] {
  return [
    {
      key: 'receita_bruta',
      label: 'Receita bruta',
      value: c.receita_bruta,
      kind: 'base',
      sign: '+',
    },
    {
      key: 'deducoes',
      label: 'Deduções',
      value: -Math.abs(c.deducoes),
      kind: 'base',
      sign: '−',
    },
    {
      key: 'receita_liquida',
      label: 'Receita líquida',
      value: c.receita_liquida,
      kind: 'subtotal',
      sign: '=',
    },
    {
      key: 'despesas',
      label: 'Despesas',
      value: -Math.abs(c.despesas),
      kind: 'base',
      sign: '−',
    },
    {
      key: 'resultado',
      label: 'Resultado do período',
      value: c.resultado,
      kind: 'result',
      sign: '=',
    },
  ]
}
