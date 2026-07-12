// A DRE do deck "O Fechamento" — extrato tipografado, não gráfico.
// <table> semântica com leader dots; régua-brasa conduz ao RESULTADO em
// Fraunces (opsz 144). Positivo/negativo nunca só por cor: sinal + parênteses
// contábeis + tag textual Superávit/Déficit.
import { CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildIncomeStatement } from '../statement'
import { pct, type AnalyticsConsolidado } from '../types'

const money = (v: number) =>
  Math.abs(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })

/** `+ R$ 1.240,00` · `(R$ 96,00)` — convenção contábil, legível em P&B. */
function signed(value: number, sign: '+' | '−' | '=') {
  if (value < 0) return `(${money(value)})`
  if (sign === '+') return `+ ${money(value)}`
  return money(value)
}

export function IncomeStatement({
  consolidado,
  reconciled,
  className,
}: {
  consolidado: AnalyticsConsolidado
  /** true = totais conferidos com o documento enviado (selo). */
  reconciled?: boolean
  className?: string
}) {
  const lines = buildIncomeStatement(consolidado)
  const result = lines.find((l) => l.kind === 'result')!
  const body = lines.filter((l) => l.kind !== 'result')
  const pos = result.value >= 0

  return (
    <div className={cn('space-y-6', className)}>
      <table className='income-statement'>
        <caption className='sr-only'>Demonstração do resultado</caption>
        <tbody>
          {body.map((l) => (
            <tr
              key={l.key}
              className={cn('is-row', l.kind === 'subtotal' && 'is-subtotal')}
            >
              <th scope='row' className='is-label'>
                {l.sign === '−' ? '− ' : l.sign === '=' ? '= ' : ''}
                {l.label}
              </th>
              <td className='is-dots' aria-hidden='true' />
              <td
                className={cn(
                  'is-value',
                  l.kind === 'base' && (l.value < 0 ? 'is-neg' : 'is-pos')
                )}
              >
                {signed(l.value, l.sign)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className='bottom-rule' />

      <div className='space-y-2'>
        <p className='deck-eyebrow'>Resultado do período</p>
        <p className={cn('result-figure', pos ? 'is-pos' : 'is-neg')}>
          <span aria-hidden='true'>{pos ? '▲ ' : '▼ '}</span>
          {pos ? '+ ' : ''}
          {result.value < 0 ? `(${money(result.value)})` : money(result.value)}
        </p>
        <p className='text-sm font-medium text-mist-text'>
          {pos ? 'Superávit' : 'Déficit'}
          {consolidado.margem_pct !== null &&
            ` · margem ${pct(consolidado.margem_pct)}`}
        </p>
      </div>

      <dl className='result-footnotes'>
        <div>
          <dt>Despesa / Receita</dt>
          <dd>{pct(consolidado.despesa_receita_pct)}</dd>
        </div>
        <div>
          <dt>Margem líquida</dt>
          <dd>{pct(consolidado.margem_pct)}</dd>
        </div>
        <div>
          <dt>Receita líquida</dt>
          <dd>{money(consolidado.receita_liquida)}</dd>
        </div>
      </dl>

      {reconciled && (
        <p className='flex items-center gap-1.5 text-xs text-success-text'>
          <CircleCheck className='size-3.5 shrink-0' aria-hidden />
          Conferido com o documento: os totais batem ao centavo.
        </p>
      )}
    </div>
  )
}
