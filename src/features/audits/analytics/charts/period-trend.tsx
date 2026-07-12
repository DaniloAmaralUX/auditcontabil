// Evolução mês a mês — área com gradiente (peso de "história do período").
// Receita = traço cheio; despesa = tracejada (nunca só cor). Tabela sr-only.
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { brl, mesLabel, type AnalyticsPeriodo } from '../types'

export function PeriodTrend({
  periodos,
  title = 'Evolução no período',
  description = 'Receita líquida × despesas, mês a mês.',
}: {
  periodos: AnalyticsPeriodo[]
  title?: string
  description?: string
}) {
  if (periodos.length < 2) return null
  const data = periodos.map((p) => ({ ...p, mes: mesLabel(p.mes) }))
  const config: ChartConfig = {
    receita_liquida: { label: 'Receita líquida', color: 'var(--success)' },
    despesas: { label: 'Despesas', color: 'var(--chart-1)' },
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className='aspect-auto h-[220px] w-full'>
          <AreaChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
            <defs>
              <linearGradient id='fillReceita' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='var(--success)' stopOpacity={0.22} />
                <stop offset='95%' stopColor='var(--success)' stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id='fillDespesas' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='var(--chart-1)' stopOpacity={0.18} />
                <stop offset='95%' stopColor='var(--chart-1)' stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
            <XAxis
              dataKey='mes'
              tickLine={false}
              axisLine={false}
              interval='preserveStartEnd'
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              domain={[0, (max: number) => Math.round(max * 1.15)]}
              tickFormatter={(v) => brl(v, true).replace('R$ ', '')}
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => brl(Number(v))} />}
            />
            <Area
              type='monotone'
              dataKey='receita_liquida'
              stroke='var(--color-receita_liquida)'
              strokeWidth={2.5}
              fill='url(#fillReceita)'
              dot={{ r: 3 }}
              name='receita_liquida'
            />
            <Area
              type='monotone'
              dataKey='despesas'
              stroke='var(--color-despesas)'
              strokeWidth={2.5}
              strokeDasharray='6 3'
              fill='url(#fillDespesas)'
              dot={{ r: 3 }}
              name='despesas'
            />
          </AreaChart>
        </ChartContainer>
        {/* Legenda: cor + padrão de traço (não só cor) para daltônicos */}
        <div className='mt-1 flex gap-4 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1.5'>
            <span className='h-0.5 w-4 rounded' style={{ background: 'var(--success)' }} />
            Receita líquida (linha cheia)
          </span>
          <span className='flex items-center gap-1.5'>
            <span
              className='h-0 w-4'
              style={{ borderTop: '2px dashed var(--chart-1)' }}
            />
            Despesas (tracejada)
          </span>
        </div>
        {/* Equivalente textual do gráfico para leitores de tela. O sr-only vai
            no DIV: table layout trata width:1px como mínimo (scroll fantasma). */}
        <div className='sr-only'>
        <table>
          <caption>{title} — valores mensais</caption>
          <thead>
            <tr>
              <th scope='col'>Mês</th>
              <th scope='col'>Receita líquida</th>
              <th scope='col'>Despesas</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.mes}>
                <th scope='row'>{p.mes}</th>
                <td>{brl(p.receita_liquida)}</td>
                <td>{brl(p.despesas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  )
}
