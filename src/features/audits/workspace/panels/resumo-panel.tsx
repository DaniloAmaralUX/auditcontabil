import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { auditFilesQuery } from '../../data/queries'
import { inconsistenciesQuery } from '../../data/inconsistencies'

function Kpi({
  label,
  value,
  cls,
  suffix,
}: {
  label: string
  value: number
  cls?: string
  suffix?: string
}) {
  return (
    <Card>
      <CardHeader className='pb-1'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold tabular-nums ${cls ?? ''}`}>
          {value.toLocaleString('pt-BR')}
          {suffix ?? ''}
        </p>
      </CardContent>
    </Card>
  )
}

export function ResumoPanel({ auditId }: { auditId: string }) {
  const results = useQuery(inconsistenciesQuery(auditId))
  const files = useQuery(auditFilesQuery(auditId))

  if (results.isLoading || files.isLoading)
    return <Skeleton className='h-40 w-full' />

  const all = results.data ?? []
  const divergences = all.filter((r) => r.severity === 'divergence').length
  const attentions = all.filter((r) => r.severity === 'attention').length
  const pending = all.filter(
    (r) =>
      r.review_status === 'pending' &&
      (r.severity === 'attention' || r.severity === 'divergence')
  ).length
  const rows = (files.data ?? []).reduce((s, f) => s + (f.row_count ?? 0), 0)
  // §14: linhas com erro (scope row, invalid via R003) e regras não executadas (RN-005)
  const invalidRows = all.filter(
    (r) => r.scope === 'row' && r.rule_code === 'R003_REQUIRED_FIELDS'
  ).length
  const notExecuted = all.filter(
    (r) => r.values_snapshot && r.values_snapshot['executed'] === false
  ).length
  const usablePct =
    rows > 0 ? Math.round(((rows - invalidRows) / rows) * 100) : null

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Kpi label='Linhas processadas' value={rows} />
        <Kpi label='Divergências' value={divergences} cls='text-destructive' />
        <Kpi label='Atenções' value={attentions} cls='text-warning' />
        <Kpi label='Pendentes de revisão' value={pending} />
      </div>
      {rows > 0 && (
        <div className='grid gap-3 sm:grid-cols-3'>
          <Kpi
            label='Aproveitamento das linhas'
            value={usablePct ?? 0}
            suffix='%'
            cls={usablePct !== null && usablePct < 100 ? 'text-warning' : 'text-success'}
          />
          <Kpi label='Linhas com erro de leitura' value={invalidRows} cls={invalidRows > 0 ? 'text-warning' : ''} />
          <Kpi label='Verificações não executadas' value={notExecuted} />
        </div>
      )}
      {all.length === 0 && (
        <div className='rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground'>
          Ainda não há dados processados. Envie as planilhas na aba Dados para
          começar.
        </div>
      )}
    </div>
  )
}
