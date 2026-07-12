import { Plus } from 'lucide-react'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { Main } from '@/components/layout/main'
import { PageHeader, PageTitle } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { AuditCreateDialog } from './components/audit-create-dialog'
import { AuditsProvider, useAudits } from './components/audits-provider'
import { AuditsTable } from './components/audits-table'

function AuditsInner() {
  const { createOpen, setCreateOpen } = useAudits()
  const role = useAuthStore((s) => s.auth.role)

  return (
    <>
      <PageHeader withSearch />

      <Main>
        <PageTitle
          title='Auditorias'
          description='Crie, importe planilhas, revise e publique.'
          action={
            can(role ?? undefined, 'create_audit') && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                Nova auditoria
              </Button>
            )
          }
        />

        <AuditsTable />
      </Main>

      <AuditCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}

export function Audits() {
  return (
    <AuditsProvider>
      <AuditsInner />
    </AuditsProvider>
  )
}
