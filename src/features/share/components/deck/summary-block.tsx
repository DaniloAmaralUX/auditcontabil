// Bloco da capa — uma camada do resumo (desempenho, confiabilidade ou
// conclusão profissional). Três perguntas diferentes, três blocos: o tom de
// uma camada nunca contamina a outra.
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type SectionSummary } from '@/features/audits/analytics/insights'

const TONE_STYLES = {
  good: { Icon: CircleCheck, text: 'text-success-text' },
  attention: { Icon: TriangleAlert, text: 'text-warning-text' },
  critical: { Icon: TriangleAlert, text: 'text-destructive' },
  neutral: { Icon: Info, text: 'text-info-text' },
} as const

export function SummaryBlock({
  label,
  summary,
}: {
  label: string
  summary: SectionSummary
}) {
  const { Icon, text } = TONE_STYLES[summary.tone]
  return (
    <div className='space-y-1.5 rounded-lg border bg-background/60 p-4'>
      <p className='deck-eyebrow'>{label}</p>
      <p className={cn('flex items-start gap-1.5 text-sm font-medium', text)}>
        <Icon className='mt-0.5 size-3.5 shrink-0' aria-hidden />
        <span>{summary.short ?? summary.headline}</span>
      </p>
      {summary.detail && (
        <p className='text-xs text-muted-foreground'>{summary.detail}</p>
      )}
    </div>
  )
}
