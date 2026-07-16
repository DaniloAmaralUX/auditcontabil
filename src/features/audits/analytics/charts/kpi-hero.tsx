// KPIs do topo — 4 números que resumem o período.
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { brl, pct, type AuditAnalytics } from '../types'

export function KpiHero({ a }: { a: AuditAnalytics }) {
  const c = a.consolidado
  const negative = c.resultado < 0
  return (
    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
      <Kpi label='Receita líquida' value={brl(c.receita_liquida)} />
      <Kpi label='Despesas' value={brl(c.despesas)} />
      <Kpi
        label='Resultado'
        value={brl(c.resultado)}
        tone={negative ? 'bad' : 'good'}
        icon={negative ? TrendingDown : TrendingUp}
      />
      <Kpi
        label='Despesa / Receita'
        value={pct(c.despesa_receita_pct)}
        tone={
          c.despesa_receita_pct === null
            ? undefined
            : c.despesa_receita_pct > 100
              ? 'bad'
              : 'good'
        }
        hint={c.margem_pct !== null ? `margem ${pct(c.margem_pct)}` : undefined}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
  hint?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className='gap-2 py-5'>
      <CardHeader className='pb-0'>
        <CardTitle className='text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase'>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className='flex items-center gap-1.5'>
        <span
          className={cn(
            'text-2xl leading-none font-bold tracking-tight tabular-nums',
            tone === 'bad' && 'text-destructive',
            tone === 'good' && 'text-success-text'
          )}
        >
          {value}
        </span>
        {Icon && (
          <Icon
            className={cn(
              'size-4 shrink-0',
              tone === 'bad' ? 'text-destructive' : 'text-success'
            )}
            aria-hidden
          />
        )}
        {hint && (
          <span className='ms-auto text-xs text-muted-foreground'>{hint}</span>
        )}
      </CardContent>
    </Card>
  )
}
