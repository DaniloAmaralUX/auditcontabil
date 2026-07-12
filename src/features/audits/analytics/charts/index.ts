// Barrel dos blocos visuais do dashboard — compartilhados entre a aba
// interna e o deck do cliente (/r/:token). A pasta substitui o antigo
// charts.tsx sem churn nos consumidores (o import resolve para cá).
export { KpiHero } from './kpi-hero'
export { GroupDonut } from './group-donut'
export { CompanyRanking } from './company-ranking'
export { CompanyResults } from './company-results'
export { TopAccounts } from './top-accounts'
export { PeriodTrend } from './period-trend'
export { CompanyTable } from './company-table'
export { IncomeStatement } from './income-statement'
