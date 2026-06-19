-- Real Polar purchases: one row per Polar order. Idempotency key = order_id.
-- Doubles as the user's payment-receipt history.
create table if not exists public.credit_purchases (
  order_id    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  pack_id     text not null,
  credits     int  not null,
  amount      numeric,
  status      text not null default 'paid',  -- 'paid' | 'refunded'
  created_at  timestamptz not null default now(),
  refunded_at timestamptz
);

alter table public.credit_purchases enable row level security;

-- Owner may read their own receipts. No client writes: the webhook uses the
-- service role, which bypasses RLS, so no insert/update policy is defined.
drop policy if exists "own receipts readable" on public.credit_purchases;
create policy "own receipts readable" on public.credit_purchases
  for select using (auth.uid() = user_id);

-- Atomic + idempotent grant. Returns true iff THIS call granted (first time
-- for order_id); duplicate webhook deliveries return false and change nothing.
create or replace function public.grant_purchase_credits(
  p_order_id text, p_user_id uuid, p_pack_id text, p_credits int, p_amount numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare n_inserted int;
begin
  insert into credit_purchases(order_id, user_id, pack_id, credits, amount)
  values (p_order_id, p_user_id, p_pack_id, p_credits, p_amount)
  on conflict (order_id) do nothing;
  get diagnostics n_inserted = row_count;          -- 1 = inserted, 0 = duplicate
  if n_inserted > 0 then
    update profiles set credits = credits + p_credits where id = p_user_id;
  end if;
  return n_inserted > 0;
end $$;

-- Atomic + idempotent refund. Subtracts the order's credits, clamped at 0.
-- Returns true iff THIS call performed the claw-back.
create or replace function public.refund_purchase_credits(p_order_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r credit_purchases;
begin
  select * into r from credit_purchases where order_id = p_order_id for update;
  if not found or r.status = 'refunded' then return false; end if;
  update credit_purchases set status = 'refunded', refunded_at = now()
    where order_id = p_order_id;
  update profiles set credits = greatest(credits - r.credits, 0) where id = r.user_id;
  return true;
end $$;
