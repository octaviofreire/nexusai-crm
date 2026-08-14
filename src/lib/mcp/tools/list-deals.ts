import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireUserOrg, toolError, toolJson } from "../supabase";

export default defineTool({
  name: "list_deals",
  title: "Listar negócios",
  description: "Lista oportunidades de venda da organização do usuário, com filtro por status.",
  inputSchema: {
    status: z.enum(["open", "won", "lost"]).optional().describe("Filtra pelo status do negócio."),
    limit: z.number().int().min(1).max(50).default(20).describe("Máximo de registros."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const res = await requireUserOrg(ctx);
    if (!res.ok) return toolError(res.error);
    let q = res.sb
      .from("deals")
      .select("id,title,amount,currency,probability,status,expected_close_date,stages(name),contacts(first_name,last_name),accounts(name)")
      .eq("org_id", res.orgId)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return toolError(error.message);
    return toolJson({ deals: data ?? [] });
  },
});
