import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { qk } from '@/lib/query-keys'
import { strings } from '@/lib/strings'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { type Cliente, type ClienteForm } from './schema'

function toPayload(values: ClienteForm) {
  return {
    name: values.name.trim(),
    cnpj: values.cnpj?.trim() || null,
    contact_email: values.contact_email?.trim() || null,
    is_active: values.is_active,
  }
}

export function useCreateClient() {
  const qc = useQueryClient()
  const escritorioId = useAuthStore((s) => s.auth.escritorioId)
  return useMutation({
    mutationFn: async (values: ClienteForm) => {
      const { error } = await supabase
        .from('clientes')
        .insert({ ...toPayload(values), escritorio_id: escritorioId })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(strings.clients.created)
      qc.invalidateQueries({ queryKey: qk.clients.all })
    },
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ClienteForm }) => {
      const { error } = await supabase
        .from('clientes')
        .update(toPayload(values))
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { id }) => {
      toast.success(strings.clients.updated)
      qc.invalidateQueries({ queryKey: qk.clients.all })
      qc.invalidateQueries({ queryKey: qk.clients.detail(id) })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (client: Cliente) => {
      const { error } = await supabase.from('clientes').delete().eq('id', client.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(strings.clients.removed)
      qc.invalidateQueries({ queryKey: qk.clients.all })
    },
  })
}
