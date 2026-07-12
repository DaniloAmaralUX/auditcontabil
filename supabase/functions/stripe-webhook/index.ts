// stripe-webhook — fonte de verdade do estado de cobrança (escreve subscriptions).
// Deploy com --no-verify-jwt. Idempotência via billing_events.
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2025-01-27.acacia' as never })
const admin = createClient(SUPABASE_URL, SERVICE_KEY)

async function resolveEscritorio(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = (sub.metadata?.escritorio_id as string) || null
  if (fromMeta) return fromMeta
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const { data } = await admin
    .from('billing_customers')
    .select('escritorio_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data?.escritorio_id ?? null
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const escritorioId = await resolveEscritorio(sub)
  if (!escritorioId) return
  await admin.from('subscriptions').upsert(
    {
      escritorio_id: escritorioId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_id: sub.items.data[0]?.price.id ?? null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'escritorio_id' },
  )
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('missing signature', { status: 400 })
  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET)
  } catch (e) {
    return new Response(`invalid signature: ${e}`, { status: 400 })
  }

  // Idempotência: se já processamos, 200 imediato.
  const { error: dupErr } = await admin
    .from('billing_events')
    .insert({ stripe_event_id: event.id, type: event.type, payload: event as unknown as object })
  if (dupErr) return new Response('ok (dup)', { status: 200 })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          await upsertSubscription(sub)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        await upsertSubscription(event.data.object as Stripe.Subscription)
        break
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription as string)
          await upsertSubscription(sub)
        }
        break
      }
    }
  } catch (e) {
    return new Response(`handler error: ${e}`, { status: 500 })
  }
  return new Response('ok', { status: 200 })
})
