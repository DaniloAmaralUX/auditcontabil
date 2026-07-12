// Detecção do TIPO de documento pelo conteúdo (não pela extensão).
// O preset certo dispensa o usuário de mexer em mapeamento.

type FileKind =
  | 'balancete-csv'
  | 'dre-pdf'
  | 'csv-generico'
  | 'xlsx'
  | 'desconhecido'

const PDF_MAGIC = '%PDF-'

/** Detecta o tipo pelo início do conteúdo (texto já decodificado p/ CSV). */
export function detectKind(opts: {
  fileName: string
  head: string
}): FileKind {
  const { fileName, head } = opts
  const lower = fileName.toLowerCase()

  if (head.startsWith(PDF_MAGIC) || lower.endsWith('.pdf')) return 'dre-pdf'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx'

  // Balancete societário: cabeçalho canônico "Conta";"S";"Classificação";…
  // (aceita mojibake de CP1252 lido como UTF-8: "Classifica��o")
  const isBalancete =
    /"?Conta"?;"?S"?;"?Classifica/i.test(head) || /Balancete/i.test(head)
  if (lower.endsWith('.csv') && isBalancete) return 'balancete-csv'
  if (lower.endsWith('.csv')) return 'csv-generico'

  return 'desconhecido'
}
