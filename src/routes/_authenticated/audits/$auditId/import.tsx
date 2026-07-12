import { createFileRoute } from '@tanstack/react-router'
import { ImportPage } from '@/features/audits/import/import-page'

export const Route = createFileRoute('/_authenticated/audits/$auditId/import')({
  component: ImportPage,
})
