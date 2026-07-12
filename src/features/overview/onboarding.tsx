// Onboarding "Comece por aqui": checklist de 5 passos auto-checada pelo estado
// real (nunca reseta), boas-vindas one-time e — quando o loop está aprendido —
// "Continue de onde parou". Padrões: checklist 5 itens com progresso, primeiro
// passo fácil, dispensável, celebração ao completar, sem nag.
import { useEffect, useState } from 'react'
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { track } from '@/lib/track'
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

// Chaves escopadas por usuário — o mesmo dispositivo pode ter várias contas.
function lsKeys(userId: string) {
  const base = `auditview.onboarding.${userId}`
  return {
    welcome: `${base}.welcome`,
    dismissed: `${base}.dismissed`,
    celebrated: `${base}.celebrated`,
    tracked: `${base}.completed_tracked`,
  }
}

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
function lsRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* idem */
  }
}

/* -------------------------------- Componente ------------------------------ */

export function HomeOnboarding() {
  const userId = useAuthStore((s) => s.auth.userId) ?? 'anon'
  const K = lsKeys(userId)
  const clients = useQuery(clientsQuery())
  const audits = useQuery(auditsListQuery())
  const [dismissed, setDismissed] = useState(() => lsGet(K.dismissed))
  const [welcomed, setWelcomed] = useState(() => lsGet(K.welcome))
  const [celebrated, setCelebrated] = useState(() => lsGet(K.celebrated))

  // Mede a ativação assim que o ciclo fica completo (uma vez por usuário),
  // independente de por onde o usuário saiu.
  const clientCount = clients.data?.length ?? 0
  const auditsData = audits.data
  useEffect(() => {
    if (!auditsData) return
    const done = deriveOnboarding(clientCount, auditsData).complete
    if (done && !lsGet(K.tracked)) {
      lsSet(K.tracked)
      track('onboarding_completed')
    }
  }, [clientCount, auditsData, K.tracked])

  if (clients.isLoading || audits.isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-40' />
        <Skeleton className='h-24' />
      </div>
    )
  }
  if (clients.isError || audits.isError)
    return (
      <ContinueFallback
        onRetry={() => {
          void clients.refetch()
          void audits.refetch()
        }}
      />
    )

  const state = deriveOnboarding(clients.data?.length ?? 0, audits.data ?? [])
  const pending = auditsNeedingAction(audits.data ?? [])

  const handleDismiss = () => {
    lsSet(K.dismissed)
    setDismissed(true)
    track('onboarding_dismissed', { doneCount: state.doneCount })
  }

  // Loop aprendido (ou dispensado): a home vira "continue de onde parou".
  if (dismissed || (state.complete && celebrated)) {
    return (
      <ContinuePanel
        pending={pending}
        // Só quem dispensou sem completar pode reabrir o guia.
        onRestore={
          dismissed && !state.complete
            ? () => {
                lsRemove(K.dismissed)
                setDismissed(false)
              }
            : undefined
        }
      />
    )
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
              lsSet(K.celebrated)
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
        <section
          aria-labelledby='welcome-title'
          className='brand-mesh animate-rise relative overflow-hidden rounded-xl border px-6 py-10 md:px-10 md:py-14'
        >
          <p className='text-[0.7rem] font-bold tracking-[0.16em] text-muted-foreground uppercase'>
            Bem-vindo ao AuditView
          </p>
          <h2
            id='welcome-title'
            className='mt-3 max-w-2xl text-3xl leading-[1.05] font-bold tracking-tight text-balance md:text-4xl'
          >
            Transforme a planilha do cliente em{' '}
            <span className='text-gradient-brand'>uma auditoria visual</span>{' '}
            que ele entende.
          </h2>
          <p className='mt-4 max-w-xl text-base text-muted-foreground md:text-lg'>
            O checklist logo abaixo acompanha seu primeiro ciclo completo — do
            cadastro do cliente ao link de apresentação. Ele se marca sozinho
            conforme você avança.
          </p>
          <div className='mt-6 flex flex-wrap items-center gap-3'>
            <Button
              onClick={() => {
                lsSet(K.welcome)
                setWelcomed(true)
                track('onboarding_welcome_started')
              }}
            >
              <Sparkles className='size-4' /> Começar
            </Button>
            <Button
              variant='ghost'
              className='text-muted-foreground'
              onClick={handleDismiss}
            >
              Já conheço, pular
            </Button>
          </div>
        </section>
      )}

      <Card className='animate-rise'>
        <CardContent className='space-y-4 pt-6'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <h2 className='text-lg font-semibold'>Comece por aqui</h2>
            <span className='text-sm text-muted-foreground tabular-nums'>
              {state.doneCount} de {state.steps.length}
            </span>
          </div>

          <Progress
            aria-label='Progresso do primeiro ciclo'
            value={(state.doneCount / state.steps.length) * 100}
            className='h-1.5 bg-muted'
          />

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

          {/* welcomed=true = usuário já iniciou o guia, então o hero está
              oculto. Reoferecemos a saída "dispensar" aqui embaixo para não
              prender ninguém no checklist. */}
          {welcomed && (
            <div className='flex justify-end'>
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
                onClick={handleDismiss}
              >
                Já conheço, dispensar
              </Button>
            </div>
          )}
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

function ContinuePanel({
  pending,
  onRestore,
}: {
  pending: AuditListItem[]
  onRestore?: () => void
}) {
  const restoreButton = onRestore && (
    <div className='flex justify-center pt-1'>
      <Button
        variant='ghost'
        size='sm'
        className='text-muted-foreground'
        onClick={onRestore}
      >
        Rever o guia de primeiros passos
      </Button>
    </div>
  )
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
          {restoreButton}
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className='animate-rise'>
      <CardContent className='space-y-1 pt-6'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <h2 className='text-lg font-semibold'>Continue de onde parou</h2>
          <Button variant='ghost' size='sm' asChild>
            <Link to='/audits'>
              Ver todas <ArrowRight className='size-4' />
            </Link>
          </Button>
        </div>
        <ItemGroup className='divide-y'>
          {pending.slice(0, 5).map((a) => {
            const na = nextAction(a.status)
            return (
              <Item key={a.id} className='gap-3 px-0 py-2.5'>
                <ItemContent className='gap-0.5'>
                  <ItemTitle className='truncate'>
                    {a.title || 'Auditoria sem nome'}
                  </ItemTitle>
                  <ItemDescription className='truncate'>
                    {a.cliente_name}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className='gap-2'>
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
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
        {restoreButton}
      </CardContent>
    </Card>
  )
}

function ContinueFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardContent
        role='alert'
        className='flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground'
      >
        Não foi possível carregar seu resumo agora. Use o menu ao lado para
        navegar — nada foi perdido.
        <Button variant='outline' size='sm' onClick={onRetry}>
          Tentar de novo
        </Button>
      </CardContent>
    </Card>
  )
}
