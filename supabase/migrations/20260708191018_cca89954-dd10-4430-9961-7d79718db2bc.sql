
-- =====================================================================
-- ENUMS
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('admin','manager','sales','support','marketing');
CREATE TYPE public.contact_status AS ENUM ('lead','qualified','customer','archived');
CREATE TYPE public.deal_status AS ENUM ('open','won','lost');
CREATE TYPE public.interaction_type AS ENUM ('note','call','email','meeting','task');

-- =====================================================================
-- ORGANIZATIONS
-- =====================================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- MEMBERSHIPS
-- =====================================================================
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'sales',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, role)
);
CREATE INDEX ON public.memberships (user_id);
CREATE INDEX ON public.memberships (org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- PROFILES
-- =====================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  default_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND org_id = _org_id);
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _org_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND org_id = _org_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _org_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND org_id = _org_id AND role = ANY(_roles));
$$;

-- =====================================================================
-- ORG / MEMBERSHIP / PROFILE POLICIES
-- =====================================================================
CREATE POLICY "members read own orgs" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_member(auth.uid(), id));
CREATE POLICY "admins update own orgs" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), id, 'admin'));
CREATE POLICY "authenticated create org" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "members read own memberships" ON public.memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_member(auth.uid(), org_id));
CREATE POLICY "admins manage memberships" ON public.memberships
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin'));

CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.memberships m1
    JOIN public.memberships m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
  ));
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- =====================================================================
-- ACCOUNTS
-- =====================================================================
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text,
  industry text,
  size text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.accounts (org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members access accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.is_member(auth.uid(), org_id))
  WITH CHECK (public.is_member(auth.uid(), org_id));

-- =====================================================================
-- CONTACTS
-- =====================================================================
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  title text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  lead_score integer NOT NULL DEFAULT 0,
  status public.contact_status NOT NULL DEFAULT 'lead',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.contacts (org_id);
CREATE INDEX ON public.contacts (account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members access contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (public.is_member(auth.uid(), org_id))
  WITH CHECK (public.is_member(auth.uid(), org_id));

-- =====================================================================
-- INTERACTIONS (timeline)
-- =====================================================================
CREATE TABLE public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id uuid,
  type public.interaction_type NOT NULL DEFAULT 'note',
  subject text,
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.interactions (org_id);
CREATE INDEX ON public.interactions (contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactions TO authenticated;
GRANT ALL ON public.interactions TO service_role;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members access interactions" ON public.interactions
  FOR ALL TO authenticated
  USING (public.is_member(auth.uid(), org_id))
  WITH CHECK (public.is_member(auth.uid(), org_id));

-- =====================================================================
-- PIPELINES / STAGES
-- =====================================================================
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.pipelines (org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipelines TO authenticated;
GRANT ALL ON public.pipelines TO service_role;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read pipelines" ON public.pipelines
  FOR SELECT TO authenticated USING (public.is_member(auth.uid(), org_id));
CREATE POLICY "managers write pipelines" ON public.pipelines
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), org_id, ARRAY['admin','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), org_id, ARRAY['admin','manager']::public.app_role[]));

CREATE TABLE public.stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  win_probability numeric(5,2) NOT NULL DEFAULT 0,
  is_closed boolean NOT NULL DEFAULT false,
  is_won boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stages (pipeline_id);
CREATE INDEX ON public.stages (org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stages TO authenticated;
GRANT ALL ON public.stages TO service_role;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read stages" ON public.stages
  FOR SELECT TO authenticated USING (public.is_member(auth.uid(), org_id));
CREATE POLICY "managers write stages" ON public.stages
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), org_id, ARRAY['admin','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), org_id, ARRAY['admin','manager']::public.app_role[]));

-- =====================================================================
-- DEALS
-- =====================================================================
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE RESTRICT,
  stage_id uuid NOT NULL REFERENCES public.stages(id) ON DELETE RESTRICT,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  expected_close_date date,
  probability numeric(5,2) NOT NULL DEFAULT 0,
  status public.deal_status NOT NULL DEFAULT 'open',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.deals (org_id);
CREATE INDEX ON public.deals (stage_id);
CREATE INDEX ON public.deals (owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members access deals" ON public.deals
  FOR ALL TO authenticated
  USING (public.is_member(auth.uid(), org_id))
  WITH CHECK (public.is_member(auth.uid(), org_id));

ALTER TABLE public.interactions
  ADD CONSTRAINT interactions_deal_fk FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;

-- =====================================================================
-- TASKS
-- =====================================================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  related_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  related_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  done boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tasks (org_id);
CREATE INDEX ON public.tasks (assignee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members access tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_member(auth.uid(), org_id))
  WITH CHECK (public.is_member(auth.uid(), org_id));

-- =====================================================================
-- AI CONVERSATIONS
-- =====================================================================
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ai_conversations (user_id, org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai conversations" ON public.ai_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_member(auth.uid(), org_id))
  WITH CHECK (user_id = auth.uid() AND public.is_member(auth.uid(), org_id));

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  parts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ai_messages (conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai messages" ON public.ai_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

-- =====================================================================
-- updated_at trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_accounts_upd BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_contacts_upd BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_deals_upd BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_tasks_upd BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER t_ai_conv_upd BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================================
-- BOOTSTRAP NEW USER: create profile + org + admin membership + default pipeline
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id uuid;
  new_pipeline_id uuid;
  display_name text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));

  INSERT INTO public.organizations (name) VALUES (display_name || '''s Workspace')
    RETURNING id INTO new_org_id;

  INSERT INTO public.memberships (user_id, org_id, role) VALUES (NEW.id, new_org_id, 'admin');

  INSERT INTO public.profiles (id, full_name, default_org_id)
    VALUES (NEW.id, display_name, new_org_id);

  INSERT INTO public.pipelines (org_id, name, is_default)
    VALUES (new_org_id, 'Pipeline padrão', true) RETURNING id INTO new_pipeline_id;

  INSERT INTO public.stages (pipeline_id, org_id, name, order_index, win_probability, is_closed, is_won) VALUES
    (new_pipeline_id, new_org_id, 'Prospecção', 0, 10, false, false),
    (new_pipeline_id, new_org_id, 'Qualificação', 1, 25, false, false),
    (new_pipeline_id, new_org_id, 'Proposta', 2, 50, false, false),
    (new_pipeline_id, new_org_id, 'Negociação', 3, 75, false, false),
    (new_pipeline_id, new_org_id, 'Ganho', 4, 100, true, true),
    (new_pipeline_id, new_org_id, 'Perdido', 5, 0, true, false);

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
