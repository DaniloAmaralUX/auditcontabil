import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Falha cedo e claro: sem essas envs o app não fala com o backend.
  // eslint-disable-next-line no-console
  console.error(
    'Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.'
  )
}

export const supabase: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type Role = 'owner' | 'accountant' | 'analyst'

type SessionClaims = {
  session: Session
  userId: string
  email: string
  escritorioId: string
  role: Role
  fullName: string
}

export function claimsFromSession(
  session: Session | null
): SessionClaims | null {
  if (!session) return null
  const meta = session.user.app_metadata ?? {}
  const escritorioId = meta.escritorio_id as string | undefined
  const role = meta.user_role as Role | undefined
  if (!escritorioId || !role) return null
  return {
    session,
    userId: session.user.id,
    email: session.user.email ?? '',
    escritorioId,
    role,
    fullName:
      (session.user.user_metadata?.full_name as string | undefined) ??
      session.user.email ??
      '',
  }
}

// Cache leve para o beforeLoad do guard (evita getSession por navegação).
let cached: { at: number; value: Session | null } | null = null
const TTL = 3000

export async function getSession(force = false): Promise<Session | null> {
  if (!force && cached && Date.now() - cached.at < TTL) return cached.value
  const { data } = await supabase.auth.getSession()
  cached = { at: Date.now(), value: data.session }
  return data.session
}

export function invalidateSessionCache() {
  cached = null
}

supabase.auth.onAuthStateChange((_event, session) => {
  cached = { at: Date.now(), value: session }
})
