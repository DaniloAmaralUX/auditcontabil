// Extractor do Balancete Societário em CSV — o formato real exportado pelos
// sistemas contábeis brasileiros (paginado, CP1252, ; como separador, flag S
// para sintéticas, código+nome colados, negativos em parênteses).
//
// Regra de ouro: NADA é descartado silenciosamente e TODA soma é reconciliada
// com os totais que o próprio documento declara (sintéticas).
import Papa from 'papaparse'
import { parseDecimal } from '../normalize'
import {
  type ExtractedRow,
  type ExtractMeta,
  type ExtractResult,
  type ReconciliationCheck,
} from './types'

/** `1.1.01.002.001   Banco Sicredi` → { code, name, level } */
export function splitClassificacao(
  cell: string
): { code: string; name: string; level: number } | null {
  const m = cell.trim().match(/^(\d+(?:\.\d+)*)\s{2,}(.+)$/)
  if (!m) return null
  return {
    code: m[1],
    name: m[2].trim(),
    level: m[1].split('.').length,
  }
}

/** "01/01/2025 a 31/12/2025" → ISO start/end. */
export function parsePeriodo(
  text: string
): { start: string; end: string } | null {
  const m = text.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/
  )
  if (!m) return null
  return {
    start: `${m[3]}-${m[2]}-${m[1]}`,
    end: `${m[6]}-${m[5]}-${m[4]}`,
  }
}

const num = (v: string | null): number => (v === null ? 0 : Number(v))

/**
 * Reconciliação: para cada sintética, a soma dos FILHOS DIRETOS (nível+1,
 * mesmo prefixo) tem que bater com o saldo declarado (±0,01).
 * Só compara pais cujos filhos existem no documento.
 */
function reconcile(rows: ExtractedRow[]): ReconciliationCheck[] {
  const checks: ReconciliationCheck[] = []
  for (const parent of rows) {
    if (!parent.synthetic || !parent.account_code || parent.saldo === null)
      continue
    const prefix = parent.account_code + '.'
    const children = rows.filter(
      (r) =>
        r.account_code?.startsWith(prefix) &&
        r.level === parent.level + 1 &&
        r.saldo !== null
    )
    if (children.length === 0) continue
    const computed = children.reduce((s, c) => s + num(c.saldo), 0)
    const declared = num(parent.saldo)
    checks.push({
      code: parent.account_code,
      name: parent.account_name ?? parent.account_code,
      declared: declared.toFixed(2),
      computed: computed.toFixed(2),
      ok: Math.abs(declared - computed) <= 0.01,
    })
  }
  return checks
}

/**
 * Extrai o Balancete Societário de um texto CSV já decodificado.
 * O texto vem paginado (cabeçalho corporativo repetido a cada página):
 * as linhas de dados são reconhecidas pelo padrão da Classificação, todo o
 * resto (boilerplate, cabeçalhos repetidos, assinaturas) vira warning count.
 */
export function extractBalanceteCsv(text: string): ExtractResult {
  const parsed = Papa.parse<string[]>(text, {
    delimiter: ';',
    skipEmptyLines: 'greedy',
  })

  const meta: ExtractMeta = {
    kind: 'balancete-csv',
    company: null,
    cnpj: null,
    periodStart: null,
    periodEnd: null,
    declaredResult: null,
    title: null,
  }
  const rows: ExtractedRow[] = []
  const warnings: string[] = []
  let skipped = 0

  for (const cells of parsed.data) {
    const joined = cells.join(' ')

    // --- metadados do cabeçalho (aparecem repetidos; captura só a 1ª vez)
    if (!meta.company) {
      // "0089  MATERIAIS MDW LTDA\nCNPJ: 48.386.085/0001-14"
      const mCompany = joined.match(/^\s*(\d{3,6})\s{2,}(.+?)\s*CNPJ:\s*([\d./-]+)/s)
      if (mCompany) {
        meta.company = mCompany[2].replace(/\s+/g, ' ').trim()
        meta.cnpj = mCompany[3]
      }
    }
    if (!meta.periodStart) {
      const p = parsePeriodo(joined)
      if (p) {
        meta.periodStart = p.start
        meta.periodEnd = p.end
      }
    }
    if (!meta.title && /Balancete/i.test(joined)) {
      meta.title = joined.replace(/["\s]+/g, ' ').trim().slice(0, 80)
    }

    // --- linha de dados: alguma célula casa com "código  nome"
    const classIdx = cells.findIndex((c) => splitClassificacao(String(c ?? '')))
    if (classIdx === -1) {
      skipped++
      continue
    }
    const cls = splitClassificacao(String(cells[classIdx]))!

    // célula anterior à classificação é a flag S (sintética) ou vazia
    const flag = String(cells[classIdx - 1] ?? '').trim()
    const synthetic = flag === 'S'

    // após a classificação vêm: Saldo Ant. · (vazia) · Débito · Crédito · Saldo
    const nums = cells
      .slice(classIdx + 1)
      .map((c) => parseDecimal(c).value)
    const [saldo_ant, , debit, credit, saldo] =
      nums.length >= 5 ? nums : [nums[0] ?? null, null, nums[1] ?? null, nums[2] ?? null, nums[3] ?? null]

    rows.push({
      account_code: cls.code,
      account_name: cls.name,
      level: cls.level,
      synthetic,
      saldo_ant,
      debit,
      credit,
      saldo,
      raw: { classificacao: cells[classIdx], flag, valores: cells.slice(classIdx + 1) },
    })

    // resultado declarado: grupo 3 raiz (RESULTADO DO PERÍODO)
    if (cls.code === '3' && saldo !== null) {
      // convenção do exportador: saldo credor sai entre parênteses (negativo).
      // Lucro = |saldo credor| → declaredResult positivo quando há lucro.
      meta.declaredResult = (-Number(saldo)).toFixed(2)
    }
  }

  if (rows.length === 0) {
    warnings.push(
      'Nenhuma linha de conta reconhecida — o arquivo não parece um balancete.'
    )
  }
  if (skipped > 0) {
    warnings.push(
      `${skipped} linhas de cabeçalho/paginação/assinatura ignoradas (preservadas no arquivo original).`
    )
  }

  return { meta, rows, checks: reconcile(rows), warnings }
}
