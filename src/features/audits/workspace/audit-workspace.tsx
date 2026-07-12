import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { CompartilharPanel } from './panels/compartilhar-panel'
import { DadosPanel } from './panels/dados-panel'
import { DashboardPanel } from './panels/dashboard-panel'
import { InconsistenciasPanel } from './panels/inconsistencias-panel'
import { RelatorioPanel } from './panels/relatorio-panel'
import { ResumoPanel } from './panels/resumo-panel'
import { RevisaoPanel } from './panels/revisao-panel'

const TABS = [
  { value: 'dashboard', label: 'Dashboard' },
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
    // Painéis DENTRO do <Tabs>: aria-controls dos triggers aponta para
    // TabsContent reais (o Radix monta só a aba ativa — lazy preservado).
    <Tabs
      className='gap-4'
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

      <TabsContent value='dashboard'>
        <DashboardPanel auditId={auditId} />
      </TabsContent>
      <TabsContent value='resumo'>
        <ResumoPanel auditId={auditId} />
      </TabsContent>
      <TabsContent value='dados'>
        <DadosPanel auditId={auditId} />
      </TabsContent>
      <TabsContent value='inconsistencias'>
        <InconsistenciasPanel auditId={auditId} />
      </TabsContent>
      <TabsContent value='revisao'>
        <RevisaoPanel auditId={auditId} />
      </TabsContent>
      <TabsContent value='relatorio'>
        <RelatorioPanel auditId={auditId} />
      </TabsContent>
      <TabsContent value='compartilhar'>
        <CompartilharPanel auditId={auditId} />
      </TabsContent>
    </Tabs>
  )
}
