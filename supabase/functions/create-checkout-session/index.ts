// create-checkout-session — cria (ou reusa) o customer Stripe do escritório e abre
// uma Checkout Session de assinatura. Somente OWNER. Retorna { url }.
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
    const user = userRes.user
    const meta = user?.app_metadata ?? {}
    const escritorioId = meta.escritorio_id as string | undefined
    if (!user || meta.user_role !== 'owner' || !escritorioId)
      return json({ error: 'forbidden_owner_only' }, 403)

    const body = await req.json().catch(() => ({}))
    const priceId = String(body.price_id ?? '')
    if (!priceId) return json({ error: 'missing_price_id' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: existing } = await admin
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('escritorio_id', escritorioId)
      .maybeSingle()

    let customerId = existing?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { escritorio_id: escritorioId },
      })
      customerId = customer.id
      await admin.from('billing_customers').insert({
        escritorio_id: escritorioId,
        stripe_customer_id: customerId,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { escritorio_id: escritorioId } },
      success_url: `${APP_URL}/billing?checkout=success`,
      cancel_url: `${APP_URL}/billing?checkout=cancel`,
    })
    return json({ url: session.url })
  } catch (e) {
    return json({ error: 'internal', detail: String(e) }, 500)
  }
})
