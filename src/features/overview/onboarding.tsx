// Onboarding "Comece por aqui": checklist de 5 passos auto-checada pelo estado
// real (nunca reseta), boas-vindas one-time e — quando o loop está aprendido —
// "Continue de onde parou". Padrões: checklist 5 itens com progresso, primeiro
// passo fácil, dispensável, celebração ao completar, sem nag.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CircleCheck,
  PartyPopper,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { clientsQuery } from '@/features/clients/data/queries'
import { auditsListQuery } from '../audits/data/queries'
import { type AuditListItem } from '../audits/data/schema'
import { AuditStatusBadge } from '../audits/components/status-badge'
import { nextAction } from '../audits/components/next-action'
import {
  auditsNeedingAction,
  deriveOnboarding,
  type OnboardingStep,
} from './onboarding-logic'

/* ------------------------------ Persistência ------------------------------ */

const LS_WELCOME = 'auditview.onboarding.welcome'
const LS_DISMISSED = 'auditview.onboarding.dismissed'
const LS_CELEBRATED = 'auditview.onboarding.celebrated'

function lsGet(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function lsSet(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* sem storage, sem persistência — segue o fluxo */
  }
}

/* -------------------------------- Componente ------------------------------ */

export function HomeOnboarding() {
  const clients = useQuery(clientsQuery())
  const audits = useQuery(auditsListQuery())
  const [dismissed, setDismissed] = useState(() => lsGet(LS_DISMISSED))
  const [welcomed, setWelcomed] = useState(() => lsGet(LS_WELCOME))
  const [celebrated, setCelebrated] = useState(() => lsGet(LS_CELEBRATED))

  if (clients.isLoading || audits.isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-40' />
        <Skeleton className='h-24' />
      </div>
    )
  }
  if (clients.isError || audits.isError) return <ContinueFallback />

  const state = deriveOnboarding(clients.data?.length ?? 0, audits.data ?? [])
  const pending = auditsNeedingAction(audits.data ?? [])

  // Loop aprendido (ou dispensado): a home vira "continue de onde parou".
  if (dismissed || (state.complete && celebrated)) {
    return <ContinuePanel pending={pending} />
  }

  if (state.complete) {
    return (
      <Card className='animate-rise'>
        <CardContent className='flex flex-col items-center gap-3 py-10 text-center'>
          <PartyPopper className='size-8 text-brand' aria-hidden />
          <div>
            <p className='text-lg font-semibold'>
              Você completou o ciclo inteiro!
            </p>
            <p className='text-sm text-muted-foreground'>
              Cliente, auditoria, dashboard, revisão e publicação — daqui em
              diante é só repetir o caminho.
            </p>
          </div>
          <Button
            onClick={() => {
              lsSet(LS_CELEBRATED)
              setCelebrated(true)
            }}
          >
            Começar a próxima <ArrowRight className='size-4' />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-4'>
      {!welcomed && (
        <div className='brand-mesh animate-rise relative overflow-hidden rounded-xl border p-6'>
          <p className='text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase'>
            Bem-vindo ao AuditView
          </p>
          <h2 className='mt-1 max-w-xl text-xl leading-snug font-bold tracking-tight text-balance'>
            Transforme a planilha do cliente em uma auditoria visual:{' '}
            <span className='text-gradient-brand'>
              importe, revise, compartilhe.
            </span>
          </h2>
          <p className='mt-1 max-w-xl text-sm text-muted-foreground'>
            O checklist abaixo acompanha seu primeiro ciclo completo. Ele se
            marca sozinho conforme você avança.
          </p>
          <Button
            size='sm'
            className='mt-4'
            onClick={() => {
              lsSet(LS_WELCOME)
              setWelcomed(true)
            }}
          >
            <Sparkles className='size-4' /> Começar
          </Button>
        </div>
      )}

      <Card className='animate-rise'>
        <CardContent className='space-y-4 pt-6'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <h2 className='font-semibold'>Comece por aqui</h2>
            <span className='text-sm text-muted-foreground tabular-nums'>
              {state.doneCount} de {state.steps.length}
            </span>
          </div>

          <div
            role='progressbar'
            aria-label='Progresso do primeiro ciclo'
            aria-valuemin={0}
            aria-valuemax={state.steps.length}
            aria-valuenow={state.doneCount}
            className='h-1.5 overflow-hidden rounded-full bg-muted'
          >
            <div
              className='h-full rounded-full bg-brand transition-all duration-500'
              style={{
                width: `${(state.doneCount / state.steps.length) * 100}%`,
              }}
            />
          </div>

          <ol className='space-y-1'>
            {state.steps.map((step, i) => {
              const active = i === state.activeIndex
              return (
                <li
                  key={step.key}
                  className={cn(
                    'flex items-start gap-3 rounded-lg p-2.5',
                    active && 'bg-muted/50'
                  )}
                >
                  {step.done ? (
                    <CircleCheck
                      className='mt-0.5 size-5 shrink-0 text-success'
                      aria-hidden
                    />
                  ) : (
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                        active
                          ? 'border-brand text-brand'
                          : 'text-muted-foreground'
                      )}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                  )}
                  <div className='min-w-0 flex-1'>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        step.done && 'text-muted-foreground'
                      )}
                    >
                      {step.title}
                      {step.done && <span className='sr-only'> — feito</span>}
                    </p>
                    {active && (
                      <p className='text-sm text-muted-foreground'>
                        {step.hint}
                      </p>
                    )}
                  </div>
                  {active && (
                    <StepCta step={step.key} audits={audits.data ?? []} />
                  )}
                </li>
              )
            })}
          </ol>

          <div className='flex justify-end'>
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground'
              onClick={() => {
                lsSet(LS_DISMISSED)
                setDismissed(true)
              }}
            >
              Já conheço, dispensar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** CTA do passo ativo — leva direto para a ação, não para uma explicação. */
