// Detalhe por empresa — a tabela real que serve de equivalente textual
// para os dois bar charts (ranking e resultado, aria-hidden).
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { brl, pct, type AnalyticsEmpresa } from '../types'

function statusBadge(status: AnalyticsEmpresa['status']) {
  const map = {
    Superavitária: 'text-success-text',
    Deficitária: 'text-warning-text',
    Crítica: 'text-destructive',
  } as const
  return (
    <Badge variant='outline' className={map[status]}>
      {status}
    </Badge>
  )
}

export function CompanyTable({
  empresas,
  title = 'Detalhe por empresa',
  description = 'Receita, despesa e resultado de cada empresa do grupo.',
}: {
  empresas: AnalyticsEmpresa[]
  title?: string
  description?: string
}) {
  if (empresas.length <= 1) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='bg-muted/40'>
                <TableHead>Empresa</TableHead>
                <TableHead className='text-end'>Receita líq.</TableHead>
                <TableHead className='text-end'>Despesas</TableHead>
                <TableHead className='text-end'>Resultado</TableHead>
                <TableHead className='text-end'>D/R</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map((e) => (
                <TableRow key={e.codigo}>
                  <TableCell className='max-w-56'>
                    <span className='font-medium'>{e.codigo}</span>
                    {e.nome !== e.codigo && (
                      <span className='block truncate text-xs text-muted-foreground'>
                        {e.nome}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {brl(e.receita_liquida, true)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {brl(e.despesas, true)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-end font-medium tabular-nums',
                      e.resultado < 0 ? 'text-destructive' : 'text-success-text'
                    )}
                  >
                    {brl(e.resultado, true)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {pct(e.despesa_receita_pct)}
                  </TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
