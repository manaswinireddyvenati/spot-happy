
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
-- has_role is called inside RLS USING clauses which execute as the definer regardless, so anon/authenticated do not need direct EXECUTE.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- prevent_booking_overlap is INVOKER-safe (not SECURITY DEFINER) — no change needed.
