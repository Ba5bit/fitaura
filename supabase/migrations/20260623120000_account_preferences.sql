-- Account-synced app preferences. Stored on the existing per-account profiles
-- row (alongside the credit balance) so they follow the user across devices,
-- under the same owner-only RLS (SELECT/UPDATE where auth.uid() = id).
--
--   receipt_paper — default Dating Score Receipt style new scans use.
--   reduce_motion — tone down scanner sweeps, count-ups and sticker pops.
--
-- Both carry defaults, so the 74 existing rows backfill without a data step.
-- Guests (signed-out) keep these device-local in localStorage; the client
-- mirrors the account value down on sign-in (see state/preferences.tsx).
alter table public.profiles
  add column if not exists receipt_paper text not null default 'neon',
  add column if not exists reduce_motion boolean not null default false;

-- Keep receipt_paper to the four styles the receipt cards actually render.
alter table public.profiles
  drop constraint if exists profiles_receipt_paper_chk;

alter table public.profiles
  add constraint profiles_receipt_paper_chk
  check (receipt_paper in ('neon', 'thermal', 'premium', 'white'));
