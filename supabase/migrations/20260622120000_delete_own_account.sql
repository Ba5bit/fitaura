-- Self-service account deletion. A SECURITY DEFINER function so an authenticated
-- caller can remove their OWN auth.users row (normally only the service role can
-- touch auth.users). It only ever deletes auth.uid() — never another user.
--
-- Note: public.profiles.id references auth.users(id) ON DELETE CASCADE, so the
-- profiles row (and credit balance) would also disappear when the auth user is
-- deleted. We delete it explicitly first anyway so the intent is unambiguous and
-- the function stays correct even if that cascade is ever dropped.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end $$;

-- Only signed-in users may delete their own account.
revoke execute on function public.delete_own_account() from anon, public;
grant execute on function public.delete_own_account() to authenticated;
