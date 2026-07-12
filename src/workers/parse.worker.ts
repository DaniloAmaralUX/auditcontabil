// Worker de parse: XLSX (SheetJS) e CSV (Papaparse). Multi-abas: cada aba é
// uma empresa (entity) — todas são percorridas. Nunca trava a UI.
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { normalizeRow } from './normalize'
import {
  type NormalizedRow,
  type ParseWorkerRequest,
  type ParseWorkerResponse,
  type RowError,
  type SheetInfo,
} from './parse-protocol'

const MAX_BYTES = 20 * 1024 * 1024
const cancelled = new Set<string>()

function post(msg: ParseWorkerResponse) {
  self.postMessage(msg)
}

function isCsv(file: File) {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

type Sheet = { name: string; rows: Record<string, unknown>[]; headers: string[] }

async function readXlsxSheets(file: File): Promise<Sheet[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', dense: true, cellDates: true })
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    })
    const headers =
      rows.length > 0
        ? Object.keys(rows[0])
        : ((XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] as
            | string[]
            | undefined) ?? [])
    return { name, rows, headers }
  })
}

function readCsvSheets(file: File): Promise<Sheet[]> {
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
      complete: () =>
        resolve([{ name: file.name.replace(/\.csv$/i, ''), rows, headers }]),
      error: (err) => reject(err),
    })
  })
}

async function readSheets(file: File): Promise<Sheet[]> {
  return isCsv(file) ? readCsvSheets(file) : readXlsxSheets(file)
}

async function handlePreview(fileId: string, file: File, limit: number) {
  try {
    const sheets = await readSheets(file)
    const withData = sheets.filter((s) => s.rows.length > 0)
    const first = withData[0] ?? sheets[0]
    const info: SheetInfo[] = sheets.map((s) => ({
      name: s.name,
      rows: s.rows.length,
    }))
    post({
      type: 'PREVIEW_ROWS',
      fileId,
      headers: first?.headers ?? [],
      rows: (first?.rows ?? [])
        .slice(0, limit)
        .map((r) => (first?.headers ?? []).map((h) => r[h])),
      sheets: info,
    })
  } catch (e) {
    post({ type: 'FATAL', fileId, code: 'PARSE_ERROR', message: String(e) })
  }
}

async function handleParse(
  req: Extract<ParseWorkerRequest, { type: 'PARSE_FILE' }>
) {
  const { fileId, file, mapping, batchSize, defaultPeriod } = req
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
    const sheets = await readSheets(file)

    let batch: NormalizedRow[] = []
    let batchErrors: RowError[] = []
    let batchSeq = 0
    let totalErrors = 0
    let rowNumber = 0
    const seen = new Set<string>()

    const flush = () => {
      if (batch.length === 0) return
      post({ type: 'BATCH', fileId, batchSeq, rows: batch, rowErrors: batchErrors })
      post({ type: 'PROGRESS', fileId, parsedRows: rowNumber })
      batchSeq++
      batch = []
      batchErrors = []
    }

    for (const sheet of sheets) {
      for (let i = 0; i < sheet.rows.length; i++) {
        if (cancelled.has(fileId)) {
          cancelled.delete(fileId)
          return
        }
        rowNumber++
        const { row, errors } = normalizeRow(
          rowNumber,
          sheet.rows[i],
          mapping,
          sheet.name,
          defaultPeriod
        )

        // dedupe dentro do arquivo (empresa+conta+período+valores)
        if (row.status === 'ok' || row.status === 'coerced') {
          const key = [
            row.entity_code,
            row.account_code,
            row.account_name,
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

        if (batch.length >= batchSize) flush()
      }
    }
    flush()
    post({ type: 'DONE', fileId, totalRows: rowNumber, totalErrors })
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
