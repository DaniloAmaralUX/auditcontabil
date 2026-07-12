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
      <Badge variant='outline' className='gap-1 text-warning'>
        <TriangleAlert className='size-3.5' aria-hidden /> Precisa de atenção
      </Badge>
    )
  }
  if (severity === 'info') {
    return (
      <Badge variant='outline' className='gap-1 text-info'>
        <Info className='size-3.5' aria-hidden /> Informativo
      </Badge>
    )
  }
  return (
    <Badge variant='outline' className='gap-1 text-success'>
      <CircleCheck className='size-3.5' aria-hidden /> Está tudo certo
    </Badge>
  )
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
    <div className='mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-4 py-8'>
      <header className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Logo className='size-9' />
          <div className='leading-tight'>
            <div className='text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground'>
              ESPAÇO AÇÃO
            </div>
            <div className='font-bold'>{audit.cliente}</div>
          </div>
        </div>
        <div className='text-end text-sm text-muted-foreground'>
          {fmtPeriod(audit.period_start, audit.period_end)}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className='text-xl'>{audit.title}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          <p>
            Analisamos{' '}
            <strong className='tabular-nums'>
              {summary.processed.toLocaleString('pt-BR')}
            </strong>{' '}
            movimentos do período.{' '}
            {attention === 0
              ? 'Está tudo certo. Não encontramos pontos que precisem da sua atenção neste período.'
              : `${attention} ponto(s) precisam da sua atenção.`}
          </p>
          {summary.invalid > 0 && (
            <p className='text-sm text-muted-foreground'>
              Algumas linhas das planilhas enviadas não puderam ser lidas e não
              fazem parte desta análise. O escritório está cuidando desses
              casos.
            </p>
          )}
          {allowDownload && (
            <Suspense fallback={<Skeleton className='h-9 w-36' />}>
              <DownloadPdfButton snapshot={snapshot} />
            </Suspense>
          )}
        </CardContent>
      </Card>

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
                      <div className='text-xs text-muted-foreground'>{k}</div>
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

      <footer className='mt-auto pt-6 text-center text-xs text-muted-foreground'>
        Relatório publicado em{' '}
        {new Date(audit.published_at).toLocaleDateString('pt-BR')} · versão{' '}
        {audit.version}. Dúvidas? Fale com seu escritório de contabilidade.
      </footer>
    </div>
  )
}
