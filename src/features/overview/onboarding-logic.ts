// Derivação pura do onboarding — separada do componente para testes e para o
// fast refresh. O estado nasce só de dados reais: nunca reseta.
import { type AuditListItem, type AuditStatus } from '../audits/data/schema'

const PAST_IMPORT: AuditStatus[] = [
  'processing',
  'partially_processed',
  'processed',
  'in_review',
  'approved',
  'published',
]
const PAST_REVIEW: AuditStatus[] = ['in_review', 'approved', 'published']

export type OnboardingStep = {
  key: 'client' | 'audit' | 'import' | 'review' | 'publish'
  title: string
  hint: string
  done: boolean
}

type OnboardingState = {
  steps: OnboardingStep[]
  doneCount: number
  activeIndex: number // -1 quando tudo feito
  complete: boolean
}

export function deriveOnboarding(
  clientCount: number,
  audits: Pick<AuditListItem, 'status'>[]
): OnboardingState {
  const has = (list: AuditStatus[]) =>
    audits.some((a) => list.includes(a.status))
  const steps: OnboardingStep[] = [
    {
      key: 'client',
      title: 'Cadastre seu primeiro cliente',
      hint: 'Toda auditoria pertence a um cliente do escritório.',
      done: clientCount > 0,
    },
    {
      key: 'audit',
      title: 'Crie uma auditoria',
      hint: 'Escolha o cliente e o período que você vai fechar.',
      done: audits.length > 0,
    },
    {
      key: 'import',
      title: 'Importe a planilha e gere o dashboard',
      hint: 'Solte o arquivo e aperte um botão — cada aba vira uma empresa.',
      done: has(PAST_IMPORT),
    },
    {
      key: 'review',
      title: 'Revise as inconsistências',
      hint: 'Justifique ou corrija cada ponto antes de aprovar.',
      done: has(PAST_REVIEW),
    },
    {
      key: 'publish',
      title: 'Publique e compartilhe com o cliente',
      hint: 'Um link com senha, bonito o bastante para apresentar.',
      done: audits.some((a) => a.status === 'published'),
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  return {
    steps,
    doneCount,
    activeIndex: steps.findIndex((s) => !s.done),
    complete: doneCount === steps.length,
  }
}

/** Auditorias que estão esperando uma ação do escritório. */
export function auditsNeedingAction(audits: AuditListItem[]): AuditListItem[] {
  return audits.filter(
    (a) => a.status !== 'published' && a.status !== 'archived'
  )
}
