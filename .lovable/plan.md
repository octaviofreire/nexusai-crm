# Nexus CRM — Plano do MVP

Stack: TanStack Start + React + TypeScript + Tailwind + shadcn, Lovable Cloud (Supabase), Lovable AI Gateway (Claude Sonnet via `anthropic/*` no gateway — na prática usaremos `google/gemini-3-flash-preview` como default e permitiremos escolher Claude nas ferramentas). Multi-tenant via `organizations` + RLS.

## Fases

### Fase 1 — Fundações

- Habilitar Lovable Cloud e criar `LOVABLE_API_KEY`.
- Design system Nexus: tema claro/escuro corporativo (azul-marinho + âmbar de destaque), tipografia Inter/Space Grotesk, tokens em `src/styles.css`.
- Auth: email/senha + Google. Página `/auth`, layout `_authenticated`.

### Fase 2 — Modelo de dados (multi-tenant)

Todas as tabelas com `org_id uuid not null` + RLS `org_id = current_org()`.

```text
organizations(id, name, created_at)
memberships(user_id, org_id, role)          role ∈ admin|manager|sales|support|marketing
app_role (enum)                              -- separado, nunca em profile
profiles(id=auth.users.id, full_name, avatar_url, default_org_id)

accounts(id, org_id, name, website, industry, size, owner_id, tags[])
contacts(id, org_id, account_id?, first_name, last_name, email, phone,
         title, owner_id, tags[], lead_score int default 0, status)
interactions(id, org_id, contact_id, type, subject, body, occurred_at, user_id)

pipelines(id, org_id, name, is_default)
stages(id, pipeline_id, name, order_index, win_probability numeric)
deals(id, org_id, pipeline_id, stage_id, account_id?, contact_id?,
      title, amount numeric, currency, expected_close_date, probability,
      status ∈ open|won|lost, owner_id, created_at, updated_at)

tasks(id, org_id, title, description, due_date, assignee_id,
      related_contact_id?, related_deal_id?, done bool)

ai_conversations(id, org_id, user_id, title, created_at)
ai_messages(id, conversation_id, role, parts jsonb, created_at)
```

Segurança:

- Função `has_role(user, org, role)` SECURITY DEFINER + `current_org()` que lê `memberships`.
- RLS em todas as tabelas: `org_id = current_org()`; escritas exigem membership; alterações de estágio/owner exigem `sales`/`manager`/`admin`.
- GRANTs explícitos em cada tabela para `authenticated` (+ `service_role`).
- Trigger `on_auth_user_created` cria `profile` e uma `organization` inicial + `membership admin`.

### Fase 3 — Backend (TanStack server functions)

Camadas em `src/lib/`:

- `orgs.functions.ts` — listar orgs do usuário, trocar org ativa (via `default_org_id`).
- `contacts.functions.ts` — CRUD contatos/contas, busca, tags, importação CSV.
- `deals.functions.ts` — CRUD deals, mover de estágio (Kanban), forecast.
- `interactions.functions.ts` — timeline.
- `tasks.functions.ts` — CRUD tarefas.
- Todas com `.middleware([requireSupabaseAuth])` + validação Zod.

### Fase 4 — Frontend

Rotas sob `_authenticated`:

- `/` — Dashboard: KPIs (pipeline aberto, ganhos do mês, taxa conversão, tarefas hoje) + gráficos Recharts.
- `/contacts` — Lista + filtros + drawer de detalhes com timeline.
- `/contacts/$id` — Perfil completo: dados, deals vinculados, tarefas, interações, botão "Perguntar ao Copilot".
- `/accounts` — Lista de contas, drill-in.
- `/deals` — Kanban por estágio (drag & drop com `@dnd-kit`), filtro por owner/pipeline, criação rápida.
- `/deals/$id` — Detalhe do negócio.
- `/tasks` — Lista de tarefas do usuário.
- `/settings` — Perfil, organização, membros (admin), pipelines.
- `/auth` — Login/signup.

Componentes: `AppShell` com sidebar, header com switcher de organização e botão flutuante do Copilot.

### Fase 5 — Copilot IA

- Painel lateral (`Sheet`) acessível em qualquer tela via botão flutuante ⌘K.
- Rota de streaming `src/routes/api/copilot.ts` usando AI SDK + Lovable AI Gateway.
- Modelo default: `google/gemini-3-flash-preview` (rápido). Opção Claude via `anthropic/claude-*` se catalogado.
- System prompt do Copilot (versão editável em `src/lib/copilot/system-prompt.ts` — comentário explica como ajustar).
- Persistência das conversas em `ai_conversations`/`ai_messages` (escopo por usuário+org).
- Tools implementadas nesta fase:
  1. `get_contact(id)` — dados + últimas interações.
  2. `list_deals(filters)` — por estágio/owner/status.
  3. `create_task({title, due_date, assignee, related_contact_id?})` — com `needsApproval` (confirmação no chat).
- Todas as tools respeitam RLS (usam o Supabase autenticado do usuário via `requireSupabaseAuth`).
- Renderização de `message.parts` + markdown + estados de tool call.

### Fase 6 — Qualidade

- Testes Vitest para regras críticas:
  - `forecast(deals)` = Σ amount × probability por período.
  - `leadScore(contact, interactions)` — heurística inicial (recência, número de deals, cargo).
- Seed de dados demo (migration) para a org inicial: 2 pipelines, ~15 contatos, ~10 deals.
- Sitemap/robots, metadata SEO na landing pública (uma landing simples em `/` fora do `_authenticated` fica para depois — no MVP `/` já é o dashboard após login e `/auth` é a porta).

## Fora do MVP (fases seguintes)

Atendimento (tickets/SLA), Marketing (campanhas/scoring automatizado), auditoria completa, importação avançada, base de conhecimento, tools 4-7 do Copilot (`draft_email`, `search_knowledge_base`, `get_dashboard_metrics`, `list_tickets`).

## Entrega desta rodada

Fases 1 → 5 completas e navegáveis, com Copilot funcional usando 3 tools e confirmação para ações destrutivas. Fase 6 (testes + seed) incluída.

Confirma para eu começar?