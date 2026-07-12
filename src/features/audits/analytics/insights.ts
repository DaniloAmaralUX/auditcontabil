// Veredito e insights do deck "O Fechamento" — lógica PURA por thresholds.
// Uma fonte só: capa, seções do deck e PDF compõem as MESMAS frases daqui.
// Voz de cliente: PT-BR plano, sem jargão, nunca inventar cifra sem dado.
import {
  brl,
  mesLabel,
  pct,
  type AnalyticsConta,
  type AnalyticsEmpresa,
  type AnalyticsGrupo,
  type AnalyticsPeriodo,
  type AnalyticsTopGrupoEmpresa,
  type AuditAnalytics,
} from './types'

/** Relabel de exibição: nomes de grupo do DB lidos em voz de keynote. */
const GROUP_LABELS: Record<string, string> = {
  'Pessoal/Admin': 'Pessoal e administrativo',
  Pessoal: 'Pessoal',
  Departamentais: 'Departamentais',
  Financeiras: 'Despesas financeiras',
  Tributárias: 'Despesas tributárias',
}
export function groupLabel(grupo: string): string {
  return GROUP_LABELS[grupo] ?? grupo
}

type Verdict = {
  tone: 'good' | 'attention' | 'critical'
  headline: string
}

/**
 * Veredito da capa — ladder de severidade (o mais grave vence):
 * 1. empresa Crítica · 2. resultado < 0 · 3. azul com ressalva (D/R > 95,
 * Deficitária ou pontos de atenção) · 4. tudo certo.
 * Sem analytics, decide só por `attention` (nunca inventa cifra).
 */
export function deriveVerdict(
  a: AuditAnalytics | null | undefined,
  attention: number
): Verdict {
  if (!a) {
    return attention === 0
      ? {
          tone: 'good',
          headline:
            'Está tudo certo: nenhum ponto precisa da sua atenção neste período.',
        }
      : {
          tone: 'attention',
          headline: `${attention} ponto${attention > 1 ? 's' : ''} deste período ${attention > 1 ? 'precisam' : 'precisa'} da sua atenção.`,
        }
  }
  const c = a.consolidado
  const critica = a.empresas.find((e) => e.status === 'Crítica')
  if (critica) {
    return c.resultado < 0
      ? {
          tone: 'critical',
          headline: `O grupo fechou no vermelho e a ${critica.nome} está em situação crítica.`,
        }
      : {
          tone: 'critical',
          headline: `O grupo fechou no azul, mas a ${critica.nome} está no vermelho e precisa de atenção.`,
        }
  }
  if (c.resultado < 0) {
    return {
      tone: 'critical',
      headline: `O grupo fechou no vermelho: as despesas superaram a receita em ${brl(Math.abs(c.resultado), true)}.`,
    }
  }
  const apertado =
    (c.despesa_receita_pct !== null && c.despesa_receita_pct > 95) ||
    a.empresas.some((e) => e.status === 'Deficitária') ||
    attention > 0
  if (apertado) {
    return {
      tone: 'attention',
      headline: `O grupo fechou no azul, mas apertado: sobraram ${brl(c.resultado, true)} depois de todas as despesas.`,
    }
  }
  return {
    tone: 'good',
    headline:
      'Está tudo certo: o grupo fechou no azul e nenhum ponto precisa da sua atenção.',
  }
}

/* ------------------------- Insights por seção ------------------------- */

export function dreInsight(c: AuditAnalytics['consolidado']): string {
  if (c.resultado < 0)
    return `As despesas passaram da receita: o período fechou ${brl(Math.abs(c.resultado), true)} no vermelho.`
  const dr = c.despesa_receita_pct
  if (dr !== null && dr > 95)
    return `As despesas consumiram ${pct(dr)} da receita líquida. Sobrou pouco: ${brl(c.resultado, true)}.`
  if (dr !== null)
    return `De cada R$ 100 que entraram, R$ ${Math.round(dr)} saíram em despesas.`
  return `O período fechou com resultado de ${brl(c.resultado, true)}.`
}

