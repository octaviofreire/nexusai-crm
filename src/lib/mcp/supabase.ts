import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function supabaseProjectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
  return url;
}

function supabasePublishableKey(): string {
  const direct = configuredEnv(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      // fall through to legacy names
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required");
}

/** Cliente Supabase que encaminha o token verificado do usuário — RLS roda como ele. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient<Database>(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type UserClient = ReturnType<typeof supabaseForUser>;

/** Organização ativa do usuário (perfil padrão ou primeira associação). */
export async function activeOrgId(sb: UserClient, uid: string): Promise<string | undefined> {
  const { data: profile } = await sb.from("profiles").select("default_org_id").eq("id", uid).maybeSingle();
  if (profile?.default_org_id) return profile.default_org_id as string;
  const { data: m } = await sb.from("memberships").select("org_id").eq("user_id", uid).limit(1).maybeSingle();
  return (m?.org_id as string | undefined) ?? undefined;
}

/** Resolve cliente + org, ou devolve um erro de ferramenta pronto para retorno. */
export async function requireUserOrg(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) return { error: "Não autenticado." as const };
  const sb = supabaseForUser(ctx);
  const uid = ctx.getUserId();
  if (!uid) return { error: "Token sem identificação de usuário." as const };
  const orgId = await activeOrgId(sb, uid);
  if (!orgId) return { error: "Usuário sem organização ativa no Nexus CRM." as const };
  return { sb, uid, orgId };
}

export function toolError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}

export function toolJson(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}
