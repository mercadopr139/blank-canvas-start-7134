-- Ask NLA: a single read-only SQL entrypoint the "Ask NLA" assistant uses to
-- answer natural-language questions about operational data.
--
-- Safety model (defense in depth):
--   1. SECURITY DEFINER + no grants to anon/authenticated — only the service
--      role (used server-side by the ask-nla Edge Function, which itself gates
--      to the super-admin) may call this. It is NOT reachable from the browser.
--   2. `transaction_read_only = on` — forces the whole transaction read-only, so
--      any INSERT/UPDATE/DELETE/DDL in the generated SQL errors at the database
--      level no matter what the model produced. This is the hard guarantee.
--   3. `statement_timeout` — a runaway or accidental cartesian query can't hang.
--   4. Row cap (5000) — keeps a huge result set from blowing up the response.
--
-- The function returns the query result as a JSON array of row objects.

create or replace function public.ask_nla_run_query(query_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  -- Suspenders: force read-only for the remainder of this transaction. Setting
  -- the GUC directly (rather than `SET TRANSACTION READ ONLY`) works even after
  -- PostgREST has already issued statements in the transaction, and it blocks
  -- every write path — including for the definer/superuser.
  set local transaction_read_only = on;
  -- Belt: bound execution time so nothing hangs the request.
  set local statement_timeout = '12s';

  execute format(
    'select coalesce(jsonb_agg(row_to_json(sub)), ''[]''::jsonb) '
    'from (select * from (%s) q limit 5000) sub',
    query_text
  ) into result;

  return result;
end;
$$;

-- Lock it down: revoke from everyone, grant only to the service role. The
-- ask-nla Edge Function calls this with the service-role key after verifying
-- the caller is the super-admin; no client-facing role can reach it.
revoke all on function public.ask_nla_run_query(text) from public;
revoke all on function public.ask_nla_run_query(text) from anon;
revoke all on function public.ask_nla_run_query(text) from authenticated;
grant execute on function public.ask_nla_run_query(text) to service_role;

comment on function public.ask_nla_run_query(text) is
  'Read-only SQL entrypoint for the Ask NLA assistant. Runs a single SELECT in a '
  'read-only transaction (writes are impossible) with a statement timeout and a '
  '5000-row cap. Service-role only; gated to the super-admin by the ask-nla Edge Function.';
