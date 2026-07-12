// Contrato browser <-> worker de parse (§9.5).
// Multi-empresa: cada ABA da planilha é tratada como uma empresa (entity),
// a menos que a coluna `entity` seja mapeada explicitamente.

export type ColumnMapping = {
  // campo destino -> header de origem (todos opcionais exceto os validados no save_mapping)
  account_code: string
  account_name?: string
  period: string
  opening_balance?: string
  debit?: string
  credit?: string
  closing_balance?: string
  /** valor único (sem débito/crédito): vira débito p/ despesa e crédito p/ receita */
  amount?: string
  /** empresa por coluna (senão, o nome da aba é usado) */
  entity?: string
  /** grupo de despesa (Pessoal/Admin, Departamentais, Financeiras…) */
  category?: string
  /** natureza da linha: receita | dedução | despesa (senão, heurística determinística) */
  kind?: string
}

export type NormalizedRow = {
  row_number: number
  original: Record<string, unknown>
  normalized: Record<string, unknown>
  account_code: string | null
  account_name: string | null
  period: string | null // ISO yyyy-mm-dd
  opening_balance: string | null
  debit: string | null
  credit: string | null
  closing_balance: string | null
  entity_code: string | null
  entity_name: string | null
  category: string | null
  kind: 'revenue' | 'deduction' | 'expense' | 'other' | null
  status: 'ok' | 'coerced' | 'invalid' | 'duplicate'
  message: string
}

export type RowError = {
  rowIndex: number
  column?: string
  code: string
  raw: unknown
  message: string
}

export type SheetInfo = { name: string; rows: number }

/** Documento contábil reconhecido automaticamente (preset — sem mapping). */
export type DetectedDocument = {
  kind: 'balancete-csv' | 'dre-pdf'
  company: string | null
  cnpj: string | null
  periodStart: string | null
  periodEnd: string | null
  /** Resultado/lucro declarado no documento (string decimal). */
  declaredResult: string | null
  totalRows: number
  analyticRows: number
  /** true = resultado calculado bate com o declarado E totalizadores conferem */
  conciliado: boolean
  resultadoCalculado: string
  warnings: string[]
}

export type ParseWorkerRequest =
  | { type: 'PREVIEW'; fileId: string; file: File; limit: number }
  | {
      type: 'PARSE_FILE'
      fileId: string
      file: File
      mapping: ColumnMapping
      batchSize: number
      /** competência assumida quando não há coluna de data mapeada (ISO) */
      defaultPeriod?: string
    }
  | { type: 'CANCEL'; fileId: string }

export type ParseWorkerResponse =
  | {
      type: 'PREVIEW_ROWS'
      fileId: string
      headers: string[]
      rows: unknown[][]
      sheets: SheetInfo[]
      /** presente quando o documento foi reconhecido (balancete/DRE) */
      detected?: DetectedDocument
    }
  | {
      type: 'BATCH'
      fileId: string
      batchSeq: number
      rows: NormalizedRow[]
      rowErrors: RowError[]
    }
  | { type: 'PROGRESS'; fileId: string; parsedRows: number }
  | { type: 'DONE'; fileId: string; totalRows: number; totalErrors: number }
  | {
      type: 'FATAL'
      fileId: string
      code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FORMAT' | 'ENCRYPTED' | 'PARSE_ERROR'
      message: string
    }
