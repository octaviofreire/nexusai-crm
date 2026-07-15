
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- Trigger runs as the table owner regardless; only keep service_role for maintenance.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
