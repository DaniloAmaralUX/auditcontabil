import { queryOptions } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import { auditSchema, type Audit, type AuditListItem } from './schema'

type Row = Audit & { clientes: { name: string } | null }

export function auditsListQuery() {
  return queryOptions({
    queryKey: qk.audits.list('all'),
    queryFn: async (): Promise<AuditListItem[]> => {
      const { data, error } = await supabase
        .from('audits')
        .select('*, clientes(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as Row[]).map((r) => ({
        ...auditSchema.parse(r),
        cliente_name: r.clientes?.name ?? '—',
      }))
    },
  })
}

export function auditDetailQuery(id: string) {
  return queryOptions({
    queryKey: qk.audits.detail(id),
    queryFn: async (): Promise<AuditListItem> => {
      const { data, error } = await supabase
        .from('audits')
        .select('*, clientes(name)')
        .eq('id', id)
        .single()
      if (error) throw error
      const r = data as Row
      return { ...auditSchema.parse(r), cliente_name: r.clientes?.name ?? '—' }
    },
  })
}

export type AuditFile = {
  id: string
  audit_id: string
  original_name: string
  status: string
  row_count: number | null
  error_message: string | null
  mapping_id: string | null
  size_bytes: number | null
  created_at: string
}

export function auditFilesQuery(id: string) {
  return queryOptions({
    queryKey: qk.audits.files(id),
    queryFn: async (): Promise<AuditFile[]> => {
      const { data, error } = await supabase
        .from('files')
        .select(
          'id, audit_id, original_name, status, row_count, error_message, mapping_id, size_bytes, created_at'
        )
        .eq('audit_id', id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as AuditFile[]
    },
  })
}
