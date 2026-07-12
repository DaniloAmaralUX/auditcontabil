import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { auditsListQuery } from '../data/queries'
import { type AuditListItem, type AuditStatus } from '../data/schema'
import { AuditStatusBadge } from './status-badge'

function fmtPeriod(a: AuditListItem) {
  if (!a.period_start || !a.period_end) return '—'
  const f = (s: string) => s.split('-').reverse().join('/')
  return `${f(a.period_start)} – ${f(a.period_end)}`
}

type WorkspaceTab =
  | 'dashboard'
  | 'resumo'
  | 'dados'
  | 'inconsistencias'
  | 'revisao'
  | 'relatorio'
  | 'compartilhar'

type NextAction = { label: string; tab?: WorkspaceTab; toImport?: boolean }

function nextAction(status: AuditStatus): NextAction {
  switch (status) {
    case 'draft':
    case 'awaiting_files':
    case 'awaiting_mapping':
      return { label: 'Enviar / mapear', toImport: true }
    case 'processing':
    case 'partially_processed':
      return { label: 'Ver processamento', tab: 'dados' }
    case 'processed':
      return { label: 'Ver dashboard', tab: 'dashboard' }
    case 'in_review':
      return { label: 'Revisar', tab: 'revisao' }
    case 'approved':
      return { label: 'Publicar', tab: 'relatorio' }
    case 'published':
      return { label: 'Compartilhar', tab: 'compartilhar' }
    default:
      return { label: 'Abrir', tab: 'resumo' }
  }
}

export function AuditsTable() {
  const { data, isLoading, isError, refetch } = useQuery(auditsListQuery())
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return data ?? []
    return (data ?? []).filter(
      (a) =>
        a.title.toLowerCase().includes(term) ||
        a.cliente_name.toLowerCase().includes(term)
    )
  }, [data, q])

  return (
    <div className='space-y-3'>
      <Input
        placeholder='Buscar por auditoria ou cliente…'
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className='max-w-sm'
      />
      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Auditoria</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-end'>Próxima ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className='h-6 w-full' />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={5} className='py-8 text-center'>
                  <p className='mb-2 text-sm text-muted-foreground'>
                    Não foi possível carregar as auditorias.
                  </p>
                  <Button variant='outline' size='sm' onClick={() => refetch()}>
                    {strings.common.retry}
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className='py-10 text-center'>
                  <p className='text-sm font-medium'>
                    {q
                      ? 'Nenhuma auditoria corresponde à busca.'
                      : 'Nenhuma auditoria por aqui.'}
                  </p>
                  {!q && (
                    <p className='text-sm text-muted-foreground'>
                      Crie a primeira auditoria para começar.
                    </p>
                  )}
                </TableCell>
              </TableRow>
            )}

            {rows.map((a) => {
              const na = nextAction(a.status)
              return (
                <TableRow key={a.id}>
                  <TableCell className='font-medium'>
                    <Link
                      to='/audits/$auditId'
                      params={{ auditId: a.id }}
                      search={{ tab: 'resumo' }}
                      className='hover:underline'
                    >
                      {a.title || 'Auditoria sem nome'}
                    </Link>
                  </TableCell>
                  <TableCell>{a.cliente_name}</TableCell>
                  <TableCell className='tabular-nums'>{fmtPeriod(a)}</TableCell>
                  <TableCell>
                    <AuditStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className='text-end'>
                    {na.toImport ? (
                      <Button size='sm' variant='outline' asChild>
                        <Link
                          to='/audits/$auditId/import'
                          params={{ auditId: a.id }}
                        >
                          {na.label}
                        </Link>
                      </Button>
                    ) : (
                      <Button size='sm' variant='outline' asChild>
                        <Link
                          to='/audits/$auditId'
                          params={{ auditId: a.id }}
                          search={{ tab: na.tab ?? 'resumo' }}
                        >
                          {na.label}
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
