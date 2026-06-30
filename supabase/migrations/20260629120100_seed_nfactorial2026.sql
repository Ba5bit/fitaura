-- Campaign code for the nFactorial Edition drop. Idempotent: re-running only
-- refreshes the grant set / window, never resets redemptions_count.
-- Adjust expires_at to the real event window before applying.
insert into public.promo_codes (code, entitlements, max_redemptions, expires_at, active)
values ('NFACTORIAL2026', array['theme:company-nfactorial'], null,
        timestamptz '2026-12-31 23:59:59+00', true)
on conflict (code) do update
  set entitlements = excluded.entitlements,
      expires_at   = excluded.expires_at,
      active       = excluded.active;
