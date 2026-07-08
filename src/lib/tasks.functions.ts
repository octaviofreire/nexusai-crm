import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid(), onlyMine: z.boolean().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    let q = context.supabase.from("tasks").select("*").eq("org_id", data.orgId).order("due_date", { ascending: true, nullsFirst: false });
    if (data.onlyMine) q = q.eq("assignee_id", context.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    due_date: z.string().optional().nullable(),
    assignee_id: z.string().uuid().optional().nullable(),
    related_contact_id: z.string().uuid().optional().nullable(),
    related_deal_id: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from("tasks").insert({
      ...data, org_id: data.orgId, created_by: context.userId,
      assignee_id: data.assignee_id ?? context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tasks").update({ done: data.done }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
