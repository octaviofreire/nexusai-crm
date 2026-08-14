import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireUserOrg, toolError, toolJson } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas",
  description: "Lista tarefas da organização, opcionalmente apenas as pendentes ou as do usuário logado.",
  inputSchema: {
    only_mine: z.boolean().default(false).describe("Somente tarefas atribuídas ao usuário logado."),
    only_open: z.boolean().default(true).describe("Somente tarefas ainda não concluídas."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ only_mine, only_open, limit }, ctx) => {
    const res = await requireUserOrg(ctx);
    if (res.error) return toolError(res.error);
    let q = res.sb
      .from("tasks")
      .select("id,title,description,due_date,done,assignee_id,related_contact_id,related_deal_id")
      .eq("org_id", res.orgId)
      .order("due_date", { ascending: true })
      .limit(limit ?? 20);
    if (only_mine) q = q.eq("assignee_id", res.uid);
    if (only_open !== false) q = q.eq("done", false);
    const { data, error } = await q;
    if (error) return toolError(error.message);
    return toolJson({ tasks: data ?? [] });
  },
});
