import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireUserOrg, toolError, toolJson } from "../supabase";

export default defineTool({
  name: "search_contacts",
  title: "Buscar contatos",
  description: "Busca contatos da organização por nome ou e-mail.",
  inputSchema: {
    query: z.string().trim().optional().describe("Texto para buscar em nome, sobrenome ou e-mail."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const res = await requireUserOrg(ctx);
    if (!res.ok) return toolError(res.error);
    let q = res.sb
      .from("contacts")
      .select("id,first_name,last_name,email,phone,title,status,lead_score,accounts(name)")
      .eq("org_id", res.orgId)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (query) {
      const like = `%${query.replace(/[%,]/g, "")}%`;
      q = q.or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
    }
    const { data, error } = await q;
    if (error) return toolError(error.message);
    return toolJson({ contacts: data ?? [] });
  },
});
