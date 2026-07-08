import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("memberships")
      .select("role, org_id, organizations(id,name)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles").select("*").eq("id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const getActiveOrgId = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles").select("default_org_id").eq("id", context.userId).maybeSingle();
    if (data?.default_org_id) return data.default_org_id as string;
    const { data: m } = await context.supabase
      .from("memberships").select("org_id").eq("user_id", context.userId).limit(1).maybeSingle();
    return (m?.org_id as string | undefined) ?? null;
  });
