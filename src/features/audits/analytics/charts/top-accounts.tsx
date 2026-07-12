// Maiores despesas — bar horizontal real (mesma receita do ranking, coesão
// visual). Tabela sr-only carrega os nomes completos das contas.
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
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
import { brl, pct, type AnalyticsConta } from '../types'

const short = (s: string, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function TopAccounts({
  contas,
  title = 'Maiores despesas',
  description = 'As contas que mais pesam no período.',
}: {
  contas: AnalyticsConta[]
  title?: string
  description?: string
}) {
  if (contas.length === 0) return null
  const data = contas.slice(0, 8)
  const config: ChartConfig = {
    valor: { label: 'Valor', color: 'var(--chart-2)' },
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={config}
          aria-hidden='true'
          className='aspect-auto w-full'
          style={{ height: Math.max(180, data.length * 36) }}
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout='vertical'
            margin={{ left: 8, right: 52 }}
          >
            <XAxis type='number' hide />
            <YAxis
              type='category'
              dataKey='conta'
              width={118}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickFormatter={(v) => short(String(v))}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent formatter={(v) => brl(Number(v))} />
              }
            />
            <Bar
              dataKey='valor'
              fill='var(--color-valor)'
              radius={[0, 4, 4, 0]}
              label={{
                position: 'right',
                fill: 'var(--muted-foreground)',
                fontSize: 11,
                formatter: (v) => brl(Number(v ?? 0), true),
              }}
            />
          </BarChart>
        </ChartContainer>
        {/* Equivalente textual — nomes completos + participação. O sr-only vai
            no DIV: table layout trata width:1px como mínimo e a tabela "invisível"
            criava scroll horizontal em 375px. */}
        <div className='sr-only'>
        <table>
          <caption>{title} — contas, valores e participação</caption>
          <thead>
            <tr>
              <th scope='col'>Conta</th>
              <th scope='col'>Valor</th>
              <th scope='col'>Participação</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={`${c.conta}-${c.codigo}`}>
                <th scope='row'>{c.conta}</th>
                <td>{brl(c.valor)}</td>
                <td>{pct(c.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  )
}
