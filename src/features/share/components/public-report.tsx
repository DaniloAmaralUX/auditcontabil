// O deck "O Fechamento" — /r/:token como apresentação editorial: capa com
// veredito, DRE tipografada, gráficos com insight por seção e reveal-once.
// Composição declarativa de <DeckSection>; narrativa vem de insights.ts.
import { lazy, Suspense, useRef } from 'react'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CompanyRanking,
  CompanyResults,
  CompanyTable,
  GroupDonut,
  IncomeStatement,
  PeriodTrend,
  TopAccounts,
} from '@/features/audits/analytics/charts'
import {
  composicaoInsight,
  contasInsight,
  deriveSectionSummaries,
  dreInsight,
  evolucaoInsight,
  principalGastoPorEmpresa,
  resultadoInsight,
} from '@/features/audits/analytics/insights'
import { brl, hasAnalyticsData } from '@/features/audits/analytics/types'
import { type PublicSnapshot } from '../data/api'
import { fmtPeriod, fmtMoney, humanizeKey } from '../report-format'
import { DeckSection } from './deck/deck-section'
import { SummaryBlock } from './deck/summary-block'
import { useRevealOnScroll } from './deck/use-reveal-on-scroll'

const DownloadPdfButton = lazy(() =>
  import('./download-pdf-button').then((m) => ({
    default: m.DownloadPdfButton,
  }))
)

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

