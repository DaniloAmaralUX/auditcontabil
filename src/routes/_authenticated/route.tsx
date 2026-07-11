import { createFileRoute, redirect } from '@tanstack/react-router'
import { claimsFromSession, getSession } from '@/lib/supabase'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    const claims = claimsFromSession(session)
    if (!claims) {
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
