import { supabase } from '../lib/supabase';
import { getBalance } from './creditsService';

/** Create a Polar checkout for a pack via the edge function. Returns the checkout URL. */
export async function createCheckout(packId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: { packId } });
  if (error) throw new Error(error.message ?? 'checkout_failed');
  if (!data?.ok || !data.url) throw new Error(data?.message ?? 'checkout_failed');
  return data.url as string;
}

/** Open Polar's embedded checkout overlay on-site. Resolves when it closes. */
export async function openCheckoutOverlay(url: string): Promise<'success' | 'closed'> {
  const { PolarEmbedCheckout } = await import('@polar-sh/checkout/embed');
  const checkout = await PolarEmbedCheckout.create(url, 'light');
  return new Promise((resolve) => {
    let succeeded = false;
    checkout.addEventListener('success', () => { succeeded = true; resolve('success'); });
    checkout.addEventListener('close', () => { if (!succeeded) resolve('closed'); });
  });
}

interface PollOpts {
  attempts?: number;
  intervalMs?: number;
  getBalanceFn?: (userId: string) => Promise<number>;
}

/** Poll the balance until it rises above `prev` (webhook fulfillment lags the redirect). */
export async function pollBalanceUntilChange(userId: string, prev: number, opts: PollOpts = {}): Promise<number> {
  const { attempts = 10, intervalMs = 1500, getBalanceFn = getBalance } = opts;
  let last = prev;
  for (let i = 0; i < attempts; i++) {
    last = await getBalanceFn(userId);
    if (last > prev) return last;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}
