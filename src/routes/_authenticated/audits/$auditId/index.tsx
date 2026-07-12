import { z } from 'zod'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { AuditHeader } from '@/features/audits/workspace/audit-header'
import { AuditWorkspace } from '@/features/audits/workspace/audit-workspace'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const workspaceSearchSchema = z.object({
  tab: z
    .enum(['resumo', 'dados', 'inconsistencias', 'revisao', 'relatorio', 'compartilhar'])
    .catch('resumo'),
})

function WorkspacePage() {
  const { auditId } = useParams({ from: '/_authenticated/audits/$auditId/' })
  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main>
        <AuditHeader auditId={auditId} />
        <div className='pt-4'>
          <AuditWorkspace auditId={auditId} />
        </div>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/audits/$auditId/')({
  validateSearch: zodValidator(workspaceSearchSchema),
  component: WorkspacePage,
})
