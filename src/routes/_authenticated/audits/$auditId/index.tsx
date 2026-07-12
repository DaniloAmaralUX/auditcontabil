import { z } from 'zod'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { AuditHeader } from '@/features/audits/workspace/audit-header'
import { AuditWorkspace } from '@/features/audits/workspace/audit-workspace'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'

const workspaceSearchSchema = z.object({
  tab: z
    .enum(['dashboard', 'resumo', 'dados', 'inconsistencias', 'revisao', 'relatorio', 'compartilhar'])
    .catch('dashboard'),
})

function WorkspacePage() {
  const { auditId } = useParams({ from: '/_authenticated/audits/$auditId/' })
  return (
    <>
      <PageHeader />
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
