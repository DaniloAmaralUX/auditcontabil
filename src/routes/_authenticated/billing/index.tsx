import { createFileRoute, redirect } from '@tanstack/react-router'
import { PagePlaceholder } from '@/components/page-placeholder'

export const Route = createFileRoute('/_authenticated/billing/')({
  beforeLoad: ({ context }) => {
    if (context.role !== 'owner') throw redirect({ to: '/403' })
  },
  component: () => (
    <PagePlaceholder
      title='Faturamento'
      description='Em construção. Aqui você acompanha a assinatura e gerencia o pagamento (Stripe).'
    />
  ),
})
