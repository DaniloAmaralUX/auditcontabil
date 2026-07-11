import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/_authenticated/audits/')({
  component: () => (
    <PagePlaceholder
      title='Auditorias'
      description='Em construção. Aqui você vai criar auditorias, importar planilhas, revisar inconsistências e publicar.'
    />
  ),
})
