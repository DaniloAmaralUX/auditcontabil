// Contrato browser <-> worker de parse (§9.5).

export type ColumnMapping = {
  // campo destino -> header de origem
  account_code: string
  account_name?: string
  period: string
  opening_balance?: string
  debit?: string
  credit?: string
  closing_balance?: string
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

export type ParseWorkerRequest =
  | { type: 'PREVIEW'; fileId: string; file: File; limit: number }
  | {
      type: 'PARSE_FILE'
      fileId: string
      file: File
      mapping: ColumnMapping
      batchSize: number
    }
  | { type: 'CANCEL'; fileId: string }

export type ParseWorkerResponse =
  | { type: 'PREVIEW_ROWS'; fileId: string; headers: string[]; rows: unknown[][] }
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
