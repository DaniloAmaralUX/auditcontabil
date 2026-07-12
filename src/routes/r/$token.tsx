import { createFileRoute } from '@tanstack/react-router'
import { PublicReportPage } from '@/features/share/public-report-page'

// PÚBLICA: fora de _authenticated, sem shell interno. noindex garantido via
// public/_headers (X-Robots-Tag) no deploy.
export const Route = createFileRoute('/r/$token')({
  component: PublicReportPage,
})
