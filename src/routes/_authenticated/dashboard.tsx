import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveOrgId } from "@/lib/orgs.functions";
import { listDeals, dealsForecast } from "@/lib/deals.functions";
import { listTasks } from "@/lib/tasks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Nexus" }] }),
  component: DashboardPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function DashboardPage() {
  const getOrg = useServerFn(getActiveOrgId);
  const listDealsFn = useServerFn(listDeals);
  const dealsForecastFn = useServerFn(dealsForecast);
  const listTasksFn = useServerFn(listTasks);
  const orgQ = useSuspenseQuery({ queryKey: ["orgId"], queryFn: () => getOrg() });
  const orgId = orgQ.data as string | null;

  const dealsQ = useQuery({
    queryKey: ["deals", orgId], enabled: !!orgId,
    queryFn: () => listDealsFn({ data: { orgId: orgId! } }),
  });
  const forecastQ = useQuery({
    queryKey: ["forecast", orgId], enabled: !!orgId,
    queryFn: () => dealsForecastFn({ data: { orgId: orgId! } }),
  });
  const tasksQ = useQuery({
    queryKey: ["tasks-mine", orgId], enabled: !!orgId,
    queryFn: () => listTasksFn({ data: { orgId: orgId!, onlyMine: true } }),
  });

  if (!orgId) {
    return <div className="p-6 text-muted-foreground">Você ainda não tem uma organização ativa.</div>;
  }

  const deals = dealsQ.data ?? [];
  const openDeals = deals.filter(d => d.status === "open");
  const wonThisMonth = forecastQ.data?.thisMonth.committed ?? 0;
  const tasks = tasksQ.data ?? [];
  const pending = tasks.filter(t => !t.done);
  const conversion = deals.length ? (deals.filter(d => d.status === "won").length / deals.length) * 100 : 0;

  const byStage = Object.entries(
    openDeals.reduce<Record<string, number>>((acc, d) => {
      const k = (d as { stages?: { name?: string } | null; stage_id?: string }).stages?.name ?? "—";
      acc[k] = (acc[k] ?? 0) + Number(d.amount);
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const pieColors = ["oklch(0.55 0.15 258)", "oklch(0.72 0.14 82)", "oklch(0.60 0.15 155)", "oklch(0.58 0.22 25)", "oklch(0.55 0.15 300)"];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Painel</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu funil e das tarefas de hoje.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Pipeline aberto" value={brl.format(forecastQ.data?.total.pipeline ?? 0)} />
        <Kpi label="Previsão ponderada" value={brl.format(forecastQ.data?.total.weighted ?? 0)} />
        <Kpi label="Ganhos no mês" value={brl.format(wonThisMonth)} />
        <Kpi label="Taxa de conversão" value={`${conversion.toFixed(1)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Pipeline por estágio</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => brl.format(v as number)} />
                <Tooltip formatter={(v) => brl.format(v as number)} />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição de valor</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStage} dataKey="value" nameKey="name" outerRadius={100}>
                  {byStage.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => brl.format(v as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Minhas tarefas pendentes</CardTitle></CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem tarefas pendentes. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {pending.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between border-b last:border-0 pb-2">
                  <div>
                    <div className="font-medium text-sm">{t.title}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </div>
                  {t.due_date && (
                    <Badge variant="secondary">{format(new Date(t.due_date), "dd MMM", { locale: ptBR })}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-display font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
