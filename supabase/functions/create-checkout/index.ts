// supabase/functions/create-checkout/index.ts
import { creditsForPack, isAllowedOrigin } from 'shared/checkout.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const PRODUCT_ENV: Record<string, string> = {
  starter: 'POLAR_PRODUCT_STARTER',
  regular: 'POLAR_PRODUCT_REGULAR',
  group: 'POLAR_PRODUCT_GROUP',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, message: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const POLAR_TOKEN = Deno.env.get('POLAR_ACCESS_TOKEN');
  if (!POLAR_TOKEN) return json({ ok: false, message: 'missing_polar_token' }, 500);

  // 1. Origin allowlist (also used as embed_origin + success_url base).
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin)) return json({ ok: false, message: 'forbidden_origin' }, 403);

  // 2. Verify the caller's Supabase JWT → real user id + email.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: ANON },
  });
  if (!userRes.ok) return json({ ok: false, message: 'unauthorized' }, 401);
  const user = await userRes.json() as { id: string; email?: string };

  // 3. Resolve pack → credits + Polar product id.
  let body: { packId?: string };
  try { body = await req.json(); } catch { return json({ ok: false, message: 'bad_request' }, 400); }
  const packId = body.packId ?? '';
  const credits = creditsForPack(packId);
  const productEnv = PRODUCT_ENV[packId];
  if (credits === undefined || !productEnv) return json({ ok: false, message: 'unknown_pack' }, 400);
  const productId = Deno.env.get(productEnv);
  if (!productId) return json({ ok: false, message: 'missing_product_id' }, 500);

  // 4. Create the Polar checkout (metadata is server-set → trusted by the webhook).
  const success_url = `${origin}/credits?status=success&checkout_id={CHECKOUT_ID}`;
  const res = await fetch('https://api.polar.sh/v1/checkouts/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${POLAR_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      products: [productId],
      external_customer_id: user.id,
      customer_email: user.email,
      embed_origin: origin,
      success_url,
      metadata: { user_id: user.id, pack_id: packId, credits },
    }),
  });
  if (!res.ok) {
    console.log(JSON.stringify({ fn: 'create-checkout', success: false, status: res.status, pack: packId }));
    return json({ ok: false, message: 'polar_error' }, 502);
  }
  const checkout = await res.json() as { id: string; url: string };
  console.log(JSON.stringify({ fn: 'create-checkout', success: true, user: user.id, pack: packId, checkout_id: checkout.id }));
  return json({ ok: true, url: checkout.url });
});
