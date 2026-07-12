import { createContext, use, useState, type ReactNode } from 'react'

type AuditsContextValue = {
  createOpen: boolean
  setCreateOpen: (v: boolean) => void
}

const AuditsContext = createContext<AuditsContextValue | null>(null)

export function AuditsProvider({ children }: { children: ReactNode }) {
  const [createOpen, setCreateOpen] = useState(false)
  return (
    <AuditsContext value={{ createOpen, setCreateOpen }}>
      {children}
    </AuditsContext>
  )
}

export function useAudits() {
  const ctx = use(AuditsContext)
  if (!ctx) throw new Error('useAudits deve estar dentro de AuditsProvider')
  return ctx
}
