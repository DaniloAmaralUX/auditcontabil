// Blocos visuais do dashboard gerencial — compartilhados entre a aba interna
// e a visão do cliente (/r/:token). Elegância Ramp: neutros, acento contido,
// números tabulares, nada de decoração gratuita. Nunca só cor: rótulos sempre.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  brl,
  mesLabel,
  pct,
  type AnalyticsEmpresa,
  type AnalyticsGrupo,
  type AnalyticsConta,
  type AnalyticsPeriodo,
  type AuditAnalytics,
} from './types'

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

/* ---------------------------------- KPIs --------------------------------- */

export function KpiHero({ a }: { a: AuditAnalytics }) {
  const c = a.consolidado
  const negative = c.resultado < 0
  return (
    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
      <Kpi label='Receita líquida' value={brl(c.receita_liquida)} />
      <Kpi label='Despesas' value={brl(c.despesas)} />
      <Kpi
        label='Resultado'
        value={brl(c.resultado)}
        tone={negative ? 'bad' : 'good'}
        icon={negative ? TrendingDown : TrendingUp}
      />
      <Kpi
        label='Despesa / Receita'
        value={pct(c.despesa_receita_pct)}
        tone={
          c.despesa_receita_pct === null
            ? undefined
            : c.despesa_receita_pct > 100
              ? 'bad'
              : 'good'
        }
        hint={c.margem_pct !== null ? `margem ${pct(c.margem_pct)}` : undefined}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
  hint?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className='animate-rise gap-2 py-5'>
      <CardHeader className='pb-0'>
        <CardTitle className='text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase'>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className='flex items-center gap-1.5'>
        <span
          className={cn(
            'text-[1.7rem] leading-none font-bold tracking-tight tabular-nums',
            tone === 'bad' && 'text-destructive',
            tone === 'good' && 'text-success'
          )}
        >
          {value}
        </span>
        {Icon && (
          <Icon
            className={cn(
              'size-4 shrink-0',
              tone === 'bad' ? 'text-destructive' : 'text-success'
            )}
            aria-hidden
          />
        )}
        {hint && (
          <span className='ms-auto text-xs text-muted-foreground'>{hint}</span>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Composição ------------------------------- */

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-wrap items-center gap-4'>
        <div className='h-44 w-44 shrink-0'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={grupos}
                dataKey='valor'
                nameKey='grupo'
                innerRadius={48}
                outerRadius={80}
                paddingAngle={2}
                stroke='var(--card)'
              >
                {grupos.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => brl(Number(v))}
                contentStyle={tooltipStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className='min-w-40 flex-1 space-y-2'>
          {grupos.map((g, i) => (
            <li key={g.grupo} className='flex items-center gap-2 text-sm'>
              <span
                className='size-2.5 shrink-0 rounded-full'
                style={{ background: PALETTE[i % PALETTE.length] }}
                aria-hidden
              />
              <span className='flex-1 truncate'>{g.grupo}</span>
              <span className='font-medium tabular-nums'>{brl(g.valor, true)}</span>
              <span className='w-12 text-end text-muted-foreground tabular-nums'>
                {pct(g.pct)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/* ------------------------------- Rankings -------------------------------- */

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={Math.max(180, data.length * 36)}>
          <BarChart data={data} layout='vertical' margin={{ left: 8, right: 48 }}>
            <XAxis type='number' hide />
            <YAxis
              type='category'
              dataKey='codigo'
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <Tooltip
              formatter={(v) => brl(Number(v))}
              labelFormatter={(codigo) =>
                data.find((d) => d.codigo === codigo)?.nome ?? codigo
              }
              contentStyle={tooltipStyle}
            />
            <Bar
              dataKey='despesas'
              fill='var(--chart-1)'
              radius={[0, 4, 4, 0]}
              label={{
                position: 'right',
                fill: 'var(--muted-foreground)',
                fontSize: 11,
                formatter: (v) => brl(Number(v ?? 0), true),
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

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
  // ponta da barra: esquerda para negativos, direita para positivos
  const tx = neg ? (inside ? left + 6 : left - 6) : inside ? right - 6 : right + 6
  const anchor: 'start' | 'end' = neg === inside ? 'start' : 'end'
  return (
    <text
      x={tx}
      y={y + height / 2}
      dy={4}
      textAnchor={anchor}
      fontSize={11}
      fontWeight={inside ? 600 : 400}
      className='tabular-nums'
      fill={inside ? 'oklch(1 0 0)' : 'var(--muted-foreground)'}
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={Math.max(180, data.length * 34)}>
          <BarChart data={data} layout='vertical' margin={{ left: 8, right: 56 }}>
            <XAxis type='number' hide />
            <YAxis
              type='category'
              dataKey='codigo'
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <Tooltip
              formatter={(v) => brl(Number(v))}
              labelFormatter={(codigo) =>
                data.find((d) => d.codigo === codigo)?.nome ?? codigo
              }
              contentStyle={tooltipStyle}
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
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

/* ------------------------------- Top contas ------------------------------ */

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
  const max = contas[0]?.valor ?? 1
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className='space-y-2.5'>
          {contas.map((c) => (
            <li key={`${c.conta}-${c.codigo}`} className='space-y-1'>
              <div className='flex items-baseline justify-between gap-2 text-sm'>
                <span className='truncate'>{c.conta}</span>
                <span className='shrink-0 font-medium tabular-nums'>
                  {brl(c.valor, true)}
                  <span className='ms-2 text-xs text-muted-foreground'>
                    {pct(c.pct)}
                  </span>
                </span>
              </div>
              <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
                <div
                  className='h-full rounded-full'
                  style={{
                    width: `${Math.max(2, (c.valor / max) * 100)}%`,
                    background: 'var(--chart-2)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/* ------------------------------- Evolução -------------------------------- */

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={220}>
          <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
            <XAxis
              dataKey='mes'
              tickLine={false}
              axisLine={false}
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
            <Tooltip
              formatter={(v, name) => [
                brl(Number(v)),
                name === 'receita_liquida' ? 'Receita líquida' : 'Despesas',
              ]}
              contentStyle={tooltipStyle}
            />
            <Line
              type='monotone'
              dataKey='receita_liquida'
              stroke='var(--success)'
              strokeWidth={2.5}
              dot={{ r: 3 }}
              name='receita_liquida'
            />
            <Line
              type='monotone'
              dataKey='despesas'
              stroke='var(--chart-1)'
              strokeWidth={2.5}
              dot={{ r: 3 }}
              name='despesas'
            />
          </LineChart>
        </ResponsiveContainer>
        <div className='mt-1 flex gap-4 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1.5'>
            <span className='h-0.5 w-4 rounded' style={{ background: 'var(--success)' }} />
            Receita líquida
          </span>
          <span className='flex items-center gap-1.5'>
            <span className='h-0.5 w-4 rounded' style={{ background: 'var(--chart-1)' }} />
            Despesas
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/* --------------------------- Tabela por empresa -------------------------- */

function statusBadge(status: AnalyticsEmpresa['status']) {
  const map = {
    Superavitária: 'text-success',
    Deficitária: 'text-warning',
    Crítica: 'text-destructive',
  } as const
  return (
    <Badge variant='outline' className={map[status]}>
      {status}
    </Badge>
  )
}

export function CompanyTable({
  empresas,
  title = 'Detalhe por empresa',
  description = 'Receita, despesa e resultado de cada empresa do grupo.',
}: {
  empresas: AnalyticsEmpresa[]
  title?: string
  description?: string
}) {
  if (empresas.length <= 1) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='bg-muted/40'>
                <TableHead>Empresa</TableHead>
                <TableHead className='text-end'>Receita líq.</TableHead>
                <TableHead className='text-end'>Despesas</TableHead>
                <TableHead className='text-end'>Resultado</TableHead>
                <TableHead className='text-end'>D/R</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map((e) => (
                <TableRow key={e.codigo}>
                  <TableCell className='max-w-56'>
                    <span className='font-medium'>{e.codigo}</span>
                    {e.nome !== e.codigo && (
                      <span className='block truncate text-xs text-muted-foreground'>
                        {e.nome}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {brl(e.receita_liquida, true)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {brl(e.despesas, true)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-end font-medium tabular-nums',
                      e.resultado < 0 ? 'text-destructive' : 'text-success'
                    )}
                  >
                    {brl(e.resultado, true)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {pct(e.despesa_receita_pct)}
                  </TableCell>
                  <TableCell>{statusBadge(e.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
}
