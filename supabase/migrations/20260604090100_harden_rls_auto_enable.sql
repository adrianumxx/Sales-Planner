-- Remove the RPC attack surface on the event-trigger function. Event triggers
-- fire via the DDL system, not via role EXECUTE grants, so this is safe.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
