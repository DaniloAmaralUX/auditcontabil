import { Outlet, createFileRoute } from '@tanstack/react-router'
import { auditDetailQuery } from '@/features/audits/data/queries'

// Passthrough: garante o loader do detalhe para as filhas (workspace e import).
// O shell visual fica em cada filha — o stepper de importação é tela cheia (§10.2.7).
export const Route = createFileRoute('/_authenticated/audits/$auditId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(auditDetailQuery(params.auditId)),
  component: Outlet,
})
