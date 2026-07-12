// Gera docs/fixtures/balancete-exemplo.xlsx com problemas intencionais para
// demonstrar as 7 regras: valores pt-BR (coerção), data inválida (linha preservada),
// débito≠crédito no período, variação atípica, conta nova, valor fora da curva.
import * as XLSX from 'xlsx'
import { mkdirSync } from 'node:fs'

const rows = [
  ['Conta', 'Nome da Conta', 'Data', 'Saldo Inicial', 'Débito', 'Crédito', 'Saldo Final'],
  // Junho — base equilibrada
  ['1.1.01', 'Caixa',            '05/06/2026', '10.000,00', '5.000,00', '3.000,00', '12.000,00'],
  ['1.1.02', 'Bancos',           '10/06/2026', '50.000,00', '8.000,00', '10.000,00', '48.000,00'],
  ['2.1.01', 'Fornecedores',     '15/06/2026', '20.000,00', '13.000,00', '13.000,00', '20.000,00'],
  ['3.1.01', 'Receita Serviços', '20/06/2026', '0,00', '0,00', '0,00', '0,00'],
  // Julho — problemas propositais
  ['1.1.01', 'Caixa',            '05/07/2026', '12.000,00', '40.000,00', '2.000,00', '50.000,00'], // variação atípica + equação
  ['1.1.02', 'Bancos',           '08/07/2026', '48.000,00', '1.000,00', '900,00', '48.100,00'],
  ['2.1.01', 'Fornecedores',     '12/07/2026', '20.000,00', '500,00', '700,00', '20.150,00'],      // equação não fecha (esperado 20.200)
  ['4.2.09', 'Despesas Diversas','15/07/2026', '0,00', '999.999,99', '0,00', '999.999,99'],        // conta NOVA + valor incomum
  ['1.1.01', 'Caixa',            'data-invalida', '1,00', '1,00', '1,00', '1,00'],                 // linha inválida (preservada)
  ['1.1.02', 'Bancos',           '08/07/2026', '48.000,00', '1.000,00', '900,00', '48.100,00'],    // duplicata
]

const ws = XLSX.utils.aoa_to_sheet(rows)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Balancete')
mkdirSync('docs/fixtures', { recursive: true })
XLSX.writeFile(wb, 'docs/fixtures/balancete-exemplo.xlsx')
console.log('fixture escrita em docs/fixtures/balancete-exemplo.xlsx')
