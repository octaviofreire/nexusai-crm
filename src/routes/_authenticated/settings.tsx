import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, listMyOrgs } from "@/lib/orgs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Nexus" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const profile = useSuspenseQuery({ queryKey: ["profile"], queryFn: () => useServerFn(getMyProfile)() });
  const orgs = useSuspenseQuery({ queryKey: ["my-orgs"], queryFn: () => useServerFn(listMyOrgs)() });

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Perfil e organizações.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Meu perfil</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Nome: </span>{profile.data?.full_name ?? "—"}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Minhas organizações</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {orgs.data.map((m) => (
              <li key={m.org_id} className="flex items-center justify-between text-sm">
                <span>{(m as { organizations?: { name?: string } | null }).organizations?.name ?? m.org_id}</span>
                <Badge variant="outline">{m.role}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
