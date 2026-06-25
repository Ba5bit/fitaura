-- New users get 10 free credits on signup (was 3). Friend-vs-Friend launch promo.
-- Recreates the on_auth_user_created trigger function. Idempotent (create or replace).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, credits) values (new.id, 10);
  return new;
end;
$function$;
