// Veredito e insights do deck — as frases são contrato: capa, seções e PDF
// compõem as MESMAS strings daqui.
import { describe, expect, it } from 'vitest'
import {
  composicaoInsight,
  contasInsight,
  deriveVerdict,
  dreInsight,
  evolucaoInsight,
  groupLabel,
  principalGastoPorEmpresa,
  rankingInsight,
  resultadoInsight,
} from './insights'
import {
  type AnalyticsConsolidado,
  type AnalyticsEmpresa,
  type AuditAnalytics,
} from './types'

const consolidado = (over: Partial<AnalyticsConsolidado> = {}): AnalyticsConsolidado => ({
  receita_bruta: 1_073_096.61,
  deducoes: 56_658.69,
  receita_liquida: 1_016_437.92,
  despesas: 783_741.89,
  resultado: 232_696.03,
  despesa_receita_pct: 77.1,
  margem_pct: 22.9,
  ...over,
})

const empresa = (over: Partial<AnalyticsEmpresa>): AnalyticsEmpresa => ({
  codigo: '0089',
  nome: 'MATERIAIS MDW LTDA',
  receita_liquida: 1_016_437.92,
  despesas: 783_741.89,
  resultado: 232_696.03,
  despesa_receita_pct: 77.1,
  status: 'Superavitária',
  ...over,
})

const analytics = (over: Partial<AuditAnalytics> = {}): AuditAnalytics => ({
  consolidado: consolidado(),
  por_grupo: [],
  empresas: [empresa({})],
  top_contas: [],
  top_despesa_por_grupo: [],
  por_periodo: [],
  ...over,
})

describe('deriveVerdict — ladder de severidade', () => {
  it('sem analytics decide só por attention, nunca inventa cifra', () => {
    expect(deriveVerdict(null, 0).tone).toBe('good')
    const v = deriveVerdict(null, 2)
    expect(v.tone).toBe('attention')
    expect(v.headline).toContain('2 pontos')
  })

  it('empresa Crítica vence tudo', () => {
    const a = analytics({
      empresas: [
        empresa({}),
        empresa({ codigo: '0103', nome: 'Gráfica Exemplo', status: 'Crítica', resultado: -37000 }),
      ],
    })
    const v = deriveVerdict(a, 0)
    expect(v.tone).toBe('critical')
    expect(v.headline).toContain('Gráfica Exemplo')
    expect(v.headline).toContain('no azul, mas')
  })

  it('resultado negativo → vermelho com a cifra', () => {
    const a = analytics({ consolidado: consolidado({ resultado: -68000 }) })
    const v = deriveVerdict(a, 0)
    expect(v.tone).toBe('critical')
    expect(v.headline).toContain('no vermelho')
    expect(v.headline).toContain('R$ 68 mil')
  })

  it('D/R > 95 → azul apertado', () => {
    const a = analytics({
      consolidado: consolidado({ despesa_receita_pct: 98.3, resultado: 20000 }),
    })
    const v = deriveVerdict(a, 0)
    expect(v.tone).toBe('attention')
    expect(v.headline).toContain('apertado')
  })

  it('tudo certo quando saudável e sem pontos', () => {
    expect(deriveVerdict(analytics(), 0).tone).toBe('good')
  })
})

describe('insights por seção', () => {
  it('dreInsight: saudável fala em R$ 100', () => {
    expect(dreInsight(consolidado())).toContain('De cada R$ 100')
  })
  it('dreInsight: D/R > 95 avisa que sobrou pouco', () => {
    expect(
      dreInsight(consolidado({ despesa_receita_pct: 98.3, resultado: 20000 }))
    ).toContain('Sobrou pouco')
  })
  it('dreInsight: negativo fala em vermelho', () => {
    expect(dreInsight(consolidado({ resultado: -5000 }))).toContain('no vermelho')
  })

  it('composicaoInsight: concentração >=60% nomeia o grupo (com relabel)', () => {
    const s = composicaoInsight([
      { grupo: 'Pessoal/Admin', valor: 800, pct: 69 },
      { grupo: 'Financeiras', valor: 200, pct: 31 },
    ])
    expect(s).toContain('Pessoal e administrativo')
    expect(s).toContain('69%')
  })
  it('composicaoInsight: vazio → null; 1 grupo degrada sem quebrar', () => {
    expect(composicaoInsight([])).toBeNull()
    expect(
      composicaoInsight([{ grupo: 'Gerais', valor: 100, pct: 100 }])
    ).toContain('Gerais')
  })

  it('rankingInsight: share >=40% nomeia a empresa', () => {
    const s = rankingInsight([
      empresa({ codigo: '0102', nome: 'TV Exemplo', despesas: 782_000 }),
      empresa({ codigo: '0101', despesas: 390_000 }),
    ])
    expect(s).toContain('TV Exemplo')
  })
  it('rankingInsight: 1 empresa → null (seção some)', () => {
    expect(rankingInsight([empresa({})])).toBeNull()
  })

  it('resultadoInsight: pior no vermelho + quem sustenta', () => {
    const s = resultadoInsight([
      empresa({ codigo: '0101', resultado: 140_000 }),
      empresa({ codigo: '0102', resultado: -68_000 }),
    ])
    expect(s).toContain('0102 pressiona')
    expect(s).toContain('0101')
  })

  it('contasInsight: conta dominante >=25%', () => {
    const s = contasInsight([
      { conta: 'Salários e ordenados', codigo: null, valor: 615_000, pct: 52 },
    ])
    expect(s).toContain('Salários e ordenados')
    expect(s).toContain('52%')
  })

  it('evolucaoInsight: virada para o negativo aponta o mês', () => {
    const s = evolucaoInsight([
      { mes: '2026-06', receita_liquida: 100, despesas: 85, resultado: 15 },
      { mes: '2026-07', receita_liquida: 100, despesas: 110, resultado: -10 },
    ])
    expect(s).toContain('negativo em jul/26')
  })
  it('evolucaoInsight: folga encolhendo cita os dois meses', () => {
    const s = evolucaoInsight([
      { mes: '2026-06', receita_liquida: 100, despesas: 85, resultado: 15_000 },
      { mes: '2026-07', receita_liquida: 100, despesas: 95, resultado: 5_000 },
    ])
    expect(s).toContain('encolheu')
    expect(s).toContain('jun/26')
  })
  it('evolucaoInsight: < 2 meses → null', () => {
    expect(evolucaoInsight([])).toBeNull()
  })
})

describe('principalGastoPorEmpresa', () => {
  it('colapsa a matriz grupo×empresa na maior conta por empresa', () => {
    const out = principalGastoPorEmpresa([
      { empresa: '0101', grupo: 'Pessoal/Admin', conta: 'Salários', valor: 191_000 },
      { empresa: '0101', grupo: 'Financeiras', conta: 'Juros', valor: 12_000 },
      { empresa: '0102', grupo: 'Pessoal/Admin', conta: 'Salários', valor: 424_000 },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ empresa: '0102', conta: 'Salários' })
    expect(out[1]).toMatchObject({ empresa: '0101', valor: 191_000 })
  })
})

describe('groupLabel', () => {
  it('relabel de keynote sem tocar o DB', () => {
    expect(groupLabel('Pessoal/Admin')).toBe('Pessoal e administrativo')
    expect(groupLabel('Qualquer outro')).toBe('Qualquer outro')
  })
})
