// A estrela do produto: dashboard gerencial gerado da planilha — auditoria e
// apresentação ao mesmo tempo. Ordem narrativa: números → composição →
// empresas → contas → evolução → detalhe.
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { analyticsQuery } from '../../analytics/query'
import {
  CompanyRanking,
  CompanyResults,
  CompanyTable,
  GroupDonut,
  KpiHero,
  PeriodTrend,
  TopAccounts,
} from '../../analytics/charts'
import { hasAnalyticsData } from '../../analytics/types'

export function DashboardPanel({ auditId }: { auditId: string }) {
  const { data, isLoading, isError, refetch } = useQuery(analyticsQuery(auditId))

  if (isLoading) {
    return (
      <div className='space-y-3'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-24' />
          ))}
        </div>
        <div className='grid gap-3 lg:grid-cols-2'>
          <Skeleton className='h-64' />
          <Skeleton className='h-64' />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className='rounded-lg border border-dashed py-12 text-center'>
        <p className='text-sm font-medium'>
          Não foi possível carregar o dashboard.
        </p>
        <Button variant='outline' size='sm' className='mt-2' onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!hasAnalyticsData(data)) {
    return (
      <div className='flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center'>
        <Sparkles className='size-8 text-muted-foreground' aria-hidden />
        <div>
          <p className='font-medium'>O dashboard nasce da planilha.</p>
          <p className='text-sm text-muted-foreground'>
            Importe o arquivo do período e ele se monta sozinho.
          </p>
        </div>
        <Button asChild>
          <Link to='/audits/$auditId/import' params={{ auditId }}>
            <Sparkles className='size-4' /> Gerar dashboard
          </Link>
        </Button>
      </div>
    )
  }

  const a = data!
  return (
    <div className='space-y-4'>
      <KpiHero a={a} />

      <div className='grid gap-4 lg:grid-cols-2'>
        <GroupDonut grupos={a.por_grupo} />
        <TopAccounts contas={a.top_contas} />
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <CompanyRanking empresas={a.empresas} />
        <CompanyResults empresas={a.empresas} />
      </div>

      <PeriodTrend periodos={a.por_periodo} />

      <CompanyTable empresas={a.empresas} />
    </div>
  )
}
