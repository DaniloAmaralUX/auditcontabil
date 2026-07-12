import { createFileRoute, redirect } from '@tanstack/react-router'
import { claimsFromSession, getSession, supabase } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

// RF-006: usuário desativado não acessa. Cache leve por sessão (1 consulta/5min).
let activeCheck: { at: number; userId: string; active: boolean } | null = null
async function isProfileActive(userId: string): Promise<boolean> {
  if (
    activeCheck &&
    activeCheck.userId === userId &&
    Date.now() - activeCheck.at < 5 * 60 * 1000
  ) {
    return activeCheck.active
  }
  const { data } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', userId)
    .maybeSingle()
  const active = data?.is_active ?? true
  activeCheck = { at: Date.now(), userId, active }
  return active
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    const claims = claimsFromSession(session)
    if (!claims) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
    if (!(await isProfileActive(claims.userId))) {
      await supabase.auth.signOut()
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }
    return {
      session: claims.session,
      userId: claims.userId,
      email: claims.email,
      escritorioId: claims.escritorioId,
      role: claims.role,
      fullName: claims.fullName,
    }
  },
  component: AuthenticatedLayout,
})
