// Gera docs/fixtures/grupo-empresas-exemplo.xlsx — 1 aba por empresa (padrão
// real da contadora): receitas, deduções e despesas nos 3 grupos, 2 meses.
// Casos: 0101 superavitária · 0102 deficitária · 0103 crítica.
import * as XLSX from 'xlsx'
import { mkdirSync } from 'node:fs'

const HDR = ['Conta', 'Descrição', 'Data', 'Valor']

function empresa(receitas, despesas) {
  const rows = [HDR]
  for (const [conta, desc, data, valor] of [...receitas, ...despesas]) {
    rows.push([conta, desc, data, valor])
  }
  return rows
}

// 0101 — RÁDIO EXEMPLO FM (superavitária)
const e0101 = empresa(
  [
    ['3.1.01', 'Receita de Publicidade', '30/06/2026', '250.000,00'],
    ['3.1.02', 'Deduções de Impostos (ISS/PIS/COFINS)', '30/06/2026', '20.000,00'],
    ['3.1.01', 'Receita de Publicidade', '31/07/2026', '265.000,00'],
    ['3.1.02', 'Deduções de Impostos (ISS/PIS/COFINS)', '31/07/2026', '21.000,00'],
  ],
  [
    ['4.1.01', 'Salários e Ordenados', '30/06/2026', '95.000,00'],
    ['4.1.02', 'INSS', '30/06/2026', '22.000,00'],
    ['4.2.01', 'Energia Elétrica', '30/06/2026', '14.500,00'],
    ['4.2.02', 'Serviços Prest. Pessoa Jurídica', '30/06/2026', '31.000,00'],
    ['4.3.01', 'Juros e Encargos', '30/06/2026', '4.200,00'],
    ['4.1.01', 'Salários e Ordenados', '31/07/2026', '96.000,00'],
    ['4.1.02', 'INSS', '31/07/2026', '22.300,00'],
    ['4.2.01', 'Energia Elétrica', '31/07/2026', '15.100,00'],
    ['4.2.02', 'Serviços Prest. Pessoa Jurídica', '31/07/2026', '30.500,00'],
    ['4.3.01', 'Juros e Encargos', '31/07/2026', '3.900,00'],
  ]
)

// 0102 — TV EXEMPLO (deficitária: despesa ~110% da receita)
const e0102 = empresa(
  [
    ['3.1.01', 'Receita de Publicidade', '30/06/2026', '400.000,00'],
    ['3.1.02', 'Deduções de Impostos', '30/06/2026', '34.000,00'],
    ['3.1.01', 'Receita de Publicidade', '31/07/2026', '380.000,00'],
    ['3.1.02', 'Deduções de Impostos', '31/07/2026', '32.000,00'],
  ],
  [
    ['4.1.01', 'Salários e Ordenados', '30/06/2026', '210.000,00'],
    ['4.1.03', 'Provisão de Férias e Encargos', '30/06/2026', '58.000,00'],
    ['4.2.02', 'Serviços Prest. Pessoa Jurídica', '30/06/2026', '84.000,00'],
    ['4.2.03', 'Direitos Autorais', '30/06/2026', '26.000,00'],
    ['4.3.02', 'Tarifas Bancárias', '30/06/2026', '2.100,00'],
    ['4.1.01', 'Salários e Ordenados', '31/07/2026', '214.000,00'],
    ['4.1.03', 'Provisão de Férias e Encargos', '31/07/2026', '59.500,00'],
    ['4.2.02', 'Serviços Prest. Pessoa Jurídica', '31/07/2026', '99.000,00'],
    ['4.2.03', 'Direitos Autorais', '31/07/2026', '27.000,00'],
    ['4.3.02', 'Tarifas Bancárias', '31/07/2026', '2.300,00'],
  ]
)

// 0103 — GRÁFICA EXEMPLO (crítica: receita quase zero, despesa alta)
const e0103 = empresa(
  [
    ['3.1.01', 'Receita de Serviços Gráficos', '30/06/2026', '3.500,00'],
    ['3.1.01', 'Receita de Serviços Gráficos', '31/07/2026', '1.200,00'],
  ],
  [
    ['4.1.05', 'Indenizações e Aviso Prévio', '30/06/2026', '28.000,00'],
    ['4.3.01', 'Juros e Encargos', '30/06/2026', '6.400,00'],
    ['4.2.01', 'Energia Elétrica', '30/06/2026', '2.900,00'],
    ['4.1.05', 'Indenizações e Aviso Prévio', '31/07/2026', '9.000,00'],
    ['4.3.01', 'Juros e Encargos', '31/07/2026', '6.700,00'],
    ['4.2.01', 'Energia Elétrica', '31/07/2026', '2.850,00'],
  ]
)

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(e0101), '0101 RADIO EXEMPLO FM')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(e0102), '0102 TV EXEMPLO')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(e0103), '0103 GRAFICA EXEMPLO')
mkdirSync('docs/fixtures', { recursive: true })
XLSX.writeFile(wb, 'docs/fixtures/grupo-empresas-exemplo.xlsx')
console.log('fixture multi-empresa escrita')