export function PublicReport({
  snapshot,
  allowDownload = true,
}: {
  snapshot: PublicSnapshot
  allowDownload?: boolean
}) {
  const { audit, summary, items } = snapshot
  const attention = items.length
  const a = hasAnalyticsData(snapshot.analytics) ? snapshot.analytics! : null
  const { performance, quality, review } = deriveSectionSummaries({
    analytics: a,
    counts: summary,
    reconciliation: snapshot.reconciliation ?? null,
    conclusion: audit.conclusion,
    attention,
  })
  const gastos = a ? principalGastoPorEmpresa(a.top_despesa_por_grupo) : []
  const deckRef = useRef<HTMLDivElement>(null)
  useRevealOnScroll(deckRef)

  return (
    <div className='min-h-svh'>
      <a
        href='#conteudo'
        className='sr-only rounded-md bg-background px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50'
      >
        Pular para o conteúdo
      </a>

      {/* Capa — a manchete é o DESEMPENHO; confiabilidade e conclusão
          profissional vêm em blocos próprios: são perguntas diferentes. */}
      <header className='border-b brand-mesh'>
        <div className='mx-auto flex max-w-2xl animate-rise flex-col gap-6 px-4 py-12 md:py-16'>
          <div className='flex items-center justify-between'>
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
          </div>

          <div className='space-y-2'>
            <p className='deck-eyebrow'>O Fechamento</p>
            <h1
              id='deck-title'
              className='text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl'
            >
              {performance.headline}
            </h1>
            <p className='text-lg text-muted-foreground'>{audit.title}</p>
          </div>

          <section
            aria-label='Resumo do período'
            className='grid gap-3 sm:grid-cols-3'
          >
            <SummaryBlock label='Resultado do período' summary={performance} />
            <SummaryBlock label='Confiabilidade dos dados' summary={quality} />
            <SummaryBlock label='Pontos que exigem revisão' summary={review} />
          </section>

          <div className='flex flex-wrap items-center gap-3'>
            {allowDownload && (
              <Suspense fallback={<Skeleton className='h-9 w-36' />}>
                <DownloadPdfButton snapshot={snapshot} />
              </Suspense>
            )}
          </div>
        </div>
      </header>

      <main
        id='conteudo'
        aria-labelledby='deck-title'
        ref={deckRef}
        className='deck-reveal mx-auto flex max-w-2xl flex-col gap-12 px-4 py-12 md:gap-20 md:py-20'
      >
        {a && (
          <DeckSection
            id='dre'
            eyebrow='O resultado'
            title='O que sobrou no fim do período'
            insight={dreInsight(a.consolidado)}
          >
            <IncomeStatement
              consolidado={a.consolidado}
              reconciliation={snapshot.reconciliation?.status}
            />
          </DeckSection>
        )}

        {a && a.por_grupo.length > 0 && (
          <DeckSection
            id='composicao'
            eyebrow='Composição'
            title='Para onde o dinheiro foi'
            insight={composicaoInsight(a.por_grupo)}
          >
            <GroupDonut
              grupos={a.por_grupo}
              title='Despesas por grupo'
              description='O total do período, dividido em grupos.'
            />
          </DeckSection>
        )}

        {a && a.empresas.length > 1 && (
          <DeckSection
            id='empresas'
            eyebrow='Por empresa'
            title='Quem sustenta e quem pressiona'
            insight={resultadoInsight(a.empresas)}
          >
            <div className='grid gap-4 lg:grid-cols-2'>
              <CompanyRanking
                empresas={a.empresas}
                title='Despesas por empresa'
                description='Onde o custo se concentra no grupo.'
              />
              <CompanyResults
                empresas={a.empresas}
                title='Resultado por empresa'
                description='Quem fechou no azul e quem precisa de atenção.'
              />
            </div>
            {gastos.length > 1 && (
              <p className='text-sm text-muted-foreground'>
                Onde cada empresa mais gasta —{' '}
                {gastos
                  .map((g) => `${g.empresa} ${g.conta} (${brl(g.valor, true)})`)
                  .join(' · ')}
                .
              </p>
            )}
          </DeckSection>
        )}

        {a && a.top_contas.length > 0 && (
          <DeckSection
            id='contas'
            eyebrow='Maiores despesas'
            title='As contas que mais pesaram'
            insight={contasInsight(a.top_contas)}
          >
            <TopAccounts
              contas={a.top_contas}
              title='Top contas do período'
              description='As despesas ordenadas pelo peso no total.'
            />
          </DeckSection>
        )}

        {a && a.por_periodo.length >= 2 && (
          <DeckSection
            id='evolucao'
            eyebrow='Mês a mês'
            title='Como receita e despesa evoluíram'
            insight={evolucaoInsight(a.por_periodo)}
          >
            <PeriodTrend
              periodos={a.por_periodo}
              title='Evolução no período'
              description='Receita líquida × despesas, mês a mês.'
            />
          </DeckSection>
        )}

        {a && a.empresas.length > 1 && (
          <DeckSection
            id='detalhe'
            eyebrow='O detalhe'
            title='Resumo por empresa'
          >
            <CompanyTable
              empresas={a.empresas}
              title='Detalhe por empresa'
              description='Os números de cada empresa do grupo.'
            />
          </DeckSection>
        )}

        {items.length > 0 && (
          <DeckSection
            id='atencao'
            eyebrow='Atenção'
            title='Pontos que precisam da sua atenção'
          >
            {items.map((item, i) => {
              const money = Object.entries(item.values ?? {})
                .map(([k, v]) => ({ k, money: fmtMoney(v) }))
                .filter((e) => e.money)
              return (
                <Card key={i}>
                  <CardHeader className='pb-2'>
                    {clientBadge(item.severity)}
                  </CardHeader>
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
          </DeckSection>
        )}

        {audit.conclusion && (
          <DeckSection
            id='conclusao'
            eyebrow='Para fechar'
            title='Conclusão do escritório'
          >
            <Card>
              <CardHeader className='sr-only'>
                <CardTitle>Conclusão do escritório</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm whitespace-pre-wrap'>
                  {audit.conclusion}
                </p>
              </CardContent>
            </Card>
          </DeckSection>
        )}

        <footer className='pt-2 text-center text-xs text-muted-foreground'>
          Relatório publicado em{' '}
          {new Date(audit.published_at).toLocaleDateString('pt-BR')} · versão{' '}
          {audit.version}. Dúvidas? Fale com{' '}
          {audit.escritorio ?? 'seu escritório de contabilidade'}.
        </footer>
      </main>
    </div>
  )
}
