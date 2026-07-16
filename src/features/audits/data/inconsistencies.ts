import {
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import { type Severity } from '../components/status-badge'

export type ReviewStatus = 'pending' | 'justified' | 'false_positive'

export type RuleResult = {
  id: number
  severity: Severity
  message: string
  account_code: string | null
  period: string | null
  rule_code: string
  values_snapshot: Record<string, unknown>
  review_status: ReviewStatus
  review_note: string | null
  hidden_from_client: boolean
  scope: string
}

export function inconsistenciesQuery(auditId: string) {
  return queryOptions({
    queryKey: qk.audits.inconsistencies(auditId, 'all'),
    queryFn: async (): Promise<RuleResult[]> => {
      const { data: run } = await supabase
        .from('rule_runs')
        .select('id')
        .eq('audit_id', auditId)
        .eq('is_current', true)
        .maybeSingle()
      if (!run) return []
      const { data, error } = await supabase
        .from('rule_results')
        .select(
          'id,severity,message,account_code,period,rule_code,values_snapshot,review_status,review_note,hidden_from_client,scope'
        )
        .eq('audit_id', auditId)
        .eq('run_id', run.id)
        .order('severity', { ascending: false })
        .order('account_code', { ascending: true })
      if (error) throw error
      return (data ?? []) as RuleResult[]
    },
  })
}

type ReviewInput = {
  id: number
  review_status: ReviewStatus
  review_note: string | null
  hidden_from_client: boolean
}

export function useReviewResult(auditId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReviewInput) => {
      const { error } = await supabase
        .from('rule_results')
        .update({
          review_status: input.review_status,
          review_note: input.review_note,
          hidden_from_client: input.hidden_from_client,
        })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Revisão salva.')
      qc.invalidateQueries({
        queryKey: qk.audits.inconsistencies(auditId, 'all'),
      })
      qc.invalidateQueries({ queryKey: qk.audits.detail(auditId) })
    },
  })
}
