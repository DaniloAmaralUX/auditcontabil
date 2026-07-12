// Regressão do dogfood: tabelas sr-only (equivalente textual dos gráficos)
// NÃO podem contribuir largura de layout. Table layout trata width:1px como
// mínimo, então `sr-only` direto na <table> criava 570px invisíveis e scroll
// horizontal em 375px — o sr-only tem que ficar num DIV embrulhando a tabela.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { PeriodTrend, TopAccounts } from './index'
// A medição depende da classe utilitária .sr-only real (Tailwind)
import '@/styles/index.css'

const CONTAS = [
  { conta: 'Custo Mercadoria Vendida - Cadernos e Materiais Escolares', codigo: '3.2.01', valor: 607834, pct: 77.6 },
  { conta: 'Honorários Contábeis', codigo: '3.7.03', valor: 32466, pct: 4.1 },
]
const PERIODOS = [
  { mes: '2026-06', receita_liquida: 100000, despesas: 85000, resultado: 15000 },
  { mes: '2026-07', receita_liquida: 100000, despesas: 95000, resultado: 5000 },
]

let host: HTMLDivElement | null = null
afterEach(() => {
  host?.remove()
  host = null
})

async function render(ui: React.ReactNode) {
  host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<StrictMode>{ui}</StrictMode>)
  await new Promise((r) => setTimeout(r, 50))
}

describe('tabelas sr-only não vazam largura (scroll fantasma em 375px)', () => {
  it('TopAccounts: o equivalente textual fica clipado a ~1px', async () => {
    await render(<TopAccounts contas={CONTAS} />)
    const wrapper = host!.querySelector('div.sr-only')
    expect(wrapper, 'sr-only deve estar num DIV, não na <table>').not.toBeNull()
    expect(wrapper!.querySelector('table')).not.toBeNull()
    expect(wrapper!.getBoundingClientRect().width).toBeLessThanOrEqual(8)
  })

  it('PeriodTrend: o equivalente textual fica clipado a ~1px', async () => {
    await render(<PeriodTrend periodos={PERIODOS} />)
    const wrapper = host!.querySelector('div.sr-only')
    expect(wrapper, 'sr-only deve estar num DIV, não na <table>').not.toBeNull()
    expect(wrapper!.getBoundingClientRect().width).toBeLessThanOrEqual(8)
  })
})
