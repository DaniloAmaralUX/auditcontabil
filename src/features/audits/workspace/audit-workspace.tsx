import { useNavigate, useSearch } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompartilharPanel } from './panels/compartilhar-panel'
import { DadosPanel } from './panels/dados-panel'
import { InconsistenciasPanel } from './panels/inconsistencias-panel'
import { RelatorioPanel } from './panels/relatorio-panel'
import { ResumoPanel } from './panels/resumo-panel'
import { RevisaoPanel } from './panels/revisao-panel'

const TABS = [
  { value: 'resumo', label: 'Resumo' },
  { value: 'dados', label: 'Dados' },
  { value: 'inconsistencias', label: 'Inconsistências' },
  { value: 'revisao', label: 'Revisão' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'compartilhar', label: 'Compartilhar' },
] as const

type WorkspaceTab = (typeof TABS)[number]['value']

export function AuditWorkspace({ auditId }: { auditId: string }) {
  const { tab } = useSearch({ from: '/_authenticated/audits/$auditId/' })
  const navigate = useNavigate({ from: '/audits/$auditId' })

  return (
    <div className='space-y-4'>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({ search: (prev) => ({ ...prev, tab: value as WorkspaceTab }) })
        }
      >
        <TabsList className='w-full justify-start overflow-x-auto'>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'resumo' && <ResumoPanel auditId={auditId} />}
      {tab === 'dados' && <DadosPanel auditId={auditId} />}
      {tab === 'inconsistencias' && <InconsistenciasPanel auditId={auditId} />}
      {tab === 'revisao' && <RevisaoPanel auditId={auditId} />}
      {tab === 'relatorio' && <RelatorioPanel auditId={auditId} />}
      {tab === 'compartilhar' && <CompartilharPanel auditId={auditId} />}
    </div>
  )
}
