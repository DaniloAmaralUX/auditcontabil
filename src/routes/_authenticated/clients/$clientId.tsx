import { createFileRoute } from '@tanstack/react-router'
import { ClientDetail } from '@/features/clients/client-detail'
import { clientQuery } from '@/features/clients/data/queries'

export const Route = createFileRoute('/_authenticated/clients/$clientId')({
  component: ClientDetail,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(clientQuery(params.clientId)),
})
