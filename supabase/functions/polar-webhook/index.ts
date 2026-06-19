// supabase/functions/polar-webhook/index.ts
import { Webhook } from 'standardwebhooks';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('POLAR_WEBHOOK_SECRET')!;

/** Call a Postgres RPC with the service role (bypasses RLS). Returns the JSON body. */
async function rpc(fn: string, args: Record<string, unknown>): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(args),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });

  const raw = await req.text();

  // 1. Verify the Standard-Webhooks signature. Invalid → 400, no side effects.
  // Polar's secret (polar_whs_…) must be base64-encoded first: standardwebhooks
  // base64-DECODES whatever it receives to recover the signing key. (Polar's own
  // SDK does the same — new Webhook(base64(secret)).)
  try {
    new Webhook(btoa(WEBHOOK_SECRET)).verify(raw, {
      'webhook-id': req.headers.get('webhook-id') ?? '',
      'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': req.headers.get('webhook-signature') ?? '',
    });
  } catch {
    return new Response('invalid_signature', { status: 400 });
  }

  const event = JSON.parse(raw) as { type: string; data: any };

  try {
    if (event.type === 'order.paid') {
      const order = event.data;
      const m = order.metadata ?? {};
      // Metadata is server-set in create-checkout, so this should never happen.
      // If it does, it is a permanent data problem — acknowledge with 200 so Polar
      // does not retry forever (a 500 would wedge the delivery in its retry queue).
      if (!m.user_id || m.credits === undefined || m.credits === null) {
        console.log(JSON.stringify({ fn: 'polar-webhook', type: event.type, order: order.id, skipped: 'missing_metadata' }));
        return new Response('ok', { status: 200 });
      }
      const amount = (order.total_amount ?? order.amount ?? 0) / 100;
      const res = await rpc('grant_purchase_credits', {
        p_order_id: order.id,
        p_user_id: m.user_id,
        p_pack_id: m.pack_id,
        p_credits: Number(m.credits),
        p_amount: amount,
      });
      if (!res.ok) return new Response('grant_failed', { status: 500 }); // Polar will retry
      const granted = await res.json();
      console.log(JSON.stringify({ fn: 'polar-webhook', type: event.type, order: order.id, granted }));
    } else if (event.type === 'order.refunded') {
      const order = event.data;
      const res = await rpc('refund_purchase_credits', { p_order_id: order.id });
      if (!res.ok) return new Response('refund_failed', { status: 500 });
      const refunded = await res.json();
      console.log(JSON.stringify({ fn: 'polar-webhook', type: event.type, order: order.id, refunded }));
    }
    // Any other event: acknowledged, ignored.
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.log(JSON.stringify({ fn: 'polar-webhook', type: event.type, error: String(e) }));
    return new Response('error', { status: 500 });
  }
});
