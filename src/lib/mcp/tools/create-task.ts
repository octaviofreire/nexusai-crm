import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireUserOrg, toolError, toolJson } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Criar tarefa",
  description: "Cria uma tarefa no Nexus CRM atribuída ao usuário logado.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Título da tarefa."),
    description: z.string().trim().optional(),
    due_date: z.string().optional().describe("Data/hora de vencimento em ISO 8601."),
    related_contact_id: z.string().uuid().optional(),
    related_deal_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const res = await requireUserOrg(ctx);
    if (!res.ok) return toolError(res.error);
    const { data, error } = await res.sb
      .from("tasks")
      .insert({
        org_id: res.orgId,
        title: args.title,
        description: args.description ?? null,
        due_date: args.due_date ?? null,
        related_contact_id: args.related_contact_id ?? null,
        related_deal_id: args.related_deal_id ?? null,
        assignee_id: res.uid,
        created_by: res.uid,
      })
      .select()
      .single();
    if (error) return toolError(error.message);
    return toolJson({ task: data });
  },
});
