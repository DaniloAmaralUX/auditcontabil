import { queryOptions } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import { clienteSchema, type Cliente } from './schema'

export function clientsQuery() {
  return queryOptions({
    queryKey: qk.clients.all,
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => clienteSchema.parse(r))
    },
  })
}

export function clientQuery(id: string) {
  return queryOptions({
    queryKey: qk.clients.detail(id),
    queryFn: async (): Promise<Cliente> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return clienteSchema.parse(data)
    },
  })
}
