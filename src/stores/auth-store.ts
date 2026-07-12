import { type Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { claimsFromSession, type Role } from '@/lib/supabase'

type AuthState = {
  auth: {
    session: Session | null
    userId: string | null
    email: string | null
    escritorioId: string | null
    role: Role | null
    fullName: string | null
    setSession: (session: Session | null) => void
    reset: () => void
  }
}

function derive(session: Session | null) {
  const c = claimsFromSession(session)
  return {
    session,
    userId: c?.userId ?? null,
    email: c?.email ?? null,
    escritorioId: c?.escritorioId ?? null,
    role: c?.role ?? null,
    fullName: c?.fullName ?? null,
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    ...derive(null),
    setSession: (session) =>
      set((state) => ({ auth: { ...state.auth, ...derive(session) } })),
    reset: () => set((state) => ({ auth: { ...state.auth, ...derive(null) } })),
  },
}))
