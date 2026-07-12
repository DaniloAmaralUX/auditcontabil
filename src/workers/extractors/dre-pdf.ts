// Extractor da DRE em PDF — o formato real exportado pelos sistemas
// contábeis (vetorial, hierarquia por INDENTAÇÃO, negativos em parênteses,
// cabeçalho repetido por página, totais declarados por grupo e o LUCRO
// LÍQUIDO no fim). A parte pura recebe itens posicionados {str,x,y} por
// página; o loader pdfjs fica em pdf-loader.ts (só browser/worker).
import { parseDecimal } from '../normalize'
import { classifyCategoryByName } from './classify'
import {
  type ExtractedRow,
  type ExtractMeta,
  type ExtractResult,
  type ReconciliationCheck,
} from './types'

export type PdfItem = { str: string; x: number; y: number }

/** Agrupa itens de uma página em linhas visuais (mesmo Y ± tolerância). */
function groupIntoLines(
  items: PdfItem[],
  tolerance = 2
): { x: number; text: string; parts: PdfItem[] }[] {
  const sorted = [...items]
    .filter((i) => i.str.trim() !== '')
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: { y: number; parts: PdfItem[] }[] = []
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tolerance)
    if (line) line.parts.push(it)
    else lines.push({ y: it.y, parts: [it] })
  }
  return lines.map((l) => {
    const parts = l.parts.sort((a, b) => a.x - b.x)
    return {
      x: parts[0].x,
      text: parts.map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim(),
      parts,
    }
  })
}

/** Linha de boilerplate de página (data/Pág, empresa, CNPJ, título…). */
function isBoilerplate(text: string): boolean {
  return (
    /P[áa�]g:\d+/i.test(text) ||
    /^CNPJ:/i.test(text) ||
    /^Per[íi�]odo:/i.test(text) ||
    /DEMONSTRA/i.test(text) ||
    /Valores expressos/i.test(text) ||
    /^CRC:/i.test(text) ||
    /^CPF:/i.test(text) ||
    /S[óo�]cio administrador/i.test(text) ||
    /^\d{2}\/\d{2}\/\d{4}\s/.test(text)
  )
}

/** Valor monetário da linha: "(1.234,56" [+ ")"] ou "1.234,56". */
function extractValue(text: string): {
  label: string
  value: string | null
} {
  // valor no fim da linha, com parênteses possivelmente separados por espaço
  const m = text.match(/^(.*?)\s*(\(?[\d.]{1,15},\d{2}\s*\)?)\s*$/)
  if (!m) return { label: text, value: null }
  let rawVal = m[2].replace(/\s+/g, '')
  // parêntese de fechamento pode ter ficado noutro token — normaliza
  if (rawVal.startsWith('(') && !rawVal.endsWith(')')) rawVal += ')'
  const { value } = parseDecimal(rawVal)
  if (value === null) return { label: text, value: null }
  return { label: m[1].trim(), value }
}

const num = (v: string | null) => (v === null ? 0 : Number(v))

/**
 * Extrai a DRE de páginas de itens posicionados. Hierarquia pela indentação
 * (X inicial): a pilha de ancestrais persiste ENTRE páginas (grupos abertos
 * continuam na página seguinte).
 */
