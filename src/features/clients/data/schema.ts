import { z } from 'zod'

// RF-008: valida dígitos verificadores de CPF (11) e CNPJ (14) quando informado.
export function isValidCpfCnpj(raw: string): boolean {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11) {
    if (d.split('').every((c) => c === d[0])) return false
    const calc = (len: number) => {
      let sum = 0
      for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
      const rest = (sum * 10) % 11
      return rest === 10 ? 0 : rest
    }
    return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
  }
  if (d.length === 14) {
    if (d.split('').every((c) => c === d[0])) return false
    const calc = (len: number) => {
      const weights = len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      let sum = 0
      for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i]
      const rest = sum % 11
      return rest < 2 ? 0 : 11 - rest
    }
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
  }
  return false
}

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
  cnpj: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || isValidCpfCnpj(v), 'CPF ou CNPJ inválido.'),
  contact_email: z
    .string()
    .email('E-mail inválido.')
    .optional()
    .or(z.literal('')),
  is_active: z.boolean(),
})
export type ClienteForm = z.infer<typeof clienteFormSchema>
