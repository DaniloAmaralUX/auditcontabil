import { queryOptions, useQuery } from '@tanstack/react-query'
import { CreditCard, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type Subscription = {
  status: string
  trial_end: string | null
  current_period_end: string | null
  stripe_subscription_id: string | null
  trialDaysLeft: number | null
}

function subscriptionQuery() {
  return queryOptions({
    queryKey: qk.billing.subscription,
    queryFn: async (): Promise<Subscription | null> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, trial_end, current_period_end, stripe_subscription_id')
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      // derivado no fetch (não no render): dias restantes de trial
      const trialDaysLeft = data.trial_end
        ? Math.max(
            0,
            Math.ceil(
              (new Date(data.trial_end).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : null
      return { ...data, trialDaysLeft } as Subscription
    },
  })
}

const STATUS_LABEL: Record<string, string> = {
  trialing: 'Período de avaliação',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  unpaid: 'Não paga',
  paused: 'Pausada',
}

async function openPortal(fn: 'create-checkout-session' | 'customer-portal') {
  const body =
    fn === 'create-checkout-session'
      ? { price_id: import.meta.env.VITE_STRIPE_PRICE_ID ?? '' }
      : {}
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error || !data?.url) {
    toast.error(
      'A cobrança ainda não está configurada. Durante o piloto, o período de avaliação cobre o uso.'
    )
    return
  }
  window.location.href = data.url as string
}

export function Billing() {
  const { data, isLoading } = useQuery(subscriptionQuery())

  const trialDaysLeft = data?.trialDaysLeft ?? null

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-4'>
          <h1 className='text-2xl font-bold tracking-tight'>Faturamento</h1>
          <p className='text-muted-foreground'>
            Assinatura do escritório e forma de pagamento.
          </p>
        </div>

        {isLoading ? (
          <Skeleton className='h-40 w-full max-w-xl' />
        ) : (
          <Card className='max-w-xl'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <CreditCard className='size-5 text-muted-foreground' />
                Assinatura
              </CardTitle>
              <CardDescription>
                {data
                  ? 'Plano do escritório no Espaço Ação.'
                  : 'Nenhuma assinatura encontrada para este escritório.'}
              </CardDescription>
            </CardHeader>
            {data && (
              <CardContent className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <Badge variant='outline'>
                    {STATUS_LABEL[data.status] ?? data.status}
                  </Badge>
                  {data.status === 'trialing' && trialDaysLeft !== null && (
                    <span className='text-sm text-muted-foreground'>
                      {trialDaysLeft} dia(s) restante(s) de avaliação gratuita
                    </span>
                  )}
                </div>

                <div className='flex gap-2'>
                  {!data.stripe_subscription_id && (
                    <Button onClick={() => openPortal('create-checkout-session')}>
                      Assinar
                    </Button>
                  )}
                  {data.stripe_subscription_id && (
                    <Button
                      variant='outline'
                      onClick={() => openPortal('customer-portal')}
                    >
                      <ExternalLink className='size-4' /> Gerenciar pagamento
                    </Button>
                  )}
                </div>
                <p className='text-xs text-muted-foreground'>
                  Durante o piloto o uso é coberto pelo período de avaliação —
                  sem cartão de crédito.
                </p>
              </CardContent>
            )}
          </Card>
        )}
      </Main>
    </>
  )
}
