import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrgInput = z.object({ orgId: z.string().uuid() });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, title, status, lead_score, tags, account_id, accounts(name), updated_at")
      .eq("org_id", data.orgId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateContactInput = z.object({
  orgId: z.string().uuid(),
  first_name: z.string().min(1),
  last_name: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  status: z.enum(["lead","qualified","customer","archived"]).default("lead"),
});

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateContactInput.parse(d))
  .handler(async ({ context, data }) => {
    const { orgId, email, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("contacts")
      .insert({ ...rest, org_id: orgId, owner_id: context.userId, email: email || null })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const [{ data: c, error }, { data: inter }, { data: dealsRows }] = await Promise.all([
      context.supabase.from("contacts").select("*, accounts(id,name,industry)").eq("id", data.id).maybeSingle(),
      context.supabase.from("interactions").select("*").eq("contact_id", data.id).order("occurred_at", { ascending: false }).limit(50),
      context.supabase.from("deals").select("id,title,amount,currency,status,stage_id,stages(name)").eq("contact_id", data.id).order("updated_at",{ascending:false}),
    ]);
    if (error) throw new Error(error.message);
    return { contact: c, interactions: inter ?? [], deals: dealsRows ?? [] };
  });

export const addInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    contact_id: z.string().uuid(),
    type: z.enum(["note","call","email","meeting","task"]).default("note"),
    subject: z.string().optional().nullable(),
    body: z.string().min(1),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("interactions").insert({
      org_id: data.orgId, contact_id: data.contact_id, type: data.type,
      subject: data.subject, body: data.body, user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("accounts").select("*").eq("org_id", data.orgId)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    name: z.string().min(1),
    website: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    size: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { orgId, ...rest } = data;
    const { data: row, error } = await context.supabase.from("accounts").insert({
      ...rest, org_id: orgId, owner_id: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
