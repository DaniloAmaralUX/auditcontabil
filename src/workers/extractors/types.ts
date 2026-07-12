// Tipos da camada de extração — documentos contábeis reais viram linhas
// normalizáveis + metadados + reconciliação. Tudo puro e testável.

export type ExtractedKind = 'balancete-csv' | 'dre-pdf'

/** Linha extraída de um documento contábil (antes da classificação). */
export type ExtractedRow = {
  /** Código contábil (1.1.01.002.001) ou null quando o doc não traz código. */
  account_code: string | null
  account_name: string | null
  /** Profundidade hierárquica (1 = grupo raiz). */
  level: number
  /** true = sintética/grupo (soma dos filhos); false = analítica (folha). */
  synthetic: boolean
  /** Valores como string decimal ("1234.56", negativa se credora). */
  saldo_ant: string | null
  debit: string | null
  credit: string | null
  /** Saldo final da linha — o valor principal do documento. */
  saldo: string | null
  /** Célula/linha original para rastreabilidade. */
  raw: Record<string, unknown>
}

/** Metadados extraídos do cabeçalho do documento. */
export type ExtractMeta = {
  kind: ExtractedKind
  company: string | null
  cnpj: string | null
  /** ISO yyyy-mm-dd */
  periodStart: string | null
  periodEnd: string | null
  /**
   * Resultado/lucro DECLARADO pelo documento (positivo = lucro).
   * É a âncora da reconciliação: o que calcularmos tem que bater com ele.
   */
  declaredResult: string | null
  title: string | null
}

/** Checagem sintética×analíticas: o pai declara, os filhos somam. */
export type ReconciliationCheck = {
  code: string
  name: string
  declared: string
  computed: string
  /** |declared - computed| <= 0.01 */
  ok: boolean
}

export type ExtractResult = {
  meta: ExtractMeta
  rows: ExtractedRow[]
  checks: ReconciliationCheck[]
  /** Problemas não-fatais encontrados (linhas ilegíveis etc.). */
  warnings: string[]
}
