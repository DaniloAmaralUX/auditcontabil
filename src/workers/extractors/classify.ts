// Classificação DETERMINÍSTICA de contas por CÓDIGO contábil (plano de contas
// brasileiro padrão) com fallback por nome. O código é sinal mais forte que
// heurística textual: 3.1=receitas, 3.1.03=deduções, 3.2=CMV, 3.7=despesas.
// Espelhada no SQL (docs/deploy/7-classificacao-codigo.sql).

type AccountKind = 'revenue' | 'deduction' | 'expense' | 'other'

/** Grupos 1 (Ativo) e 2 (Passivo/PL) ficam fora da DRE → 'other'. */
export function classifyKindByCode(
  code: string | null,
  name: string | null
): AccountKind {
  if (code) {
    if (/^[12](\.|$)/.test(code)) return 'other' // balanço patrimonial
    if (/^3\.1\.03(\.|$)/.test(code)) return 'deduction'
    if (/^3\.1(\.|$)/.test(code)) return 'revenue'
    if (/^3\.[2-9](\.|$)/.test(code)) {
      // "(-)" no nome dentro de receitas seria dedução; em 3.2+ é despesa
      return 'expense'
    }
    if (/^3(\.|$)/.test(code)) return 'other' // raiz 3 = total do resultado
  }
  return classifyKindByName(name)
}

/** Fallback textual (mesma régua já usada no worker/SQL). */
function classifyKindByName(name: string | null): AccountKind {
  if (!name) return 'expense'
  const l = name.toLowerCase()
  if (/\(-\)/.test(l) && /(dedu|imposto|cancelamento|devolu)/.test(l))
    return 'deduction'
  if (
    /(dedu[çc][õo]es|imposto sobre|iss|icms|pis|cofins|simples nacional|cancelamento)/.test(
      l
    )
  )
    return 'deduction'
  if (
    /(receita|faturamento|venda|mensalidade|patroc|rendimento|juros receb|descontos obtidos)/.test(
      l
    )
  )
    return 'revenue'
  if (/(total|subtotal|resultado|soma|lucro|preju[íi]zo)/.test(l))
    return 'other'
  return 'expense'
}

/**
 * Categoria de despesa por código (subgrupo do 3.7) com fallback por nome.
 * Rótulos em linguagem de apresentação.
 */
export function classifyCategoryByCode(
  code: string | null,
  name: string | null
): string {
  if (code) {
    if (/^3\.2(\.|$)/.test(code)) return 'Custo das mercadorias'
    if (/^3\.7\.03\.001(\.|$)/.test(code)) return 'Pessoal'
    if (/^3\.7\.03\.009(\.|$)/.test(code)) return 'Depreciações'
    if (/^3\.7\.03\.011(\.|$)/.test(code)) return 'Utilidades e serviços'
    if (/^3\.7\.03\.015(\.|$)/.test(code)) return 'Despesas gerais'
    if (/^3\.7\.09(\.|$)/.test(code)) return 'Tributárias'
    if (/^3\.7\.11(\.|$)/.test(code)) return 'Financeiras'
    if (/^3\.7\.03(\.|$)/.test(code)) return 'Administrativas'
  }
  return classifyCategoryByName(name)
}

export function classifyCategoryByName(name: string | null): string {
  if (!name) return 'Despesas gerais'
  const l = name.toLowerCase()
  if (/(custo)/.test(l)) return 'Custo das mercadorias'
  if (
    /(sal[aá]rio|ordenado|inss|fgts|f[eé]rias|13|d[eé]cimo|pr[oó]-?labore|indeniza|aviso pr[eé]vio|hora extra|benef[ií]cio|vale|plano de sa[uú]de|plano dent|rescis|grrf|treinament|uniforme|exames m[eé]dic|pessoal)/.test(
      l
    )
  )
    return 'Pessoal'
  if (
    /(juro|tarifa banc|iof|multa|desconto conced|financ|emprest|cart[aã]o de cr[eé]dito|banc[aá]ri)/.test(
      l
    )
  )
    return 'Financeiras'
  if (/(deprecia|amortiza|exaust)/.test(l)) return 'Depreciações'
  if (/(imposto|taxa|tribut)/.test(l)) return 'Tributárias'
  if (
    /([aá]gua|energia|telecom|telefone|internet|aluguel|alugu[ée]is|condom[ií]nio|ocupa[çc])/.test(
      l
    )
  )
    return 'Utilidades e serviços'
  if (/(propaganda|publicidade|marketing)/.test(l)) return 'Comercial'
  return 'Despesas gerais'
}
