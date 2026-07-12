// Worker de parse: XLSX (SheetJS) e CSV (Papaparse streaming). Nunca trava a UI.
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { normalizeRow } from './normalize'
import {
  type NormalizedRow,
  type ParseWorkerRequest,
  type ParseWorkerResponse,
  type RowError,
} from './parse-protocol'

const MAX_BYTES = 20 * 1024 * 1024
const cancelled = new Set<string>()

function post(msg: ParseWorkerResponse) {
  self.postMessage(msg)
}

function isCsv(file: File) {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

async function readSheetRows(
  file: File
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', dense: true, cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  })
  const headers =
    rows.length > 0
      ? Object.keys(rows[0])
      : (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] as
          | string[]
          | undefined) ?? []
  return { headers, rows }
}

function readCsvRows(
  file: File
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, unknown>[] = []
    let headers: string[] = []
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      chunk: (result) => {
        if (result.meta.fields && headers.length === 0)
          headers = result.meta.fields
        rows.push(...result.data)
      },
      complete: () => resolve({ headers, rows }),
      error: (err) => reject(err),
    })
  })
}

async function handlePreview(fileId: string, file: File, limit: number) {
  try {
    const { headers, rows } = isCsv(file)
      ? await readCsvRows(file)
      : await readSheetRows(file)
    post({
      type: 'PREVIEW_ROWS',
      fileId,
      headers,
      rows: rows.slice(0, limit).map((r) => headers.map((h) => r[h])),
    })
  } catch (e) {
    post({
      type: 'FATAL',
      fileId,
      code: 'PARSE_ERROR',
      message: String(e),
    })
  }
}

async function handleParse(
  req: Extract<ParseWorkerRequest, { type: 'PARSE_FILE' }>
) {
  const { fileId, file, mapping, batchSize } = req
  if (file.size > MAX_BYTES) {
    post({
      type: 'FATAL',
      fileId,
      code: 'FILE_TOO_LARGE',
      message: 'Arquivo acima de 20 MB.',
    })
    return
  }
  try {
    const { rows } = isCsv(file)
      ? await readCsvRows(file)
      : await readSheetRows(file)

    let batch: NormalizedRow[] = []
    let batchErrors: RowError[] = []
    let batchSeq = 0
    let totalErrors = 0
    const seen = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      if (cancelled.has(fileId)) {
        cancelled.delete(fileId)
        return
      }
      const { row, errors } = normalizeRow(i + 1, rows[i], mapping)

      // dedupe simples dentro do arquivo (conta+período+valores)
      if (row.status === 'ok' || row.status === 'coerced') {
        const key = [
          row.account_code,
          row.period,
          row.debit,
          row.credit,
          row.opening_balance,
          row.closing_balance,
        ].join('|')
        if (seen.has(key)) {
          row.status = 'duplicate'
          row.message =
            (row.message ? row.message + ' ' : '') +
            'Linha duplicada dentro do arquivo.'
        } else {
          seen.add(key)
        }
      }

      batch.push(row)
      batchErrors.push(...errors)
      totalErrors += errors.length

      if (batch.length >= batchSize) {
        post({ type: 'BATCH', fileId, batchSeq, rows: batch, rowErrors: batchErrors })
        post({ type: 'PROGRESS', fileId, parsedRows: i + 1 })
        batchSeq++
        batch = []
        batchErrors = []
      }
    }
    if (batch.length > 0) {
      post({ type: 'BATCH', fileId, batchSeq, rows: batch, rowErrors: batchErrors })
    }
    post({ type: 'DONE', fileId, totalRows: rows.length, totalErrors })
  } catch (e) {
    post({ type: 'FATAL', fileId, code: 'PARSE_ERROR', message: String(e) })
  }
}

self.onmessage = (ev: MessageEvent<ParseWorkerRequest>) => {
  const msg = ev.data
  if (msg.type === 'CANCEL') {
    cancelled.add(msg.fileId)
    return
  }
  if (msg.type === 'PREVIEW') void handlePreview(msg.fileId, msg.file, msg.limit)
  if (msg.type === 'PARSE_FILE') void handleParse(msg)
}
