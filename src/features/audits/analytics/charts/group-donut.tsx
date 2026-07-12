// Composição das despesas — donut com o TOTAL no centro (Pie Donut Text).
// A lista ao lado + a tabela sr-only são o equivalente textual completo.
import { Cell, Label, Pie, PieChart } from 'recharts'
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
import { brl, pct, type AnalyticsGrupo } from '../types'
import { PALETTE } from './palette'

export function GroupDonut({
  grupos,
  title = 'Composição das despesas',
  description = 'Para onde o dinheiro está indo, por grupo.',
}: {
  grupos: AnalyticsGrupo[]
  title?: string
  description?: string
}) {
  if (grupos.length === 0) return null
  const donutConfig: ChartConfig = { valor: { label: 'Valor' } }
  const total = grupos.reduce((s, g) => s + g.valor, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col items-center gap-4 sm:flex-row'>
        <ChartContainer
          config={donutConfig}
          aria-hidden='true'
          className='aspect-square size-44 shrink-0'
        >
          <PieChart>
            <Pie
              data={grupos}
              dataKey='valor'
              nameKey='grupo'
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke='var(--card)'
            >
              {grupos.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox)) return null
                  const { cx, cy } = viewBox as { cx: number; cy: number }
                  return (
                    <text x={cx} y={cy} textAnchor='middle'>
                      <tspan
                        x={cx}
                        y={cy - 4}
                        className='fill-foreground text-sm font-bold tabular-nums'
                      >
                        {brl(total, true)}
                      </tspan>
                      <tspan
                        x={cx}
                        y={cy + 12}
                        className='fill-muted-foreground text-[10px]'
                      >
                        despesas
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey='grupo'
                  hideLabel
                  formatter={(v) => brl(Number(v))}
                />
              }
            />
          </PieChart>
        </ChartContainer>
        <div className='min-w-40 flex-1 self-stretch'>
          <div className='mb-2 flex items-baseline justify-between border-b pb-2 text-sm'>
            <span className='text-muted-foreground'>Total das despesas</span>
            <span className='font-semibold tabular-nums'>{brl(total)}</span>
          </div>
          <ul className='space-y-2'>
            {grupos.map((g, i) => (
              <li key={g.grupo} className='flex items-center gap-2 text-sm'>
                <span
                  className='size-2.5 shrink-0 rounded-full'
                  style={{ background: PALETTE[i % PALETTE.length] }}
                  aria-hidden
                />
                <span className='flex-1 truncate'>{g.grupo}</span>
                <span className='font-medium tabular-nums'>
                  {brl(g.valor, true)}
                </span>
                <span className='w-12 text-end text-muted-foreground tabular-nums'>
                  {pct(g.pct)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
