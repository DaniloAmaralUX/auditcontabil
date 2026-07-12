import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Eye, EyeOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { SeverityBadge } from '../../components/status-badge'
import {
  inconsistenciesQuery,
  useReviewResult,
  type ReviewStatus,
  type RuleResult,
} from '../../data/inconsistencies'
import { PanelErrorState } from './panel-error-state'

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'divergencias', label: 'Divergências' },
  { key: 'atencoes', label: 'Atenções' },
  { key: 'pendentes', label: 'Pendentes de revisão' },
] as const

function fmtValues(v: Record<string, unknown>) {
  return Object.entries(v)
    .filter(([k]) => k !== 'checked')
    .map(
      ([k, val]) =>
        `${k}: ${typeof val === 'number' ? val.toLocaleString('pt-BR') : String(val)}`
    )
}

export function InconsistenciasPanel({ auditId }: { auditId: string }) {
  const { data, isLoading, isError, refetch } = useQuery(
    inconsistenciesQuery(auditId)
  )
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('todas')
  const [current, setCurrent] = useState<RuleResult | null>(null)

  const rows = useMemo(() => {
    const all = (data ?? []).filter((r) => r.severity !== 'ok')
    switch (filter) {
      case 'divergencias':
        return all.filter((r) => r.severity === 'divergence')
      case 'atencoes':
        return all.filter((r) => r.severity === 'attention')
      case 'pendentes':
        return all.filter(
          (r) =>
            r.review_status === 'pending' &&
            (r.severity === 'attention' || r.severity === 'divergence')
        )
      default:
        return all
    }
  }, [data, filter])

  if (isLoading) return <Skeleton className='h-64 w-full' />
  if (isError) return <PanelErrorState onRetry={() => refetch()} />

  const okCount = (data ?? []).filter((r) => r.severity === 'ok').length
  if ((data ?? []).filter((r) => r.severity !== 'ok').length === 0) {
    return (
      <div className='rounded-lg border border-dashed py-12 text-center'>
        <p className='text-sm font-medium'>
          Nenhuma inconsistência encontrada.
        </p>
        <p className='text-sm text-muted-foreground'>
          {okCount > 0
            ? `${okCount} verificações passaram. Siga para a Revisão para aprovar.`
            : 'Processe os arquivos para gerar os resultados das regras.'}
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap gap-2'>
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size='sm'
            variant={filter === f.key ? 'default' : 'outline'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <span className='ms-auto self-center text-sm text-muted-foreground'>
          {rows.length} de{' '}
          {(data ?? []).filter((r) => r.severity !== 'ok').length}
        </span>
      </div>

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/40'>
              <TableHead>Severidade</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Revisão</TableHead>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                className='cursor-pointer'
                onClick={() => setCurrent(r)}
              >
                <TableCell>
                  <SeverityBadge severity={r.severity} />
                </TableCell>
                <TableCell className='max-w-md'>{r.message}</TableCell>
                <TableCell className='tabular-nums'>
                  {r.account_code ?? '—'}
                </TableCell>
                <TableCell>
                  {r.review_status === 'pending' ? (
                    <Badge variant='outline' className='text-warning'>
                      Pendente
                    </Badge>
                  ) : (
                    <Badge variant='outline' className='text-success'>
                      <Check className='size-3' aria-hidden /> Revisado
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.hidden_from_client ? (
                    <EyeOff
                      className='size-4 text-muted-foreground'
                      aria-label='Oculto do cliente'
                    />
                  ) : (
                    <Eye
                      className='size-4 text-muted-foreground'
                      aria-label='Visível ao cliente'
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReviewSheet
        auditId={auditId}
        result={current}
        onClose={() => setCurrent(null)}
      />
    </div>
  )
}

function ReviewSheet({
  auditId,
  result,
  onClose,
}: {
  auditId: string
  result: RuleResult | null
  onClose: () => void
}) {
  return (
    <Sheet open={!!result} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className='flex w-full flex-col gap-4 sm:max-w-md'>
        {result && (
          // key remonta o form por resultado: estado inicializa das props
          <ReviewForm
            key={result.id}
            auditId={auditId}
            result={result}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ReviewForm({
  auditId,
  result,
  onClose,
}: {
  auditId: string
  result: RuleResult
  onClose: () => void
}) {
  const review = useReviewResult(auditId)
  const [status, setStatus] = useState<ReviewStatus>(
    result.review_status === 'pending' ? 'justified' : result.review_status
  )
  const [note, setNote] = useState(result.review_note ?? '')
  const [hidden, setHidden] = useState(result.hidden_from_client)

  async function save() {
    if (note.trim().length === 0) return
    await review.mutateAsync({
      id: result.id,
      review_status: status,
      review_note: note.trim(),
      hidden_from_client: hidden,
    })
    onClose()
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Revisar inconsistência</SheetTitle>
        <SheetDescription>{result.rule_code}</SheetDescription>
      </SheetHeader>

      <div className='flex-1 space-y-4 overflow-y-auto px-4'>
        <div className='flex items-center gap-2'>
          <SeverityBadge severity={result.severity} />
          {result.account_code && (
            <span className='text-sm text-muted-foreground'>
              Conta {result.account_code}
            </span>
          )}
        </div>
        <p className='text-sm'>{result.message}</p>

        <div className='rounded-md border bg-muted/30 p-3 text-sm'>
          <p className='mb-1 font-medium'>Valores</p>
          <ul className='space-y-0.5 text-muted-foreground'>
            {fmtValues(result.values_snapshot).map((line) => (
              <li key={line} className='tabular-nums'>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className='space-y-2'>
          <Label>Classificação</Label>
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant={status === 'justified' ? 'default' : 'outline'}
              onClick={() => setStatus('justified')}
            >
              Justificada
            </Button>
            <Button
              size='sm'
              variant={status === 'false_positive' ? 'default' : 'outline'}
              onClick={() => setStatus('false_positive')}
            >
              Falso positivo
            </Button>
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='note'>Justificativa (obrigatória)</Label>
          <Textarea
            id='note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Explique a decisão para o registro da auditoria.'
            rows={4}
          />
        </div>

        <div className='flex items-center justify-between rounded-md border p-3'>
          <Label className='mb-0'>Ocultar do cliente</Label>
          <Switch checked={hidden} onCheckedChange={setHidden} />
        </div>
      </div>

      <SheetFooter>
        <Button
          onClick={save}
          disabled={review.isPending || note.trim().length === 0}
        >
          Marcar como revisado
        </Button>
      </SheetFooter>
    </>
  )
}
