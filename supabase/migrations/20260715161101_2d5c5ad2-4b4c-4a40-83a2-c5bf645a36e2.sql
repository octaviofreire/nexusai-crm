
-- 1) Drop the always-true INSERT policy on organizations.
-- Organizations are created via the SECURITY DEFINER trigger `handle_new_user`,
-- so no client-facing INSERT policy is needed.
DROP POLICY IF EXISTS "authenticated create org" ON public.organizations;

-- 2) Move RLS helper functions into a private schema not exposed via PostgREST.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Drop dependent policies (recreated below).
DROP POLICY IF EXISTS "org members access tasks" ON public.tasks;
DROP POLICY IF EXISTS "admins update own orgs" ON public.organizations;
DROP POLICY IF EXISTS "members read own orgs" ON public.organizations;
DROP POLICY IF EXISTS "admins manage memberships" ON public.memberships;
DROP POLICY IF EXISTS "members read own memberships" ON public.memberships;
DROP POLICY IF EXISTS "org members access accounts" ON public.accounts;
DROP POLICY IF EXISTS "org members access contacts" ON public.contacts;
DROP POLICY IF EXISTS "managers write pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "org members read pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "org members access interactions" ON public.interactions;
DROP POLICY IF EXISTS "managers write stages" ON public.stages;
DROP POLICY IF EXISTS "org members read stages" ON public.stages;
DROP POLICY IF EXISTS "org members access deals" ON public.deals;
DROP POLICY IF EXISTS "own ai conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "read own profile" ON public.profiles;

-- Move functions to private schema.
ALTER FUNCTION public.is_member(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.has_any_role(uuid, uuid, public.app_role[]) SET SCHEMA private;

-- Revoke execute from client-facing roles; grant only where needed for RLS evaluation.
REVOKE ALL ON FUNCTION private.is_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_any_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_any_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;

-- Update the handle_new_user trigger function that referenced public.is_member indirectly (no direct call, safe).
-- Recreate policies with the new schema reference.

CREATE POLICY "org members access tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (private.is_member(auth.uid(), org_id))
  WITH CHECK (private.is_member(auth.uid(), org_id));

CREATE POLICY "admins update own orgs" ON public.organizations
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), id, 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), id, 'admin'::public.app_role));

CREATE POLICY "members read own orgs" ON public.organizations
  FOR SELECT TO authenticated
  USING (private.is_member(auth.uid(), id));

CREATE POLICY "admins manage memberships" ON public.memberships
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), org_id, 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), org_id, 'admin'::public.app_role));

CREATE POLICY "members read own memberships" ON public.memberships
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.is_member(auth.uid(), org_id));

CREATE POLICY "org members access accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (private.is_member(auth.uid(), org_id))
  WITH CHECK (private.is_member(auth.uid(), org_id));

CREATE POLICY "org members access contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (private.is_member(auth.uid(), org_id))
  WITH CHECK (private.is_member(auth.uid(), org_id));

CREATE POLICY "managers write pipelines" ON public.pipelines
  FOR ALL TO authenticated
  USING (private.has_any_role(auth.uid(), org_id, ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
  WITH CHECK (private.has_any_role(auth.uid(), org_id, ARRAY['admin'::public.app_role, 'manager'::public.app_role]));

CREATE POLICY "org members read pipelines" ON public.pipelines
  FOR SELECT TO authenticated
  USING (private.is_member(auth.uid(), org_id));

CREATE POLICY "org members access interactions" ON public.interactions
  FOR ALL TO authenticated
  USING (private.is_member(auth.uid(), org_id))
  WITH CHECK (private.is_member(auth.uid(), org_id));

CREATE POLICY "managers write stages" ON public.stages
  FOR ALL TO authenticated
  USING (private.has_any_role(auth.uid(), org_id, ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
  WITH CHECK (private.has_any_role(auth.uid(), org_id, ARRAY['admin'::public.app_role, 'manager'::public.app_role]));

CREATE POLICY "org members read stages" ON public.stages
  FOR SELECT TO authenticated
  USING (private.is_member(auth.uid(), org_id));

CREATE POLICY "org members access deals" ON public.deals
  FOR ALL TO authenticated
  USING (private.is_member(auth.uid(), org_id))
  WITH CHECK (private.is_member(auth.uid(), org_id));

CREATE POLICY "own ai conversations" ON public.ai_conversations
  FOR ALL TO authenticated
  USING ((user_id = auth.uid()) AND private.is_member(auth.uid(), org_id))
  WITH CHECK ((user_id = auth.uid()) AND private.is_member(auth.uid(), org_id));

CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM public.memberships m1
    JOIN public.memberships m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
  )));