export function composicaoInsight(grupos: AnalyticsGrupo[]): string | null {
  if (grupos.length === 0) return null
  const [g1, g2] = grupos
  if (g1.pct !== null && g1.pct >= 60)
    return `${groupLabel(g1.grupo)} concentra ${pct(g1.pct)} das despesas.`
  if (g2 && g1.pct !== null && g2.pct !== null && g1.pct + g2.pct >= 65)
    return `${groupLabel(g1.grupo)} e ${groupLabel(g2.grupo)} concentram ${pct(g1.pct + g2.pct)} das despesas.`
  return `As despesas se espalham entre ${grupos.length} grupos, lideradas por ${groupLabel(g1.grupo)}${g1.pct !== null ? ` (${pct(g1.pct)})` : ''}.`
}

export function rankingInsight(empresas: AnalyticsEmpresa[]): string | null {
  if (empresas.length <= 1) return null
  const total = empresas.reduce((s, e) => s + e.despesas, 0)
  if (total <= 0) return null
  const e1 = [...empresas].sort((a, b) => b.despesas - a.despesas)[0]
  const share = (e1.despesas / total) * 100
  if (share >= 40)
    return `${e1.nome} responde por ${pct(share)} das despesas do grupo.`
  return `As despesas se dividem de forma equilibrada entre as ${empresas.length} empresas.`
}

export function resultadoInsight(empresas: AnalyticsEmpresa[]): string | null {
  if (empresas.length <= 1) return null
  const sorted = [...empresas].sort((a, b) => a.resultado - b.resultado)
  const worst = sorted[0]
  const best = sorted[sorted.length - 1]
  if (worst.resultado < 0)
    return `${worst.codigo} pressiona o grupo: ${brl(Math.abs(worst.resultado), true)} no vermelho — ${best.codigo} é quem sustenta, com ${brl(best.resultado, true)}.`
  return 'Todas as empresas fecharam no azul.'
}

export function contasInsight(contas: AnalyticsConta[]): string | null {
  if (contas.length === 0) return null
  const c1 = contas[0]
  if (c1.pct !== null && c1.pct >= 25)
    return `${c1.conta} sozinha responde por ${pct(c1.pct)} de todas as despesas.`
  const soma = contas.reduce((s, c) => s + (c.pct ?? 0), 0)
  return `As ${contas.length} maiores contas somam ${pct(soma)} das despesas.`
}

export function evolucaoInsight(periodos: AnalyticsPeriodo[]): string | null {
  if (periodos.length < 2) return null
  const first = periodos[0]
  const last = periodos[periodos.length - 1]
  if (first.resultado >= 0 && last.resultado < 0)
    return `O resultado virou negativo em ${mesLabel(last.mes)}.`
  if (last.resultado < first.resultado && first.resultado >= 0)
    return `A folga encolheu: de ${brl(first.resultado, true)} em ${mesLabel(first.mes)} para ${brl(last.resultado, true)} em ${mesLabel(last.mes)}.`
  if (last.resultado > first.resultado)
    return 'O resultado melhorou ao longo do período.'
  return 'O resultado se manteve estável no período.'
}

/**
 * "Onde cada empresa mais gasta" — colapsa a matriz grupo×empresa na maior
 * conta POR empresa (1 linha cada). Enriquecimento, não coluna vertebral.
 */
export function principalGastoPorEmpresa(
  top: AnalyticsTopGrupoEmpresa[]
): { empresa: string; conta: string; valor: number }[] {
  const byEmpresa = new Map<string, AnalyticsTopGrupoEmpresa>()
  for (const t of top) {
    const cur = byEmpresa.get(t.empresa)
    if (!cur || t.valor > cur.valor) byEmpresa.set(t.empresa, t)
  }
  return [...byEmpresa.values()]
    .sort((a, b) => b.valor - a.valor)
    .map((t) => ({ empresa: t.empresa, conta: t.conta, valor: t.valor }))
}
