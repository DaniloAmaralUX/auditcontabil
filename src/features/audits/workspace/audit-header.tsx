import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { auditDetailQuery } from '../data/queries'
import { AuditStatusBadge } from '../components/status-badge'

function fmtPeriod(start: string | null, end: string | null) {
  if (!start || !end) return 'período não definido'
  const f = (s: string) => s.split('-').reverse().join('/')
  return `${f(start)} – ${f(end)}`
}

export function AuditHeader({ auditId }: { auditId: string }) {
  const { data, isLoading } = useQuery(auditDetailQuery(auditId))

  return (
    <div className='sticky top-16 z-30 -mx-4 border-b bg-background/85 px-4 py-3 backdrop-blur'>
      <Button variant='ghost' size='sm' asChild className='mb-1 -ms-2'>
        <Link to='/audits'>
          <ArrowLeft className='size-4' /> Auditorias
        </Link>
      </Button>
      {isLoading || !data ? (
        <Skeleton className='h-8 w-72' />
      ) : (
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
          <h1 className='text-xl font-bold tracking-tight'>
            {data.title || 'Auditoria'}
          </h1>
          <AuditStatusBadge status={data.status} />
          <span className='text-sm text-muted-foreground'>
            {data.cliente_name} · {fmtPeriod(data.period_start, data.period_end)}
          </span>
        </div>
      )}
    </div>
  )
}
