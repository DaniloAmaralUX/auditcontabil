import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { type AuditForm, type AuditStatus } from './schema'

export function useCreateAudit() {
  const qc = useQueryClient()
  const escritorioId = useAuthStore((s) => s.auth.escritorioId)
  const userId = useAuthStore((s) => s.auth.userId)
  return useMutation({
    mutationFn: async (values: AuditForm): Promise<string> => {
      const { data, error } = await supabase
        .from('audits')
        .insert({
          escritorio_id: escritorioId,
          cliente_id: values.cliente_id,
          title: values.title.trim(),
          period_start: values.period_start,
          period_end: values.period_end,
          created_by: userId,
          status: 'draft',
        })
        .select('id')
        .single()
      if (error) throw error
      const auditId = data.id as string
      // draft -> awaiting_files (cliente + período preenchidos)
      const { error: tErr } = await supabase.rpc('transition_audit', {
        p_audit_id: auditId,
        p_to: 'awaiting_files',
      })
      if (tErr) throw tErr
      return auditId
    },
    onSuccess: () => {
      toast.success('Auditoria criada.')
      qc.invalidateQueries({ queryKey: ['audits'] })
    },
  })
}

export function useTransitionAudit(auditId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (to: AuditStatus) => {
      const { error } = await supabase.rpc('transition_audit', {
        p_audit_id: auditId,
        p_to: to,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.audits.detail(auditId) })
      qc.invalidateQueries({ queryKey: ['audits', 'list'] })
    },
  })
}

export function useRunRules(auditId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('run_rules', { p_audit_id: auditId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.audits.detail(auditId) })
      qc.invalidateQueries({ queryKey: qk.audits.inconsistencies(auditId, 'all') })
    },
  })
}
