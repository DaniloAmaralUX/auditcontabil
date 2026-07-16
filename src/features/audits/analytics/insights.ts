// Veredito e insights do deck "O Fechamento" — lógica PURA por thresholds.
// Uma fonte só: capa, seções do deck e PDF compõem as MESMAS frases daqui.
// Voz de cliente: PT-BR plano, sem jargão, nunca inventar cifra sem dado.
import {
  brl,
  brlExact,
  hasAnalyticsData,
  mesLabel,
  pct,
  type AnalyticsConta,
  type AnalyticsEmpresa,
  type AnalyticsGrupo,
  type AnalyticsPeriodo,
  type AnalyticsTopGrupoEmpresa,
  type AuditAnalytics,
  type ReconciliationSummary,
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

/* ------------------- Resumo em três camadas (capa/PDF) ------------------- */
// Desempenho, confiabilidade e conclusão profissional são perguntas
// DIFERENTES: lucro não prova demonstração correta, e prejuízo não prova
// erro. Cada camada tem a sua derivação — nenhuma rebaixa o tom da outra.

export type SectionTone = 'good' | 'attention' | 'critical' | 'neutral'

export type SectionSummary = {
  tone: SectionTone
  headline: string
  /** Versão curta para o bloco da capa (a manchete usa headline). */
  short?: string
  detail?: string
}

/** Concordância PT-BR: plural(2, 'linha', 'linhas') → 'linhas'. */
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

/**
 * Resultado do período — ladder: Crítica > resultado < 0 > apertado
 * (D/R > 95 ou Deficitária) > azul. Só desempenho: pontos de atenção
 * pertencem à conclusão profissional. Sem analytics → neutral, sem cifra.
 */
export function derivePerformanceSummary(
  a: AuditAnalytics | null | undefined
): SectionSummary {
  if (!a) {
    return {
      tone: 'neutral',
      headline:
        'Os números consolidados deste período não estão disponíveis neste relatório.',
      short: '—',
    }
  }
  const c = a.consolidado
  const short =
    c.resultado < 0
      ? `Déficit de ${brl(Math.abs(c.resultado), true)}`
      : `Superávit de ${brl(c.resultado, true)}`
  const critica = a.empresas.find((e) => e.status === 'Crítica')
  if (critica) {
    return c.resultado < 0
      ? {
          tone: 'critical',
          headline: `O grupo fechou no vermelho e a ${critica.nome} está em situação crítica.`,
          short,
        }
      : {
          tone: 'critical',
          headline: `O grupo fechou no azul, mas a ${critica.nome} está no vermelho e precisa de atenção.`,
          short,
        }
  }
  if (c.resultado < 0) {
    return {
      tone: 'critical',
      headline: `O grupo fechou no vermelho: as despesas superaram a receita em ${brl(Math.abs(c.resultado), true)}.`,
      short,
    }
  }
  const apertado =
    (c.despesa_receita_pct !== null && c.despesa_receita_pct > 95) ||
    a.empresas.some((e) => e.status === 'Deficitária')
  if (apertado) {
    return {
      tone: 'attention',
      headline: `O grupo fechou no azul, mas apertado: sobraram ${brl(c.resultado, true)} depois de todas as despesas.`,
      short,
    }
  }
  return {
    tone: 'good',
    headline: `O grupo fechou no azul: sobraram ${brl(c.resultado, true)} depois de todas as despesas.`,
    short,
  }
}

/**
 * Confiabilidade dos dados — linhas processadas + reconciliação REAL com o
 * documento. Snapshot antigo (sem reconciliation) fala só de leitura:
 * nunca alega conferência quando não houve.
 */
export function deriveDataQualitySummary(
  counts: { processed: number; invalid: number },
  reconciliation: ReconciliationSummary | null | undefined
): SectionSummary {
  const processed = counts.processed.toLocaleString('pt-BR')
  const invalidDetail =
    counts.invalid > 0
      ? `${counts.invalid} ${plural(counts.invalid, 'linha', 'linhas')} não ${plural(counts.invalid, 'pôde', 'puderam')} ser ${plural(counts.invalid, 'lida', 'lidas')} e não ${plural(counts.invalid, 'entra', 'entram')} nesta análise.`
      : undefined
  if (reconciliation?.status === 'reconciled') {
    return {
      tone: 'good',
      headline: `Conferimos ${processed} movimentos e os totais batem ao centavo com o documento enviado.`,
      short: 'Totais conferidos ao centavo',
      detail: invalidDetail,
    }
  }
  if (reconciliation?.status === 'divergent') {
    const broken = reconciliation.broken_checks
    const detail =
      reconciliation.calculated_amount !== null &&
      reconciliation.declared_amount !== null
        ? `Calculado ${brlExact(reconciliation.calculated_amount)} × declarado ${brlExact(reconciliation.declared_amount)}.`
        : invalidDetail
    return {
      tone: 'critical',
      headline: `Os totais calculados não batem com o documento enviado${broken > 0 ? ` — ${broken} ${plural(broken, 'totalizador', 'totalizadores')} ${plural(broken, 'diverge', 'divergem')}` : ''}.`,
      short: 'Totais divergem do documento',
      detail,
    }
  }
  // not_applicable ou snapshot antigo: só qualidade de leitura.
  return counts.invalid === 0
    ? {
        tone: 'good',
        headline: `Processamos ${processed} movimentos sem erros de leitura.`,
        short: `${processed} movimentos processados`,
      }
    : {
        tone: 'attention',
        headline: invalidDetail!,
        short: `${counts.invalid} ${plural(counts.invalid, 'linha', 'linhas')} sem leitura`,
      }
}

/**
 * Conclusão profissional — o que o escritório afirma após revisar. Todo
 * snapshot publicado é pós-aprovação humana (publish_audit exige
 * status = 'approved'), então aqui só modulamos itens × conclusão.
 */
export function deriveProfessionalConclusion(input: {
  conclusion: string | null | undefined
  attention: number
}): SectionSummary {
  const { conclusion, attention } = input
  if (attention > 0) {
    return {
      tone: 'attention',
      headline: `${attention} ${plural(attention, 'ponto', 'pontos')} deste período ${plural(attention, 'precisa', 'precisam')} da sua atenção.`,
      short: `${attention} ${plural(attention, 'ponto', 'pontos')} de atenção`,
    }
  }
  if (conclusion) {
    return {
      tone: 'good',
      headline:
        'O escritório revisou o período — a conclusão está ao final do relatório.',
      short: 'Revisado pelo escritório',
    }
  }
  return {
    tone: 'good',
    headline: 'Nenhum ponto exige a sua atenção neste período.',
    short: 'Nenhum ponto de atenção',
  }
}

/**
 * Fachada das três camadas — deck público, PDF e pré-visualização derivam
 * pelo MESMO caminho; mudar a composição acontece num lugar só. Aplica o
 * guard hasAnalyticsData internamente (aceita analytics cru ou já filtrado).
 */
export function deriveSectionSummaries(input: {
  analytics: AuditAnalytics | null | undefined
  counts: { processed: number; invalid: number }
  reconciliation: ReconciliationSummary | null | undefined
  conclusion: string | null | undefined
  attention: number
}): {
  performance: SectionSummary
  quality: SectionSummary
  review: SectionSummary
} {
  const a = hasAnalyticsData(input.analytics) ? input.analytics! : null
  return {
    performance: derivePerformanceSummary(a),
    quality: deriveDataQualitySummary(input.counts, input.reconciliation),
    review: deriveProfessionalConclusion({
      conclusion: input.conclusion,
      attention: input.attention,
    }),
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
