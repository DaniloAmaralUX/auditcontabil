import { lazy, Suspense } from 'react'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CompanyRanking,
  CompanyResults,
  CompanyTable,
  GroupDonut,
  KpiHero,
  PeriodTrend,
  TopAccounts,
} from '@/features/audits/analytics/charts'
import { hasAnalyticsData } from '@/features/audits/analytics/types'
import { type PublicSnapshot } from '../data/api'

const DownloadPdfButton = lazy(() =>
  import('./download-pdf-button').then((m) => ({ default: m.DownloadPdfButton }))
)

function fmtPeriod(start: string | null, end: string | null) {
  if (!start || !end) return ''
  const f = (s: string) => s.split('-').reverse().join('/')
  return `${f(start)} a ${f(end)}`
}

// Voz do cliente (§10.2.14): sem jargão; 3 rótulos apenas.
function clientBadge(severity: string) {
  if (severity === 'divergence' || severity === 'attention') {
    return (
      <Badge variant='outline' className='gap-1 text-warning-text'>
        <TriangleAlert className='size-3.5' aria-hidden /> Precisa de atenção
      </Badge>
    )
  }
  if (severity === 'info') {
    return (
      <Badge variant='outline' className='gap-1 text-info-text'>
        <Info className='size-3.5' aria-hidden /> Informativo
      </Badge>
    )
  }
  return (
    <Badge variant='outline' className='gap-1 text-success-text'>
      <CircleCheck className='size-3.5' aria-hidden /> Está tudo certo
    </Badge>
  )
}

// Chaves internas das fórmulas nunca chegam cruas ao leigo.
const KEY_LABELS: Record<string, string> = {
  saldo_anterior: 'Saldo anterior',
  saldo_inicial: 'Saldo inicial',
  saldo_final: 'Saldo final',
  saldo_esperado: 'Saldo esperado',
  saldo_informado: 'Saldo informado',
  total_debitos: 'Total de débitos',
  total_creditos: 'Total de créditos',
  debito: 'Débito',
  credito: 'Crédito',
  diferenca: 'Diferença',
  valor: 'Valor',
}
function humanizeKey(k: string): string {
  if (KEY_LABELS[k]) return KEY_LABELS[k]
  const plain = k.replace(/_/g, ' ')
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

function fmtMoney(v: unknown): string | null {
  if (typeof v !== 'number') return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PublicReport({
  snapshot,
  allowDownload = true,
}: {
  snapshot: PublicSnapshot
  allowDownload?: boolean
}) {
  const { audit, summary, items } = snapshot
  const attention = items.length

  return (
    <div className='min-h-svh'>
      {/* Keynote hero — malha de marca, número em destaque, entrada suave */}
      <div className='brand-mesh border-b'>
        <div className='animate-rise mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10'>
          <header className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Logo className='size-9' />
              <div className='leading-tight'>
                <div className='text-[0.62rem] font-bold tracking-[0.16em] text-muted-foreground uppercase'>
                  {audit.escritorio ?? 'AuditView'}
                </div>
                <div className='font-bold'>{audit.cliente}</div>
              </div>
            </div>
            <div className='text-end text-sm text-muted-foreground'>
              {fmtPeriod(audit.period_start, audit.period_end)}
            </div>
          </header>

          <div className='space-y-1.5'>
            <p className='text-sm font-medium tracking-wide text-muted-foreground'>
              {audit.title}
            </p>
            <h1 className='text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl'>
              Analisamos{' '}
              <span className='text-gradient-brand tabular-nums'>
                {summary.processed.toLocaleString('pt-BR')}
              </span>{' '}
              movimentos.
            </h1>
            <p className='text-lg text-muted-foreground'>
              {attention === 0
                ? 'Está tudo certo — nenhum ponto precisa da sua atenção neste período.'
                : `${attention} ponto${attention > 1 ? 's' : ''} ${attention > 1 ? 'precisam' : 'precisa'} da sua atenção.`}
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            {allowDownload && (
              <Suspense fallback={<Skeleton className='h-9 w-36' />}>
                <DownloadPdfButton snapshot={snapshot} />
              </Suspense>
            )}
            {summary.invalid > 0 && (
              <span className='text-xs text-muted-foreground'>
                Algumas linhas não puderam ser lidas e não entram nesta análise —
                o escritório está tratando esses casos.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className='animate-rise-stagger mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8'>

      {hasAnalyticsData(snapshot.analytics) && (
        <section className='space-y-4'>
          <h2 className='text-lg font-semibold tracking-tight'>
            Os números do período
          </h2>
          <KpiHero a={snapshot.analytics!} />
          <GroupDonut
            grupos={snapshot.analytics!.por_grupo}
            title='Para onde o dinheiro foi'
            description='As despesas do período, agrupadas.'
          />
          <div className='grid gap-4 lg:grid-cols-2'>
            <CompanyRanking
              empresas={snapshot.analytics!.empresas}
              title='Despesas por empresa'
              description='Onde o custo se concentra no grupo.'
            />
            <CompanyResults
              empresas={snapshot.analytics!.empresas}
              title='Resultado por empresa'
              description='Quem fechou no azul e quem precisa de atenção.'
            />
          </div>
          <TopAccounts
            contas={snapshot.analytics!.top_contas}
            title='Maiores despesas'
            description='As contas que mais pesaram no período.'
          />
          <PeriodTrend
            periodos={snapshot.analytics!.por_periodo}
            title='Evolução mês a mês'
            description='Receita e despesas ao longo do período.'
          />
          <CompanyTable
            empresas={snapshot.analytics!.empresas}
            title='Resumo por empresa'
            description='Os números de cada empresa do grupo.'
          />
        </section>
      )}

      {items.length > 0 && (
      <section className='space-y-4'>
        <h2 className='text-lg font-semibold tracking-tight'>
          Pontos que precisam da sua atenção
        </h2>

      {items.map((item, i) => {
        const money = Object.entries(item.values ?? {})
          .map(([k, v]) => ({ k, money: fmtMoney(v) }))
          .filter((e) => e.money)
        return (
          <Card key={i}>
            <CardHeader className='pb-2'>{clientBadge(item.severity)}</CardHeader>
            <CardContent className='space-y-2 text-sm'>
              <p className='text-base'>{item.message}</p>
              {money.length > 0 && (
                <div className='grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-3'>
                  {money.slice(0, 6).map(({ k, money: m }) => (
                    <div key={k}>
                      <div className='text-xs text-muted-foreground'>
                        {humanizeKey(k)}
                      </div>
                      <div className='font-medium tabular-nums'>{m}</div>
                    </div>
                  ))}
                </div>
              )}
              {item.note && (
                <p className='rounded-md border-s-2 border-primary/40 ps-3 text-muted-foreground'>
                  {item.note}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
      </section>
      )}

      {audit.conclusion && (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Conclusão do escritório</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm whitespace-pre-wrap'>{audit.conclusion}</p>
          </CardContent>
        </Card>
      )}

        <footer className='pt-6 text-center text-xs text-muted-foreground'>
          Relatório publicado em{' '}
          {new Date(audit.published_at).toLocaleDateString('pt-BR')} · versão{' '}
          {audit.version}. Dúvidas? Fale com{' '}
          {audit.escritorio ?? 'seu escritório de contabilidade'}.
        </footer>
      </div>
    </div>
  )
}
