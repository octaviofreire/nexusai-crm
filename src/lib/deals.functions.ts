import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { forecast } from "./business";

const OrgInput = z.object({ orgId: z.string().uuid() });

export const listPipelines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("pipelines").select("*, stages(*)").eq("org_id", data.orgId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((p) => ({
      ...p,
      stages: (p.stages ?? []).sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index),
    }));
  });

export const listDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    pipelineId: z.string().uuid().optional(),
    status: z.enum(["open","won","lost"]).optional(),
    ownerId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("deals")
      .select("id,title,amount,currency,probability,status,expected_close_date,stage_id,pipeline_id,contact_id,account_id,owner_id,updated_at, contacts(first_name,last_name), accounts(name)")
      .eq("org_id", data.orgId)
      .order("updated_at", { ascending: false });
    if (data.pipelineId) q = q.eq("pipeline_id", data.pipelineId);
    if (data.status) q = q.eq("status", data.status);
    if (data.ownerId) q = q.eq("owner_id", data.ownerId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    orgId: z.string().uuid(),
    pipeline_id: z.string().uuid(),
    stage_id: z.string().uuid(),
    title: z.string().min(1),
    amount: z.number().nonnegative().default(0),
    currency: z.string().default("BRL"),
    contact_id: z.string().uuid().optional().nullable(),
    account_id: z.string().uuid().optional().nullable(),
    expected_close_date: z.string().optional().nullable(),
    probability: z.number().min(0).max(100).default(0),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { orgId, ...rest } = data;
    const { data: row, error } = await context.supabase.from("deals").insert({
      ...rest, org_id: orgId, owner_id: context.userId, status: "open" as const,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const moveDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    stage_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: stage } = await context.supabase.from("stages").select("win_probability,is_closed,is_won").eq("id", data.stage_id).maybeSingle();
    const patch: { stage_id: string; probability?: number; status?: "open"|"won"|"lost" } = { stage_id: data.stage_id };
    if (stage) {
      patch.probability = Number(stage.win_probability);
      patch.status = stage.is_closed ? (stage.is_won ? "won" : "lost") : "open";
    }
    const { error } = await context.supabase.from("deals").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dealsForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("deals").select("amount,probability,expected_close_date,status").eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 0);
    const deals = (rows ?? []).map(r => ({
      amount: Number(r.amount), probability: Number(r.probability),
      expected_close_date: r.expected_close_date, status: r.status as "open"|"won"|"lost",
    }));
    return {
      total: forecast(deals),
      thisMonth: forecast(deals, monthStart, monthEnd),
    };
  });
