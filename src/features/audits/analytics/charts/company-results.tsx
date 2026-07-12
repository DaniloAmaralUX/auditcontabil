// Resultado por empresa — bar divergente do zero (quem sustenta × pressiona).
// aria-hidden: a CompanyTable (mesmos dados + Situação) é o equivalente.
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
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

// Rótulo do gráfico divergente, sempre na PONTA da barra: dentro dela quando é
// larga (texto claro sobre a cor), fora quando é curta (texto muted). Nota:
// para valores negativos a recharts entrega x no eixo zero e width negativo —
// por isso a geometria é normalizada antes de posicionar.
function ResultBarLabel(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number
}) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props
  const left = Math.min(x, x + width)
  const right = Math.max(x, x + width)
  const neg = value < 0
  const inside = Math.abs(width) >= 64
  // Dentro: na ponta da barra (esq p/ negativo, dir p/ positivo). Fora: sempre
  // à DIREITA do eixo zero — o lado da barra negativa é o dos códigos do eixo,
  // e em viewports estreitos o rótulo colidia com eles.
  const tx = neg ? (inside ? left + 6 : right + 6) : inside ? right - 6 : right + 6
  const anchor: 'start' | 'end' = inside && !neg ? 'end' : 'start'
  return (
    <text
      x={tx}
      y={y + height / 2}
      dy={4}
      textAnchor={anchor}
      fontSize={11}
      fontWeight={inside ? 600 : 400}
      className='tabular-nums'
      // Escuro fixo: as barras são médias/claras nos DOIS temas (L 0.585–0.72),
      // então texto escuro rende >=4.7:1 no pior caso; branco não passava.
      fill={inside ? 'oklch(0.145 0 0)' : 'var(--muted-foreground)'}
    >
      {brl(value, true)}
    </text>
  )
}

export function CompanyResults({
  empresas,
  title = 'Resultado por empresa',
  description = 'Quem sustenta e quem pressiona o grupo.',
}: {
  empresas: AnalyticsEmpresa[]
  title?: string
  description?: string
}) {
  if (empresas.length <= 1) return null
  const data = [...empresas]
    .sort((a, b) => a.resultado - b.resultado)
    .slice(0, 10)
  const config: ChartConfig = { resultado: { label: 'Resultado' } }
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
          style={{ height: Math.max(180, data.length * 34) }}
        >
          <BarChart
            accessibilityLayer
            data={data}
            layout='vertical'
            margin={{ left: 8, right: 56 }}
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
              dataKey='resultado'
              radius={[0, 4, 4, 0]}
              label={<ResultBarLabel />}
            >
              {data.map((d) => (
                <Cell
                  key={d.codigo}
                  fill={d.resultado < 0 ? 'var(--destructive)' : 'var(--success)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