export function extractDreFromItems(pages: PdfItem[][]): ExtractResult {
  const meta: ExtractMeta = {
    kind: 'dre-pdf',
    company: null,
    cnpj: null,
    periodStart: null,
    periodEnd: null,
    declaredResult: null,
    title: null,
  }
  const warnings: string[] = []

  type Node = {
    label: string
    value: string | null
    x: number
    index: number
    childrenSum: number
    childCount: number
    parent: Node | null
  }
  const flat: Node[] = []
  const stack: Node[] = []

  for (const page of pages) {
    for (const line of groupIntoLines(page)) {
      const { text, x } = line
      if (!text) continue

      // metadados (1ª ocorrência). A linha da empresa pode vir FUNDIDA com o
      // relógio/página ("0086 EMPRESA LTDA 11/04/2025 14:47 Pág:0001") quando
      // os Y quase coincidem — corta no primeiro dd/mm/yyyy.
      if (!meta.company) {
        const mc = text.match(
          /^(\d{3,6})\s+(.+?)(?:\s+\d{2}\/\d{2}\/\d{4}.*)?$/
        )
        if (mc && /[A-ZÀ-Ú]{3}/.test(mc[2])) {
          meta.company = mc[2].trim()
          continue
        }
      }
      if (!meta.cnpj) {
        const mj = text.match(/CNPJ:\s*([\d./-]+)/)
        if (mj) meta.cnpj = mj[1]
      }
      if (!meta.periodStart) {
        const mp = text.match(
          /(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/
        )
        if (mp) {
          meta.periodStart = `${mp[3]}-${mp[2]}-${mp[1]}`
          meta.periodEnd = `${mp[6]}-${mp[5]}-${mp[4]}`
        }
      }
      if (!meta.title && /DEMONSTRA/i.test(text)) {
        meta.title = 'Demonstração do Resultado do Exercício'
      }
      if (isBoilerplate(text)) continue

      const { label, value } = extractValue(text)
      if (!label || label.length < 2) continue

      // total declarado do documento (compara sem espaços — o pdfjs pode
      // fragmentar palavras: "RECEIT A OPERACIONALBRUTA")
      const flatLabel = label.toUpperCase().replace(/\s+/g, '')
      if (/LUCROL[ÍI�]QUIDODOEXERC/.test(flatLabel) && value !== null) {
        meta.declaredResult = Math.abs(Number(value)).toFixed(2)
      }

      // hierarquia por indentação: desempilha até achar o pai (x menor)
      while (stack.length > 0 && x <= stack[stack.length - 1].x + 1) {
        stack.pop()
      }
      const parent = stack[stack.length - 1] ?? null
      const node: Node = {
        label,
        value,
        x,
        index: flat.length,
        childrenSum: 0,
        childCount: 0,
        parent,
      }
      if (parent && value !== null) {
        parent.childCount++
      }
      flat.push(node)
      stack.push(node)
    }
  }

  // sintética = tem filhos com valor; folha = não tem
  const rows: ExtractedRow[] = flat.map((n) => {
    const ancestors: string[] = []
    let p = n.parent
    while (p) {
      ancestors.push(p.label)
      p = p.parent
    }
    return {
      account_code: null,
      account_name: n.label,
      level: ancestors.length + 1,
      synthetic: n.childCount > 0,
      saldo_ant: null,
      debit: null,
      credit: null,
      saldo: n.value,
      raw: { ancestors, x: n.x },
    }
  })

  // reconciliação: pai declarado × soma dos filhos diretos
  const checks: ReconciliationCheck[] = []
  for (const n of flat) {
    if (n.childCount === 0 || n.value === null) continue
    const children = flat.filter((c) => c.parent === n && c.value !== null)
    const computed = children.reduce((s, c) => s + num(c.value), 0)
    const declared = num(n.value)
    checks.push({
      code: `x${Math.round(n.x)}#${n.index}`,
      name: n.label,
      declared: declared.toFixed(2),
      computed: computed.toFixed(2),
      ok: Math.abs(declared - computed) <= 0.01,
    })
  }

  if (rows.length === 0)
    warnings.push('Nenhuma linha reconhecida — o PDF pode ser escaneado (imagem).')

  return { meta, rows, checks, warnings }
}

/** Papel de cada linha da DRE em PDF (sem código: usa a ancestralidade). */
export function classifyPdfRow(row: ExtractedRow): {
  kind: 'revenue' | 'deduction' | 'expense' | 'other'
  category: string | null
} {
  const ancestors = (row.raw.ancestors as string[] | undefined) ?? []
  // compara sem espaços: o pdfjs fragmenta palavras ("RECEIT A ...BRUTA")
  const chain = [row.account_name ?? '', ...ancestors].map((s) =>
    s.toUpperCase().replace(/\s+/g, '')
  )
  const inChain = (re: RegExp) => chain.some((s) => re.test(s))

  // totais/derivadas do próprio documento → fora dos agregados
  if (/^(\(=\)|RESULTADOANTES)/.test(chain[0]))
    return { kind: 'other', category: null }
  if (row.synthetic) return { kind: 'other', category: null }

  if (inChain(/DEDU[ÇC�][ÕO�]ES|IMPOSTOSINCIDENTES/))
    return { kind: 'deduction', category: null }
  if (inChain(/^\(?-?\)?RECEITA/)) return { kind: 'revenue', category: null }

  // despesa: categoria pelo grupo MAIS EXTERNO que mapeia para algo específico
  const named = [...ancestors].reverse()
  for (const g of named) {
    const cat = classifyCategoryByName(g)
    if (cat !== 'Despesas gerais') return { kind: 'expense', category: cat }
  }
  return {
    kind: 'expense',
    category: classifyCategoryByName(ancestors[0] ?? row.account_name),
  }
}
