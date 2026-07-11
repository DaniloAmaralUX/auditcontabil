import { createContext, use, useState, type ReactNode } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type Cliente } from '../data/schema'

export type ClientsDialogType = 'create' | 'update' | 'delete'

type ClientsContextValue = {
  open: ClientsDialogType | null
  setOpen: (v: ClientsDialogType | null) => void
  currentRow: Cliente | null
  setCurrentRow: (row: Cliente | null) => void
}

const ClientsContext = createContext<ClientsContextValue | null>(null)

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useDialogState<ClientsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Cliente | null>(null)
  return (
    <ClientsContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </ClientsContext>
  )
}

export function useClients() {
  const ctx = use(ClientsContext)
  if (!ctx) throw new Error('useClients deve estar dentro de ClientsProvider')
  return ctx
}
