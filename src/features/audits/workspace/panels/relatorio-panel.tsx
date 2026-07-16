import { useQuery, queryOptions } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  deriveDataQualitySummary,
  derivePerformanceSummary,
  deriveProfessionalConclusion,
} from '@/features/audits/analytics/insights'
import {
  hasAnalyticsData,
  type AuditAnalytics,
  type ReconciliationSummary,
} from '@/features/audits/analytics/types'
import { SeverityBadge, type Severity } from '../../components/status-badge'
import { PanelErrorState } from './panel-error-state'

type SnapshotPayload = {
  audit: {
    title: string
    cliente: string
    period_start: string | null
    period_end: string | null
    version: number
    conclusion?: string | null
  }
  summary: { total_rows: number; processed: number; invalid: number }
  items: Array<{
    severity: Severity
    message: string
    account_code: string | null
    note: string | null
  }>
  analytics?: AuditAnalytics
  /** Ausente em snapshots publicados antes da migração 8. */
  reconciliation?: ReconciliationSummary
}

function snapshotQuery(auditId: string) {
  return queryOptions({
    queryKey: qk.audits.snapshot(auditId),
    queryFn: async (): Promise<SnapshotPayload | null> => {
      const { data, error } = await supabase
        .from('published_snapshots')
        .select('payload')
        .eq('audit_id', auditId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data?.payload as SnapshotPayload) ?? null
    },
  })
}

export function RelatorioPanel({ auditId }: { auditId: string }) {
  const { data, isLoading, isError, refetch } = useQuery(snapshotQuery(auditId))

  if (isLoading) return <Skeleton className='h-40 w-full' />
  if (isError) return <PanelErrorState onRetry={() => refetch()} />

  if (!data) {
    return (
      <div className='rounded-lg border border-dashed py-12 text-center'>
        <p className='text-sm font-medium'>
          O relatório fica disponível após a publicação.
        </p>
        <p className='text-sm text-muted-foreground'>
          Aprove a auditoria e publique na aba Compartilhar.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização — é isto que a cliente verá</CardTitle>
          <CardDescription>
            Versão {data.audit.version} · {data.audit.cliente}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          {/* As MESMAS três derivações do deck público — paridade da promessa
              "é isto que a cliente verá": desempenho, dados e conclusão. */}
          <p>
            <strong>Resultado do período:</strong>{' '}
            {
              derivePerformanceSummary(
                hasAnalyticsData(data.analytics) ? data.analytics : null
              ).headline
            }
          </p>
          <p>
            <strong>Confiabilidade dos dados:</strong>{' '}
            {
              deriveDataQualitySummary(data.summary, data.reconciliation ?? null)
                .headline
            }
          </p>
          <p>
            <strong>Pontos que exigem revisão:</strong>{' '}
            {
              deriveProfessionalConclusion({
                conclusion: data.audit.conclusion,
                attention: data.items.length,
              }).headline
            }
          </p>
        </CardContent>
      </Card>

      {data.audit.conclusion && (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Conclusão do escritório</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm whitespace-pre-wrap'>{data.audit.conclusion}</p>
          </CardContent>
        </Card>
      )}

      {data.items.map((item, i) => (
        <Card key={i}>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <SeverityBadge severity={item.severity} />
              {item.account_code && (
                <span className='text-xs text-muted-foreground'>
                  Conta {item.account_code}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className='space-y-1 text-sm'>
            <p>{item.message}</p>
            {item.note && (
              <p className='text-muted-foreground'>
                Explicação do escritório: {item.note}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
