// invite-user — convida um membro (accountant|analyst) para o escritório do owner.
// Cria o usuário no Auth (convite por e-mail), grava app_metadata {escritorio_id, user_role}
// e a linha em profiles. Somente OWNER pode chamar.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'missing_authorization' }, 401)

    // Cliente com o JWT do chamador para validar identidade + role.
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await caller.auth.getUser()
    if (userErr || !userRes.user) return json({ error: 'unauthorized' }, 401)

    const meta = userRes.user.app_metadata ?? {}
    const escritorioId = meta.escritorio_id as string | undefined
    if (meta.user_role !== 'owner' || !escritorioId)
      return json({ error: 'forbidden_owner_only' }, 403)

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const role = body.role as string
    const fullName = String(body.full_name ?? '')
    const redirectTo = body.redirect_to as string | undefined
    if (!email || (role !== 'accountant' && role !== 'analyst'))
      return json({ error: 'invalid_input' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName },
      })
    if (inviteErr || !invited.user)
      return json({ error: 'invite_failed', detail: inviteErr?.message }, 400)

    const newUserId = invited.user.id
    await admin.auth.admin.updateUserById(newUserId, {
      app_metadata: { escritorio_id: escritorioId, user_role: role },
    })

    await admin.from('profiles').upsert({
      id: newUserId,
      escritorio_id: escritorioId,
      role,
      full_name: fullName,
      is_active: true,
    })

    await admin.from('invites').insert({
      escritorio_id: escritorioId,
      email,
      role,
      invited_by: userRes.user.id,
      status: 'pending',
    })

    return json({ ok: true, user_id: newUserId })
  } catch (e) {
    return json({ error: 'internal', detail: String(e) }, 500)
  }
})
