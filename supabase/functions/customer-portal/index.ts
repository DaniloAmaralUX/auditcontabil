// customer-portal — abre o Billing Portal do Stripe para o escritório. Somente OWNER.
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'
import { corsHeaders, json } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2025-01-27.acacia' as never })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'missing_authorization' }, 401)
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes } = await caller.auth.getUser()
    const meta = userRes.user?.app_metadata ?? {}
    const escritorioId = meta.escritorio_id as string | undefined
    if (!userRes.user || meta.user_role !== 'owner' || !escritorioId)
      return json({ error: 'forbidden_owner_only' }, 403)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: bc } = await admin
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('escritorio_id', escritorioId)
      .maybeSingle()
    if (!bc?.stripe_customer_id) return json({ error: 'no_customer' }, 400)

    const session = await stripe.billingPortal.sessions.create({
      customer: bc.stripe_customer_id,
      return_url: `${APP_URL}/billing`,
    })
    return json({ url: session.url })
  } catch (e) {
    return json({ error: 'internal', detail: String(e) }, 500)
  }
})
