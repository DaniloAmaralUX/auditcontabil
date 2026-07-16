import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { strings } from '@/lib/strings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { AuditStatusBadge } from '@/features/audits/components/status-badge'
import { auditsListQuery } from '@/features/audits/data/queries'
import { clientQuery } from './data/queries'

export function ClientDetail() {
  const { clientId } = useParams({ from: '/_authenticated/clients/$clientId' })
  const { data, isLoading, isError } = useQuery(clientQuery(clientId))
  const audits = useQuery(auditsListQuery())
  const clientAudits = (audits.data ?? []).filter(
    (a) => a.cliente_id === clientId
  )

  return (
    <>
      <PageHeader
        leading={
          <Button variant='ghost' size='sm' asChild>
            <Link to='/clients'>
              <ArrowLeft className='size-4' /> {strings.clients.title}
            </Link>
          </Button>
        }
      />

      <Main>
        {isLoading && <Skeleton className='h-40 w-full' />}
        {isError && (
          <p className='text-sm text-muted-foreground'>
            Não foi possível carregar este cliente.
          </p>
        )}
        {data && (
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h1 className='text-2xl font-bold tracking-tight'>
                  {data.name}
                </h1>
                <p className='text-muted-foreground'>
                  {data.cnpj ?? 'Sem CNPJ'} ·{' '}
                  {data.contact_email ?? 'sem e-mail de contato'}
                </p>
              </div>
              <Badge variant='outline'>
                {data.is_active
                  ? strings.clients.active
                  : strings.clients.inactive}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de auditorias</CardTitle>
              </CardHeader>
              <CardContent>
                {clientAudits.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>
                    Este cliente ainda não tem auditorias. Crie a primeira em{' '}
                    <Link to='/audits' className='underline'>
                      Auditorias
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className='divide-y'>
                    {clientAudits.map((a) => (
                      <li
                        key={a.id}
                        className='flex items-center justify-between gap-2 py-2'
                      >
                        <Link
                          to='/audits/$auditId'
                          params={{ auditId: a.id }}
                          search={{ tab: 'resumo' }}
                          className='text-sm font-medium hover:underline'
                        >
                          {a.title || 'Auditoria sem nome'}
                        </Link>
                        <AuditStatusBadge status={a.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Main>
    </>
  )
}
