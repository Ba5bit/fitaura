-- Promo codes → permanent per-account entitlements. Additive + RLS-locked; inert
-- until a code is redeemed. Mirrors the owner-only RLS already on profiles.
--
--   promo_codes         — campaign codes; each grants a set of entitlement keys.
--                         NO select policy → codes can't be enumerated by clients.
--   code_redemptions    — one row per (code, user); unique() blocks double-redeem.
--   account_entitlements— the permanent grants; owner-only read, NO client writes.
--
-- redeem_code(p_code) is the ONLY write path into redemptions/entitlements
-- (SECURITY DEFINER, atomic). Clients can never insert directly.

-- ---- tables -------------------------------------------------------------
create table if not exists public.promo_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,                 -- stored normalized (UPPER, trimmed)
  entitlements      text[] not null default '{}',
  max_redemptions   integer,                              -- null = unlimited
  redemptions_count integer not null default 0,
  expires_at        timestamptz,                          -- null = no expiry
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists public.code_redemptions (
  id         uuid primary key default gen_random_uuid(),
  code_id    uuid not null references public.promo_codes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (code_id, user_id)
);

create table if not exists public.account_entitlements (
  user_id     uuid not null references auth.users(id) on delete cascade,
  entitlement text not null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, entitlement)
);

-- ---- RLS ----------------------------------------------------------------
alter table public.promo_codes          enable row level security;
alter table public.code_redemptions     enable row level security;
alter table public.account_entitlements enable row level security;

-- promo_codes: NO policies at all → not selectable/insertable by clients
-- (the SECURITY DEFINER RPC bypasses RLS to read/update it).

-- code_redemptions: owner may read their own rows; no client writes.
drop policy if exists code_redemptions_select_own on public.code_redemptions;
create policy code_redemptions_select_own on public.code_redemptions
  for select using (auth.uid() = user_id);

-- account_entitlements: owner may read their own grants; no client writes.
drop policy if exists account_entitlements_select_own on public.account_entitlements;
create policy account_entitlements_select_own on public.account_entitlements
  for select using (auth.uid() = user_id);

-- ---- redeem RPC ---------------------------------------------------------
-- Atomic: validate → per-user dedupe → record redemption, bump counter, grant.
-- Returns { status, entitlements } where status is one of:
--   ok | already_owned | invalid | expired | exhausted | unauthenticated
create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid   uuid := auth.uid();
  v_code  public.promo_codes%rowtype;
  v_norm  text := upper(trim(coalesce(p_code, '')));
  v_ent   text;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  select * into v_code from public.promo_codes
    where code = v_norm and active = true
    for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  -- Already redeemed by this user → friendly idempotent success.
  if exists (select 1 from public.code_redemptions
               where code_id = v_code.id and user_id = v_uid) then
    return jsonb_build_object('status', 'already_owned', 'entitlements', v_code.entitlements);
  end if;

  if v_code.max_redemptions is not null
     and v_code.redemptions_count >= v_code.max_redemptions then
    return jsonb_build_object('status', 'exhausted');
  end if;

  insert into public.code_redemptions (code_id, user_id) values (v_code.id, v_uid);
  update public.promo_codes set redemptions_count = redemptions_count + 1
    where id = v_code.id;

  foreach v_ent in array v_code.entitlements loop
    insert into public.account_entitlements (user_id, entitlement)
      values (v_uid, v_ent)
      on conflict (user_id, entitlement) do nothing;
  end loop;

  return jsonb_build_object('status', 'ok', 'entitlements', v_code.entitlements);
end;
$function$;

revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;
