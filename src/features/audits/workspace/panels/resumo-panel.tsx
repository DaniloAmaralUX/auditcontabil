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

function Kpi({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <Card>
      <CardHeader className='pb-1'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold tabular-nums ${cls ?? ''}`}>{value}</p>
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

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Kpi label='Linhas processadas' value={rows} />
        <Kpi label='Divergências' value={divergences} cls='text-destructive' />
        <Kpi label='Atenções' value={attentions} cls='text-warning' />
        <Kpi label='Pendentes de revisão' value={pending} />
      </div>
      {all.length === 0 && (
        <div className='rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground'>
          Ainda não há dados processados. Envie as planilhas na aba Dados para
          começar.
        </div>
      )}
    </div>
  )
}
