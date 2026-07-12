// Despesas por empresa — bar horizontal com rótulo na ponta.
// aria-hidden: a CompanyTable (mesmos dados, tabela real) é o equivalente.
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
import { brl, type AnalyticsEmpresa } from '../types'

export function CompanyRanking({
  empresas,
  title = 'Despesas por empresa',
  description = 'Onde o custo do grupo se concentra.',
}: {
  empresas: AnalyticsEmpresa[]
  title?: string
  description?: string
}) {
  if (empresas.length <= 1) return null
  const data = empresas.slice(0, 8)
  const config: ChartConfig = {
    despesas: { label: 'Despesas', color: 'var(--chart-1)' },
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
            margin={{ left: 8, right: 48 }}
          >
            <XAxis type='number' hide />
            <YAxis
              type='category'
              dataKey='codigo'
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v) => brl(Number(v))}
                  labelFormatter={(codigo) =>
                    data.find((d) => d.codigo === codigo)?.nome ?? codigo
                  }
                />
              }
            />
            <Bar
              dataKey='despesas'
              fill='var(--color-despesas)'
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
      </CardContent>
    </Card>
  )
}
