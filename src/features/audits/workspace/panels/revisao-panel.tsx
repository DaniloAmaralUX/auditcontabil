import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { qk } from '@/lib/query-keys'
import { can } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
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
import { Textarea } from '@/components/ui/textarea'
import { auditDetailQuery } from '../../data/queries'
import { inconsistenciesQuery } from '../../data/inconsistencies'
import { useTransitionAudit } from '../../data/mutations'
import { PanelErrorState } from './panel-error-state'

// RF-052: conclusão geral — vai para o snapshot, o cliente e o PDF.
// Autosave com debounce: trocar de aba não descarta o que foi digitado.
function ConclusionCard({
  auditId,
  initial,
}: {
  auditId: string
  initial: string
}) {
  const qc = useQueryClient()
  const [text, setText] = useState(initial)
  const [lastSaved, setLastSaved] = useState(initial)
  const save = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from('audits')
        .update({ conclusion: value.trim() || null })
        .eq('id', auditId)
      if (error) throw error
      return value
    },
    onSuccess: (value) => {
      setLastSaved(value)
      // Atualiza o cache sem remontar o painel — o texto continua no lugar.
      qc.setQueryData(
        qk.audits.detail(auditId),
        (prev: { conclusion?: string | null } | undefined) =>
          prev ? { ...prev, conclusion: value.trim() || null } : prev
      )
    },
  })
  const { mutate: saveNow } = save

  useEffect(() => {
    if (text === lastSaved) return
    const t = setTimeout(() => saveNow(text), 1500)
    return () => clearTimeout(t)
  }, [text, lastSaved, saveNow])

  const saved = text === lastSaved
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conclusão geral</CardTitle>
        <CardDescription>
          Texto que fecha o relatório — aparece para o cliente e no PDF, em
          linguagem simples.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-2'>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Ex.: A análise do período indicou 3 pontos que precisam de ajuste. Recomendamos…'
          rows={4}
        />
        <div className='flex flex-wrap items-center gap-3'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => saveNow(text)}
            disabled={save.isPending || saved}
          >
            {save.isPending && <Loader2 className='size-4 animate-spin' />}
            Salvar conclusão
          </Button>
          <span aria-live='polite' className='text-xs text-muted-foreground'>
            {save.isPending
              ? 'Salvando…'
              : !saved
                ? 'Alterações não salvas — salvamos sozinhos em instantes.'
                : text !== initial
                  ? 'Salvo.'
                  : ''}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function RevisaoPanel({ auditId }: { auditId: string }) {
  const role = useAuthStore((s) => s.auth.role)
  const audit = useQuery(auditDetailQuery(auditId))
  const results = useQuery(inconsistenciesQuery(auditId))
  const transition = useTransitionAudit(auditId)

  if (audit.isLoading || results.isLoading)
    return <Skeleton className='h-40 w-full' />
  if (audit.isError || results.isError)
    return (
      <PanelErrorState
        onRetry={() => {
          void audit.refetch()
          void results.refetch()
        }}
      />
    )

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
              className='h-full bg-primary transition-[width]'
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

      <ConclusionCard auditId={auditId} initial={audit.data?.conclusion ?? ''} />

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
            <p className='flex items-center gap-2 text-sm text-success-text'>
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
