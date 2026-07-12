import { createFileRoute, redirect } from '@tanstack/react-router'
import { Team } from '@/features/team'

export const Route = createFileRoute('/_authenticated/team/')({
  beforeLoad: ({ context }) => {
    if (context.role !== 'owner') throw redirect({ to: '/403' })
  },
  component: Team,
})
