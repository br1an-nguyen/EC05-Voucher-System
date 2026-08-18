-- Supabase installs this SECURITY DEFINER event-trigger function to enable RLS
-- on newly created public tables. It only needs to be invoked by its event
-- trigger, so browser-facing roles must not be able to call it through RPC.

REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"()
FROM PUBLIC, anon, authenticated;
