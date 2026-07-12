// Shape do JSON de app.audit_analytics (RPC get_audit_analytics / snapshot.analytics).

export type AnalyticsConsolidado = {
  receita_bruta: number
  deducoes: number
  receita_liquida: number
  despesas: number
  resultado: number
  despesa_receita_pct: number | null
  margem_pct: number | null
}

export type AnalyticsGrupo = { grupo: string; valor: number; pct: number | null }

export type AnalyticsEmpresa = {
  codigo: string
  nome: string
  receita_liquida: number
  despesas: number
  resultado: number
  despesa_receita_pct: number | null
  status: 'Superavitária' | 'Deficitária' | 'Crítica'
}

export type AnalyticsConta = {
  conta: string
  codigo: string | null
  valor: number
  pct: number | null
}

export type AnalyticsTopGrupoEmpresa = {
  empresa: string
  grupo: string
  conta: string
  valor: number
}

export type AnalyticsPeriodo = {
  mes: string // YYYY-MM
  receita_liquida: number
  despesas: number
  resultado: number
}

export type AuditAnalytics = {
  consolidado: AnalyticsConsolidado
  por_grupo: AnalyticsGrupo[]
  empresas: AnalyticsEmpresa[]
  top_contas: AnalyticsConta[]
  top_despesa_por_grupo: AnalyticsTopGrupoEmpresa[]
  por_periodo: AnalyticsPeriodo[]
}

export function hasAnalyticsData(a: AuditAnalytics | null | undefined): boolean {
  if (!a) return false
  const c = a.consolidado
  return (c?.receita_bruta ?? 0) !== 0 || (c?.despesas ?? 0) !== 0
}

/** R$ 3,2 mi · R$ 540 mil · R$ 1.234 — compacto e legível em gráfico. */
export function brl(v: number | null | undefined, compact = false): string {
  if (v === null || v === undefined) return '—'
  if (compact) {
    const abs = Math.abs(v)
    if (abs >= 1_000_000)
      return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    if (abs >= 1_000)
      return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  }
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function mesLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${y.slice(2)}`
}
