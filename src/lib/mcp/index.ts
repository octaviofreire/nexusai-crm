import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listDeals from "./tools/list-deals";
import searchContacts from "./tools/search-contacts";
import getContact from "./tools/get-contact";
import listTasks from "./tools/list-tasks";
import createTask from "./tools/create-task";

// O emissor OAuth precisa ser o host direto do Supabase (o ref sobrevive ao publish).
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "nexus-crm",
  title: "NEXUS CRM",
  version: "0.1.0",
  instructions:
    "Ferramentas do Nexus CRM. Consulte negócios, contatos e tarefas da organização do usuário autenticado e crie tarefas. Todos os dados respeitam as permissões (RLS) do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listDeals, searchContacts, getContact, listTasks, createTask],
});
