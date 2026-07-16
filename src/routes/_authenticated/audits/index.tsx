import { createFileRoute } from '@tanstack/react-router'
import { Audits } from '@/features/audits'
import { auditsListQuery } from '@/features/audits/data/queries'

export const Route = createFileRoute('/_authenticated/audits/')({
  component: Audits,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(auditsListQuery()),
})
