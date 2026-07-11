import { createFileRoute, redirect } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/_authenticated/team/')({
  beforeLoad: ({ context }) => {
    if (context.role !== 'owner') throw redirect({ to: '/403' })
  },
  component: () => (
    <PagePlaceholder
      title='Equipe'
      description='Em construção. Convide contadores e analistas e gerencie os papéis do escritório.'
    />
  ),
})
