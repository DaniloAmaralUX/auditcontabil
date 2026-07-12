import { z } from 'zod'

export const auditStatusValues = [
  'draft',
  'awaiting_files',
  'awaiting_mapping',
  'processing',
  'partially_processed',
  'processed',
  'in_review',
  'approved',
  'published',
  'archived',
] as const
export type AuditStatus = (typeof auditStatusValues)[number]

export const auditSchema = z.object({
  id: z.string(),
  escritorio_id: z.string(),
  cliente_id: z.string(),
  title: z.string(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  status: z.enum(auditStatusValues),
  created_by: z.string().nullable(),
  approved_by: z.string().nullable(),
  created_at: z.string(),
})
export type Audit = z.infer<typeof auditSchema>

export type AuditListItem = Audit & { cliente_name: string }

export const auditFormSchema = z
  .object({
    cliente_id: z.string().min(1, 'Selecione o cliente.'),
    title: z.string().min(2, 'Dê um nome à auditoria.'),
    period_start: z.string().min(1, 'Informe o início do período.'),
    period_end: z.string().min(1, 'Informe o fim do período.'),
  })
  .refine((d) => d.period_start <= d.period_end, {
    message: 'O início deve ser anterior ao fim.',
    path: ['period_end'],
  })
export type AuditForm = z.infer<typeof auditFormSchema>
