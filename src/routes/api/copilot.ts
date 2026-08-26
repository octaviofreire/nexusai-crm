import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { COPILOT_SYSTEM_PROMPT } from "@/lib/copilot/system-prompt";
import type { Database } from "@/integrations/supabase/types";

type Body = { messages: UIMessage[] };

async function userSupabase(bearer: string) {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

async function activeOrgId(sb: Awaited<ReturnType<typeof userSupabase>>, uid: string) {
  const { data: profile } = await sb.from("profiles").select("default_org_id").eq("id", uid).maybeSingle();
  if (profile?.default_org_id) return profile.default_org_id as string;
  const { data: m } = await sb.from("memberships").select("org_id").eq("user_id", uid).limit(1).maybeSingle();
  return m?.org_id as string | undefined;
}

export const Route = createFileRoute("/api/copilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const bearer = auth.slice(7);
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { messages } = (await request.json()) as Body;
        const sb = await userSupabase(bearer);
        const { data: userData } = await sb.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) return new Response("Unauthorized", { status: 401 });
        const orgId = await activeOrgId(sb, uid);
        if (!orgId) return new Response("Sem organização ativa", { status: 400 });

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3.7-flash");

        const tools = {
          get_contact: tool({
            description: "Retorna dados de um contato e as últimas interações registradas.",
            inputSchema: z.object({ id: z.string().uuid() }),
            execute: async ({ id }) => {
              const { data: c } = await sb.from("contacts")
                .select("id,first_name,last_name,email,phone,title,status,lead_score,accounts(name)")
                .eq("id", id).maybeSingle();
              if (!c) return { error: "Contato não encontrado ou sem permissão." };
              const { data: inter } = await sb.from("interactions")
                .select("type,subject,body,occurred_at").eq("contact_id", id)
                .order("occurred_at", { ascending: false }).limit(10);
              return { contact: c, interactions: inter ?? [] };
            },
          }),
          list_deals: tool({
            description: "Lista oportunidades de venda com filtros opcionais.",
            inputSchema: z.object({
              status: z.enum(["open","won","lost"]).optional(),
              limit: z.number().int().min(1).max(50).default(20),
            }),
            execute: async ({ status, limit }) => {
              let q = sb.from("deals")
                .select("id,title,amount,currency,probability,status,expected_close_date,stages(name),contacts(first_name,last_name),accounts(name)")
                .eq("org_id", orgId)
                .order("updated_at", { ascending: false })
                .limit(limit);
              if (status) q = q.eq("status", status);
              const { data, error } = await q;
              if (error) return { error: error.message };
              return { deals: data ?? [] };
            },
          }),
          create_task: tool({
            description: "Cria uma tarefa. Exige aprovação do usuário antes de executar.",
            inputSchema: z.object({
              title: z.string().min(1),
              description: z.string().optional(),
              due_date: z.string().optional().describe("ISO date-time"),
              related_contact_id: z.string().uuid().optional(),
              related_deal_id: z.string().uuid().optional(),
            }),
            execute: async (args, { toolCallId }) => {
              // Human-in-the-loop: cliente injeta result antes; se chegar aqui via execute, procedemos.
              // O painel do Copilot renderiza um botão de aprovação para create_task e chama addToolResult.
              // Quando o modelo re-invoca com o result aprovado, executamos:
              void toolCallId;
              const { error, data } = await sb.from("tasks").insert({
                org_id: orgId,
                title: args.title,
                description: args.description ?? null,
                due_date: args.due_date ?? null,
                related_contact_id: args.related_contact_id ?? null,
                related_deal_id: args.related_deal_id ?? null,
                assignee_id: uid,
                created_by: uid,
              }).select().single();
              if (error) return { error: error.message };
              return { created: data };
            },
          }),
        };

        const result = streamText({
          model,
          system: COPILOT_SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
          providerOptions: { lovable: { reasoning: { effort: "low" } } },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages, sendReasoning: true });
      },
    },
  },
});
