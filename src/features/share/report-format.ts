// Formatação pura do relatório público — compartilhada entre o deck
// (public-report.tsx) e o PDF (download-pdf-button.tsx). Sem React.

export function fmtPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const f = (s: string) => s.split('-').reverse().join('/')
  return `${f(start)} a ${f(end)}`
}

// Chaves internas das fórmulas nunca chegam cruas ao leigo.
const KEY_LABELS: Record<string, string> = {
  saldo_anterior: 'Saldo anterior',
  saldo_inicial: 'Saldo inicial',
  saldo_final: 'Saldo final',
  saldo_esperado: 'Saldo esperado',
  saldo_informado: 'Saldo informado',
  total_debitos: 'Total de débitos',
  total_creditos: 'Total de créditos',
  debito: 'Débito',
  credito: 'Crédito',
  diferenca: 'Diferença',
  valor: 'Valor',
}

export function humanizeKey(k: string): string {
  if (KEY_LABELS[k]) return KEY_LABELS[k]
  const plain = k.replace(/_/g, ' ')
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

export function fmtMoney(v: unknown): string | null {
  if (typeof v !== 'number') return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
