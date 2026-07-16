// Regressão do épico "separar desempenho, confiabilidade e conclusão":
// a capa mostra as TRÊS camadas, e o selo da DRE usa a reconciliação REAL do
// snapshot — nunca o proxy invalid === 0 (linha válida ≠ total reconciliado).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { type ReconciliationSummary } from '@/features/audits/analytics/types'
import { type PublicSnapshot } from '../data/api'
import { PublicReport } from './public-report'
import '@/styles/index.css'

const snapshot = (over: Partial<PublicSnapshot> = {}): PublicSnapshot => ({
  audit: {
    title: 'Fechamento Junho/2026',
    cliente: 'Cliente Exemplo',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    version: 1,
    conclusion: null,
    published_at: '2026-07-16T12:00:00Z',
    escritorio: 'Escritório Exemplo',
  },
  summary: { total_rows: 120, processed: 120, invalid: 0, ok: 120, coerced: 0 },
  items: [],
  analytics: {
    consolidado: {
      receita_bruta: 1_073_096.61,
      deducoes: 56_658.69,
      receita_liquida: 1_016_437.92,
      despesas: 783_741.89,
      resultado: 232_696.03,
      despesa_receita_pct: 77.1,
      margem_pct: 22.9,
    },
    por_grupo: [],
    empresas: [],
    top_contas: [],
    top_despesa_por_grupo: [],
    por_periodo: [],
  },
  ...over,
})

const reconciliation = (
  over: Partial<ReconciliationSummary> = {}
): ReconciliationSummary => ({
  status: 'reconciled',
  calculated_amount: 232_696.03,
  declared_amount: 232_696.03,
  broken_checks: 0,
  source: 'balancete-csv',
  documents: 1,
  ...over,
})

let host: HTMLDivElement | null = null
afterEach(() => {
  host?.remove()
  host = null
})

async function render(snap: PublicSnapshot) {
  host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(
    <StrictMode>
      <PublicReport snapshot={snap} allowDownload={false} />
    </StrictMode>
  )
  await new Promise((r) => setTimeout(r, 50))
}

describe('capa em três camadas', () => {
  it('manchete é o desempenho; os 3 blocos aparecem rotulados', async () => {
    await render(snapshot({ reconciliation: reconciliation() }))
    const h1 = host!.querySelector('#deck-title')!
    expect(h1.textContent).toContain('no azul')
    const text = host!.textContent!
    expect(text).toContain('Resultado do período')
    expect(text).toContain('Confiabilidade dos dados')
    expect(text).toContain('Pontos que exigem revisão')
  })
})

describe('selo da DRE usa a reconciliação real', () => {
  it('reconciled → selo "batem ao centavo"', async () => {
    await render(snapshot({ reconciliation: reconciliation() }))
    expect(host!.textContent).toContain('batem ao centavo')
  })

  it('snapshot legado (sem reconciliation) NÃO exibe selo, mesmo com invalid = 0', async () => {
    // O bug corrigido: invalid === 0 mostrava "batem ao centavo" sem
    // nenhuma conferência ter existido.
    await render(snapshot())
    expect(host!.textContent).not.toContain('batem ao centavo')
    // Bloco de confiabilidade fala só de leitura (short do not_applicable).
    expect(host!.textContent).toContain('120 movimentos processados')
  })

  it('divergent → alerta de divergência no lugar do selo', async () => {
    await render(
      snapshot({
        reconciliation: reconciliation({ status: 'divergent', broken_checks: 2 }),
      })
    )
    expect(host!.textContent).not.toContain('batem ao centavo')
    expect(host!.textContent).toContain('não batem com o documento')
  })
})
