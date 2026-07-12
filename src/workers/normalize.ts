// Funções puras de normalização (testáveis sem worker).
// Princípio: NENHUMA linha é descartada — falha vira status 'invalid' + message.
import {
  type ColumnMapping,
  type NormalizedRow,
  type RowError,
} from './parse-protocol'

/** "1.234,56" | "1,234.56" | "1234.56" | 1234.56 -> "1234.56" (string p/ numeric SQL) */
export function parseDecimal(raw: unknown): {
  value: string | null
  coerced: boolean
} {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, coerced: false }
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { value: null, coerced: false }
    return { value: raw.toFixed(2), coerced: false }
  }
  const s = String(raw).trim().replace(/\s/g, '').replace('R$', '')
  if (s === '') return { value: null, coerced: false }

  const negative = /^\(.*\)$/.test(s) || s.startsWith('-')
  const digits = s.replace(/[()−-]/g, '')

  let normalized: string
  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')
  if (lastComma > lastDot) {
    // vírgula decimal (pt-BR): remove pontos de milhar, troca vírgula
    normalized = digits.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // ponto decimal (en): remove vírgulas de milhar
    normalized = digits.replace(/,/g, '')
  } else {
    normalized = digits
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return { value: null, coerced: false }
  const wasClean = /^-?\d+(\.\d+)?$/.test(String(raw).trim())
  return { value: (negative ? -n : n).toFixed(2), coerced: !wasClean }
}

/** dd/mm/yyyy | yyyy-mm-dd | mm/yyyy | serial Excel -> ISO yyyy-mm-dd */
export function parseDateBR(raw: unknown): {
  value: string | null
  coerced: boolean
} {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, coerced: false }
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return { value: raw.toISOString().slice(0, 10), coerced: false }
  }
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    // serial Excel (dias desde 1899-12-30)
    const ms = Math.round((raw - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!isNaN(d.getTime()))
      return { value: d.toISOString().slice(0, 10), coerced: true }
  }
  const s = String(raw).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return { value: `${m[1]}-${m[2]}-${m[3]}`, coerced: false }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return {
      value: `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`,
      coerced: false,
    }
  }
  m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, mo, y] = m
    return { value: `${y}-${mo.padStart(2, '0')}-01`, coerced: true }
  }
  return { value: null, coerced: false }
}

export function normalizeRow(
  rowNumber: number,
  original: Record<string, unknown>,
  mapping: ColumnMapping
): { row: NormalizedRow; errors: RowError[] } {
  const errors: RowError[] = []
  const messages: string[] = []
  let coercedAny = false
  let invalid = false

  const get = (header?: string) =>
    header ? original[header] : undefined

  const accountRaw = get(mapping.account_code)
  const account_code =
    accountRaw === null || accountRaw === undefined || accountRaw === ''
      ? null
      : String(accountRaw).trim()
  if (!account_code) {
    invalid = true
    messages.push('Código da conta ausente.')
    errors.push({
      rowIndex: rowNumber,
      column: mapping.account_code,
      code: 'MISSING_ACCOUNT',
      raw: accountRaw,
      message: 'Código da conta ausente.',
    })
  }

  const periodRes = parseDateBR(get(mapping.period))
  if (!periodRes.value) {
    invalid = true
    messages.push('Data em formato não reconhecido.')
    errors.push({
      rowIndex: rowNumber,
      column: mapping.period,
      code: 'BAD_DATE',
      raw: get(mapping.period),
      message: 'Data em formato não reconhecido.',
    })
  } else if (periodRes.coerced) {
    coercedAny = true
    messages.push('Data interpretada automaticamente.')
  }

  const numField = (
    field: 'opening_balance' | 'debit' | 'credit' | 'closing_balance'
  ) => {
    const header = mapping[field]
    if (!header) return null
    const raw = get(header)
    const res = parseDecimal(raw)
    if (raw !== null && raw !== undefined && raw !== '' && res.value === null) {
      invalid = true
      messages.push(`Valor não numérico em ${header}.`)
      errors.push({
        rowIndex: rowNumber,
        column: header,
        code: 'BAD_NUMBER',
        raw,
        message: `Valor não numérico em ${header}.`,
      })
    } else if (res.coerced) {
      coercedAny = true
      messages.push(`Valor de ${header} convertido do formato brasileiro.`)
    }
    return res.value
  }

  const opening_balance = numField('opening_balance')
  const debit = numField('debit')
  const credit = numField('credit')
  const closing_balance = numField('closing_balance')

  const account_name = mapping.account_name
    ? String(get(mapping.account_name) ?? '').trim() || null
    : null

  const status: NormalizedRow['status'] = invalid
    ? 'invalid'
    : coercedAny
      ? 'coerced'
      : 'ok'

  return {
    row: {
      row_number: rowNumber,
      original,
      normalized: {
        account_code,
        account_name,
        period: periodRes.value,
        opening_balance,
        debit,
        credit,
        closing_balance,
      },
      account_code,
      account_name,
      period: periodRes.value,
      opening_balance,
      debit,
      credit,
      closing_balance,
      status,
      message: messages.join(' '),
    },
    errors,
  }
}