function StepCta({
  step,
  audits,
}: {
  step: OnboardingStep['key']
  audits: AuditListItem[]
}) {
  if (step === 'client') {
    return (
      <Button size='sm' asChild>
        <Link to='/clients'>
          <Users className='size-4' /> Cadastrar
        </Link>
      </Button>
    )
  }
  if (step === 'audit') {
    return (
      <Button size='sm' asChild>
        <Link to='/audits'>Criar auditoria</Link>
      </Button>
    )
  }
  if (step === 'import') {
    const target = audits.find((a) =>
      ['draft', 'awaiting_files', 'awaiting_mapping'].includes(a.status)
    )
    if (target) {
      return (
        <Button size='sm' asChild>
          <Link to='/audits/$auditId/import' params={{ auditId: target.id }}>
            <Upload className='size-4' /> Importar
          </Link>
        </Button>
      )
    }
  }
  // review/publish: a próxima ação certa por auditoria já existe — reusa.
  const target = audits.find((a) =>
    step === 'review'
      ? ['processed', 'in_review'].includes(a.status)
      : a.status === 'approved'
  )
  if (target) {
    const na = nextAction(target.status)
    return (
      <Button size='sm' asChild>
        <Link
          to='/audits/$auditId'
          params={{ auditId: target.id }}
          search={{ tab: na.tab ?? 'resumo' }}
        >
          {na.label}
        </Link>
      </Button>
    )
  }
  return (
    <Button size='sm' variant='outline' asChild>
      <Link to='/audits'>Ver auditorias</Link>
    </Button>
  )
}

/* --------------------------- Continue de onde parou ----------------------- */

function ContinuePanel({ pending }: { pending: AuditListItem[] }) {
  if (pending.length === 0) {
    return (
      <Card className='animate-rise'>
        <CardContent className='flex flex-col items-center gap-2 py-10 text-center'>
          <CircleCheck className='size-7 text-success' aria-hidden />
          <p className='font-medium'>Tudo em dia.</p>
          <p className='text-sm text-muted-foreground'>
            Nenhuma auditoria esperando por você agora.
          </p>
          <Button size='sm' className='mt-2' asChild>
            <Link to='/audits'>Nova auditoria</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className='animate-rise'>
      <CardContent className='space-y-1 pt-6'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <h2 className='font-semibold'>Continue de onde parou</h2>
          <Button variant='ghost' size='sm' asChild>
            <Link to='/audits'>
              Ver todas <ArrowRight className='size-4' />
            </Link>
          </Button>
        </div>
        <ul className='divide-y'>
          {pending.slice(0, 5).map((a) => {
            const na = nextAction(a.status)
            return (
              <li
                key={a.id}
                className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5'
              >
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>
                    {a.title || 'Auditoria sem nome'}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {a.cliente_name}
                  </p>
                </div>
                <AuditStatusBadge status={a.status} />
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
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function ContinueFallback() {
  return (
    <Card>
      <CardContent className='py-8 text-center text-sm text-muted-foreground'>
        Não foi possível carregar seu resumo agora. Use o menu ao lado para
        navegar — nada foi perdido.
      </CardContent>
    </Card>
  )
}
