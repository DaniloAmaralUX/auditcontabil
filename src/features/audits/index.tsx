import { Plus } from 'lucide-react'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { AuditCreateDialog } from './components/audit-create-dialog'
import { AuditsProvider, useAudits } from './components/audits-provider'
import { AuditsTable } from './components/audits-table'

function AuditsInner() {
  const { createOpen, setCreateOpen } = useAudits()
  const role = useAuthStore((s) => s.auth.role)

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Auditorias</h1>
            <p className='text-muted-foreground'>
              Crie, importe planilhas, revise e publique.
            </p>
          </div>
          {can(role ?? undefined, 'create_audit') && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Nova auditoria
            </Button>
          )}
        </div>

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
