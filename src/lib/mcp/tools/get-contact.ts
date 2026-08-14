import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireUserOrg, toolError, toolJson } from "../supabase";

export default defineTool({
  name: "get_contact",
  title: "Detalhes do contato",
  description: "Retorna os dados de um contato e suas últimas interações registradas.",
  inputSchema: { id: z.string().uuid().describe("ID do contato.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const res = await requireUserOrg(ctx);
    if (res.error) return toolError(res.error);
    const { data: contact, error } = await res.sb
      .from("contacts")
      .select("id,first_name,last_name,email,phone,title,status,lead_score,accounts(name)")
      .eq("id", id)
      .maybeSingle();
    if (error) return toolError(error.message);
    if (!contact) return toolError("Contato não encontrado ou sem permissão de acesso.");
    const { data: interactions } = await res.sb
      .from("interactions")
      .select("type,subject,body,occurred_at")
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false })
      .limit(10);
    return toolJson({ contact, interactions: interactions ?? [] });
  },
});
