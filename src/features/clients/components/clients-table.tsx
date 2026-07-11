import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { can } from '@/lib/permissions'
import { strings } from '@/lib/strings'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { clientsQuery } from '../data/queries'
import { type Cliente } from '../data/schema'
import { useClients } from './clients-provider'

export function ClientsTable() {
  const { data, isLoading, isError, refetch } = useQuery(clientsQuery())
  const { setOpen, setCurrentRow } = useClients()
  const role = useAuthStore((s) => s.auth.role)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return data ?? []
    return (data ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.cnpj ?? '').toLowerCase().includes(term)
    )
  }, [data, q])

  const canEdit = can(role ?? undefined, 'manage_clients')
  const canDelete = can(role ?? undefined, 'delete_client')

  return (
    <div className='space-y-3'>
      <Input
        placeholder='Buscar por nome ou CNPJ…'
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className='max-w-sm'
      />

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{strings.clients.name}</TableHead>
              <TableHead>{strings.clients.cnpj}</TableHead>
              <TableHead>{strings.clients.email}</TableHead>
              <TableHead>{strings.clients.situation}</TableHead>
              <TableHead className='w-10' />
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
                    Não foi possível carregar os clientes.
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
                    {q ? strings.clients.emptyFiltered : strings.clients.emptyTitle}
                  </p>
                  {!q && (
                    <p className='text-sm text-muted-foreground'>
                      {strings.clients.emptyHint}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            )}

            {rows.map((c: Cliente) => (
              <TableRow key={c.id}>
                <TableCell className='font-medium'>
                  <Link
                    to='/clients/$clientId'
                    params={{ clientId: c.id }}
                    className='hover:underline'
                  >
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.cnpj ?? '—'}</TableCell>
                <TableCell>{c.contact_email ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant='outline'>
                    {c.is_active ? strings.clients.active : strings.clients.inactive}
                  </Badge>
                </TableCell>
                <TableCell>
                  {(canEdit || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='size-8'>
                          <MoreHorizontal className='size-4' />
                          <span className='sr-only'>Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        {canEdit && (
                          <DropdownMenuItem
                            onClick={() => {
                              setCurrentRow(c)
                              setOpen('update')
                            }}
                          >
                            <Pencil className='size-4' /> {strings.common.edit}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            variant='destructive'
                            onClick={() => {
                              setCurrentRow(c)
                              setOpen('delete')
                            }}
                          >
                            <Trash2 className='size-4' /> {strings.common.remove}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
