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
    normalized = digits.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
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

type Kind = 'revenue' | 'deduction' | 'expense' | 'other'

/** Heurística determinística (espelha app.classify_kind do banco). */
function classifyKind(name: string | null): Kind {
  if (!name) return 'expense'
  const l = name.toLowerCase()
  if (/(dedu|imposto sobre|iss|icms|pis|cofins|simples nacional|cancelamento)/.test(l))
    return 'deduction'
  if (/(receita|faturamento|venda|mensalidade|patroc)/.test(l)) return 'revenue'
  if (/(total|subtotal|resultado|soma)/.test(l)) return 'other'
  return 'expense'
}

/** Mapeia rótulos PT do mapeamento para o enum interno. */
function normalizeKindLabel(raw: unknown): Kind | null {
  if (raw === null || raw === undefined || raw === '') return null
  const l = String(raw).toLowerCase().trim()
  if (/(receita|revenue)/.test(l)) return 'revenue'
  if (/(dedu|deduction)/.test(l)) return 'deduction'
  if (/(despesa|custo|expense)/.test(l)) return 'expense'
  if (/(total|outro|other)/.test(l)) return 'other'
  return null
}

export function normalizeRow(
  rowNumber: number,
  original: Record<string, unknown>,
  mapping: ColumnMapping,
  sheetName?: string,
  defaultPeriod?: string
): { row: NormalizedRow; errors: RowError[] } {
  const errors: RowError[] = []
  const messages: string[] = []
  let coercedAny = false
  let invalid = false

  const get = (header?: string) => (header ? original[header] : undefined)

  const accountRaw = get(mapping.account_code)
  const account_code =
    accountRaw === null || accountRaw === undefined || accountRaw === ''
      ? null
      : String(accountRaw).trim()

  const account_name = mapping.account_name
    ? String(get(mapping.account_name) ?? '').trim() || null
    : null

  const periodRes = mapping.period
    ? parseDateBR(get(mapping.period))
    : { value: null, coerced: false }
  if (periodRes.coerced) {
    coercedAny = true
    messages.push('Data interpretada automaticamente.')
  }
  if (!mapping.period && defaultPeriod) {
    periodRes.value = defaultPeriod
    coercedAny = true
    messages.push('Competência assumida do período da auditoria.')
  }

  const numField = (
    field: 'opening_balance' | 'debit' | 'credit' | 'closing_balance' | 'amount'
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
  let debit = numField('debit')
  let credit = numField('credit')
  const closing_balance = numField('closing_balance')
  const amount = numField('amount')

  // natureza da linha: mapeada > heurística por nome (determinística)
  const mappedKind = normalizeKindLabel(get(mapping.kind))
  const kind: Kind = mappedKind ?? classifyKind(account_name ?? account_code)

  // valor único mapeado: vira crédito p/ receita/dedução, débito p/ despesa
  if (amount !== null && debit === null && credit === null) {
    if (kind === 'revenue' || kind === 'deduction') credit = amount
    else debit = amount
    messages.push('Valor único atribuído conforme a natureza da linha.')
    coercedAny = true
  }

  const hasValue =
    debit !== null ||
    credit !== null ||
    opening_balance !== null ||
    closing_balance !== null

  // linha de totalização/section header (sem conta, sem valor e sem erro)
  // é preservada como 'other'; linha com erro nunca vira estrutural
  const isStructural =
    kind === 'other' || (!account_code && !account_name && !hasValue && !invalid)

  if (!isStructural) {
    if (!account_code && !account_name) {
      invalid = true
      messages.push('Código/descrição da conta ausente.')
      errors.push({
        rowIndex: rowNumber,
        column: mapping.account_code,
        code: 'MISSING_ACCOUNT',
        raw: accountRaw,
        message: 'Código/descrição da conta ausente.',
      })
    }
    if (!periodRes.value && mapping.period) {
      invalid = true
      messages.push('Data em formato não reconhecido.')
      errors.push({
        rowIndex: rowNumber,
        column: mapping.period,
        code: 'BAD_DATE',
        raw: get(mapping.period),
        message: 'Data em formato não reconhecido.',
      })
    }
  } else if (!messages.length) {
    messages.push('Linha estrutural (totalização/seção) fora dos cálculos.')
  }

  // empresa: coluna mapeada > nome da aba
  const entityRaw = mapping.entity ? get(mapping.entity) : undefined
  const entityFromCol =
    entityRaw === null || entityRaw === undefined || entityRaw === ''
      ? null
      : String(entityRaw).trim()
  const entity_code = entityFromCol ?? sheetName ?? null
  const entity_name = entityFromCol ?? sheetName ?? null

  const category = mapping.category
    ? String(get(mapping.category) ?? '').trim() || null
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
        entity_code,
        category,
        kind,
      },
      account_code,
      account_name,
      period: periodRes.value,
      opening_balance,
      debit,
      credit,
      closing_balance,
      entity_code,
      entity_name,
      category,
      kind: isStructural ? 'other' : kind,
      status,
      message: messages.join(' '),
    },
    errors,
  }
}
