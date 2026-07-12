import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { type AuditAnalytics } from './types'

export function analyticsQuery(auditId: string) {
  return queryOptions({
    queryKey: ['audits', auditId, 'analytics'],
    queryFn: async (): Promise<AuditAnalytics> => {
      const { data, error } = await supabase.rpc('get_audit_analytics', {
        p_audit_id: auditId,
      })
      if (error) throw error
      return data as AuditAnalytics
    },
    staleTime: 30 * 1000,
  })
}
