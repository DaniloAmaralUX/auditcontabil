import { z } from 'zod'

export const clienteSchema = z.object({
  id: z.string(),
  escritorio_id: z.string(),
  name: z.string(),
  cnpj: z.string().nullable(),
  contact_email: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
})
export type Cliente = z.infer<typeof clienteSchema>

export const clienteFormSchema = z.object({
  name: z.string().min(2, 'Informe o nome do cliente.'),
  cnpj: z.string().optional().or(z.literal('')),
  contact_email: z
    .string()
    .email('E-mail inválido.')
    .optional()
    .or(z.literal('')),
  is_active: z.boolean(),
})
export type ClienteForm = z.infer<typeof clienteFormSchema>
