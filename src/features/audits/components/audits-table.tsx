import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { FileText, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { can } from '@/lib/permissions'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
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
import { type AuditListItem } from '../data/schema'
import { useAudits } from './audits-provider'
import { nextAction } from './next-action'
import { AuditStatusBadge } from './status-badge'

function fmtPeriod(a: AuditListItem) {
  if (!a.period_start || !a.period_end) return '—'
  const f = (s: string) => s.split('-').reverse().join('/')
  return `${f(a.period_start)} – ${f(a.period_end)}`
}

export function AuditsTable() {
  const { data, isLoading, isError, refetch } = useQuery(auditsListQuery())
  const { setCreateOpen } = useAudits()
  const role = useAuthStore((s) => s.auth.role)
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
      <div className='overflow-x-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Auditoria</TableHead>
              <TableHead className='hidden sm:table-cell'>Cliente</TableHead>
              <TableHead className='hidden xl:table-cell'>Período</TableHead>
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
              <TableRow className='hover:bg-transparent'>
                <TableCell colSpan={5} className='p-0'>
                  <Empty className='border-0'>
                    <EmptyHeader>
                      <EmptyMedia variant='icon'>
                        <FileText aria-hidden />
                      </EmptyMedia>
                      <EmptyTitle>
                        {q
                          ? 'Nenhuma auditoria corresponde à busca.'
                          : 'Suas auditorias vão aparecer aqui.'}
                      </EmptyTitle>
                      {!q && (
                        <EmptyDescription>
                          Escolha o cliente e o período — depois importe a
                          planilha e o dashboard se monta sozinho.
                        </EmptyDescription>
                      )}
                    </EmptyHeader>
                    {!q && can(role ?? undefined, 'create_audit') && (
                      <EmptyContent>
                        <Button size='sm' onClick={() => setCreateOpen(true)}>
                          <Plus className='size-4' /> Nova auditoria
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                </TableCell>
              </TableRow>
            )}

            {rows.map((a) => {
              const na = nextAction(a.status)
              return (
                <TableRow key={a.id}>
                  <TableCell className='max-w-64 font-medium'>
                    <Link
                      to='/audits/$auditId'
                      params={{ auditId: a.id }}
                      search={{ tab: 'resumo' }}
                      className='block truncate hover:underline'
                      title={a.title || 'Auditoria sem nome'}
                    >
                      {a.title || 'Auditoria sem nome'}
                    </Link>
                    <span className='block truncate text-xs text-muted-foreground sm:hidden'>
                      {a.cliente_name}
                    </span>
                  </TableCell>
                  <TableCell className='hidden max-w-48 sm:table-cell'>
                    <span className='block truncate' title={a.cliente_name}>
                      {a.cliente_name}
                    </span>
                  </TableCell>
                  <TableCell className='hidden whitespace-nowrap tabular-nums xl:table-cell'>
                    {fmtPeriod(a)}
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    <AuditStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className='text-end whitespace-nowrap'>
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
