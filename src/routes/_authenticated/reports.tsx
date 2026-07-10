import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getActiveOrgId, getMyProfile } from "@/lib/orgs.functions";
import { listDeals } from "@/lib/deals.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios de Vendas — Nexus" }] }),
  component: ReportsPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Period = "7d" | "30d" | "90d" | "ytd" | "all";
const periodOptions: Array<{ value: Period; label: string }> = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "ytd", label: "No ano" },
  { value: "all", label: "Todo o período" },
];

function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === "all") return null;
  if (p === "ytd") return new Date(now.getFullYear(), 0, 1);
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

type DealRow = {
  id: string;
  amount: number;
  status: "open" | "won" | "lost";
  owner_id: string | null;
  created_at?: string;
  updated_at: string;
  expected_close_date: string | null;
  stage_id: string;
};

function ReportsPage() {
  const getOrg = useServerFn(getActiveOrgId);
  const getProfile = useServerFn(getMyProfile);
  const listDealsFn = useServerFn(listDeals);
  const orgQ = useSuspenseQuery({ queryKey: ["orgId"], queryFn: () => getOrg() });
  const orgId = orgQ.data as string | null;
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const dealsQ = useQuery({
    queryKey: ["deals", orgId],
    enabled: !!orgId,
    queryFn: () => listDealsFn({ data: { orgId: orgId! } }),
  });

  const [period, setPeriod] = useState<Period>("30d");
  const [owner, setOwner] = useState<string>("all");

  const deals = (dealsQ.data ?? []) as unknown as DealRow[];

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) if (d.owner_id) set.add(d.owner_id);
    return Array.from(set);
  }, [deals]);

  const filtered = useMemo(() => {
    const start = periodStart(period);
    return deals.filter((d) => {
      if (owner !== "all" && d.owner_id !== owner) return false;
      if (!start) return true;
      // filtra pela data mais recente de atividade (fechamento aproximado = updated_at)
      const ref = new Date(d.updated_at);
      return ref >= start;
    });
  }, [deals, period, owner]);

  const won = filtered.filter((d) => d.status === "won");
  const lost = filtered.filter((d) => d.status === "lost");
  const open = filtered.filter((d) => d.status === "open");

  const closed = won.length + lost.length;
  const conversion = closed ? (won.length / closed) * 100 : 0;
  const ticket = won.length ? won.reduce((a, d) => a + Number(d.amount), 0) / won.length : 0;
  const wonTotal = won.reduce((a, d) => a + Number(d.amount), 0);
  const openTotal = open.reduce((a, d) => a + Number(d.amount), 0);

  // Ciclo de vendas: dias entre created_at e updated_at (data efetiva de mudança para "won")
  const cycleDays =
    won.length && won.every((d) => d.created_at)
      ? won.reduce((a, d) => {
          const start = new Date(d.created_at as string).getTime();
          const end = new Date(d.updated_at).getTime();
          return a + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        }, 0) / won.length
      : 0;

  // Série mensal (ganhos e perdas por mês)
  const monthly = useMemo(() => {
    const map = new Map<string, { key: string; won: number; lost: number; wonAmount: number }>();
    for (const d of [...won, ...lost]) {
      const dt = new Date(d.updated_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) ?? { key, won: 0, lost: 0, wonAmount: 0 };
      if (d.status === "won") {
        cur.won += 1;
        cur.wonAmount += Number(d.amount);
      } else cur.lost += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [won, lost]);

  // Ranking por vendedor
  const ranking = useMemo(() => {
    const map = new Map<string, { owner_id: string; won: number; lost: number; open: number; revenue: number }>();
    for (const d of filtered) {
      const k = d.owner_id ?? "—";
      const cur = map.get(k) ?? { owner_id: k, won: 0, lost: 0, open: 0, revenue: 0 };
      if (d.status === "won") {
        cur.won += 1;
        cur.revenue += Number(d.amount);
      } else if (d.status === "lost") cur.lost += 1;
      else cur.open += 1;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const ownerLabel = (id: string) => {
    if (profileQ.data?.id === id) return profileQ.data.full_name ?? "Você";
    return id === "—" ? "Sem responsável" : `${id.slice(0, 8)}…`;
  };

  if (!orgId) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">Relatórios de Vendas</h1>
          <p className="text-sm text-muted-foreground">
            KPIs de conversão, ticket médio e ciclo de vendas com filtros por vendedor e período.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="w-48">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Label className="text-xs text-muted-foreground">Vendedor</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {owners.map((id) => (
                  <SelectItem key={id} value={id}>{ownerLabel(id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Taxa de conversão" value={`${conversion.toFixed(1)}%`} hint={`${won.length} ganhos · ${lost.length} perdidos`} />
        <Kpi label="Ticket médio" value={brl.format(ticket)} hint={`${won.length} negócios ganhos`} />
        <Kpi label="Ciclo de vendas" value={cycleDays ? `${cycleDays.toFixed(1)} dias` : "—"} hint="Da criação ao fechamento" />
        <Kpi label="Receita ganha" value={brl.format(wonTotal)} hint={`Pipeline aberto: ${brl.format(openTotal)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Ganhos x Perdidos por mês</CardTitle></CardHeader>
          <CardContent className="h-72">
            {monthly.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="key" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="won" name="Ganhos" fill="oklch(0.60 0.15 155)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="lost" name="Perdidos" fill="oklch(0.58 0.22 25)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Receita ganha por mês</CardTitle></CardHeader>
          <CardContent className="h-72">
            {monthly.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="key" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => brl.format(v as number)} />
                  <Tooltip formatter={(v) => brl.format(v as number)} />
                  <Line type="monotone" dataKey="wonAmount" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} name="Receita" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ranking por vendedor</CardTitle></CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3">Vendedor</th>
                    <th className="text-right py-2 px-3">Ganhos</th>
                    <th className="text-right py-2 px-3">Perdidos</th>
                    <th className="text-right py-2 px-3">Em aberto</th>
                    <th className="text-right py-2 px-3">Conversão</th>
                    <th className="text-right py-2 pl-3">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => {
                    const closed = r.won + r.lost;
                    const conv = closed ? (r.won / closed) * 100 : 0;
                    return (
                      <tr key={r.owner_id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{ownerLabel(r.owner_id)}</td>
                        <td className="text-right py-2 px-3">{r.won}</td>
                        <td className="text-right py-2 px-3">{r.lost}</td>
                        <td className="text-right py-2 px-3">{r.open}</td>
                        <td className="text-right py-2 px-3">
                          <Badge variant="secondary">{conv.toFixed(0)}%</Badge>
                        </td>
                        <td className="text-right py-2 pl-3 font-medium">{brl.format(r.revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-display font-semibold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados no período.</div>;
}
