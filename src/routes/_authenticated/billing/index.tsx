import { createFileRoute, redirect } from '@tanstack/react-router'
import { Billing } from '@/features/billing'

export const Route = createFileRoute('/_authenticated/billing/')({
  beforeLoad: ({ context }) => {
    if (context.role !== 'owner') throw redirect({ to: '/403' })
  },
  component: Billing,
})
