import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'

export function usePublishAudit(auditId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('publish_audit', {
        p_audit_id: auditId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Auditoria publicada.')
      qc.invalidateQueries({ queryKey: qk.audits.detail(auditId) })
      qc.invalidateQueries({ queryKey: ['audits', 'list'] })
    },
  })
}

export type ShareRow = {
  id: string
  status: string
  expires_at: string | null
  created_at: string
}

export function sharesQuery(auditId: string) {
  return queryOptions({
    queryKey: ['audits', auditId, 'shares'],
    queryFn: async (): Promise<ShareRow[]> => {
      const { data, error } = await supabase
        .from('shares')
        .select('id, status, expires_at, created_at')
        .eq('audit_id', auditId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ShareRow[]
    },
  })
}

export function useCreateShare(auditId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      password: string
      expires_at: string | null
    }): Promise<{ token: string }> => {
      const { data, error } = await supabase.rpc('create_share', {
        p_audit_id: auditId,
        p_password: input.password,
        p_expires_at: input.expires_at,
      })
      if (error) throw error
      return data as { token: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audits', auditId, 'shares'] })
    },
  })
}

export function useRevokeShare(auditId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase.rpc('revoke_share', {
        p_share_id: shareId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Link revogado.')
      qc.invalidateQueries({ queryKey: ['audits', auditId, 'shares'] })
    },
  })
}
