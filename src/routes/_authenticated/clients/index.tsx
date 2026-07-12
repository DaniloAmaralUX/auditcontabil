import { createFileRoute } from '@tanstack/react-router'
import { Clients } from '@/features/clients'
import { clientsQuery } from '@/features/clients/data/queries'

export const Route = createFileRoute('/_authenticated/clients/')({
  component: Clients,
  loader: ({ context }) => context.queryClient.ensureQueryData(clientsQuery()),
})
