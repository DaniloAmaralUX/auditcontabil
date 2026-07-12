import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { auditDetailQuery } from '../../data/queries'
import { inconsistenciesQuery } from '../../data/inconsistencies'
import { useTransitionAudit } from '../../data/mutations'

export function RevisaoPanel({ auditId }: { auditId: string }) {
  const role = useAuthStore((s) => s.auth.role)
  const audit = useQuery(auditDetailQuery(auditId))
  const results = useQuery(inconsistenciesQuery(auditId))
  const transition = useTransitionAudit(auditId)

  if (audit.isLoading || results.isLoading)
    return <Skeleton className='h-40 w-full' />

  const actionable = (results.data ?? []).filter(
    (r) => r.severity === 'attention' || r.severity === 'divergence'
  )
  const pending = actionable.filter((r) => r.review_status === 'pending')
  const reviewed = actionable.length - pending.length
  const status = audit.data?.status

  const canApprove = can(role ?? undefined, 'approve')
  const readyToApprove = status === 'in_review' && pending.length === 0

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Placar da revisão</CardTitle>
          <CardDescription>
            {actionable.length === 0
              ? 'Nenhum item exige revisão.'
              : `${reviewed} de ${actionable.length} itens revisados.`}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-2'>
          <div
            className='h-2 w-full overflow-hidden rounded-full bg-muted'
            role='progressbar'
            aria-valuemin={0}
            aria-valuemax={actionable.length}
            aria-valuenow={reviewed}
            aria-label='Itens revisados'
          >
            <div
              className='h-full bg-primary transition-all'
              style={{
                width:
                  actionable.length === 0
                    ? '100%'
                    : `${(reviewed / actionable.length) * 100}%`,
              }}
            />
          </div>
          {pending.length > 0 && (
            <p className='text-sm text-muted-foreground'>
              Revise os {pending.length} itens pendentes na aba Inconsistências.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aprovação</CardTitle>
          <CardDescription>
            A aprovação libera a publicação do relatório para o cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          {status === 'processed' || status === 'partially_processed' ? (
            <Button
              variant='outline'
              onClick={() => transition.mutate('in_review')}
              disabled={transition.isPending}
            >
              Iniciar revisão
            </Button>
          ) : status === 'approved' || status === 'published' ? (
            <p className='flex items-center gap-2 text-sm text-success'>
              <ShieldCheck className='size-4' aria-hidden /> Auditoria aprovada.
            </p>
          ) : (
            <>
              <Button
                onClick={() => transition.mutate('approved')}
                disabled={!canApprove || !readyToApprove || transition.isPending}
              >
                <ShieldCheck className='size-4' /> Aprovar auditoria
              </Button>
              {!canApprove && (
                <p className='text-sm text-muted-foreground'>
                  Apenas a proprietária pode aprovar.
                </p>
              )}
              {canApprove && !readyToApprove && (
                <p className='text-sm text-muted-foreground'>
                  {status !== 'in_review'
                    ? 'A auditoria precisa estar em revisão.'
                    : `Aguardando ${pending.length} itens de revisão.`}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
