import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveOrgId } from "@/lib/orgs.functions";
import { listContacts, createContact, listAccounts } from "@/lib/contacts.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({ meta: [{ title: "Contatos — Nexus" }] }),
  component: ContactsPage,
});

function ContactsPage() {
  const orgQ = useSuspenseQuery({ queryKey: ["orgId"], queryFn: () => useServerFn(getActiveOrgId)() });
  const orgId = orgQ.data as string | null;
  const [q, setQ] = useState("");

  const contactsQ = useQuery({
    queryKey: ["contacts", orgId], enabled: !!orgId,
    queryFn: () => useServerFn(listContacts)({ data: { orgId: orgId! } }),
  });
  const accountsQ = useQuery({
    queryKey: ["accounts", orgId], enabled: !!orgId,
    queryFn: () => useServerFn(listAccounts)({ data: { orgId: orgId! } }),
  });

  if (!orgId) return null;
  const rows = (contactsQ.data ?? []).filter((c) => {
    if (!q) return true;
    const t = `${c.first_name} ${c.last_name ?? ""} ${c.email ?? ""}`.toLowerCase();
    return t.includes(q.toLowerCase());
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">Contatos</h1>
          <p className="text-sm text-muted-foreground">Leads, contatos qualificados e clientes.</p>
        </div>
        <NewContactDialog orgId={orgId} accounts={accountsQ.data ?? []} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar por nome ou email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Cargo</th>
                <th className="text-left px-4 py-2">Empresa</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/40">
                  <td className="px-4 py-2 font-medium">
                    <Link to="/contacts/$id" params={{ id: c.id }} className="hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{c.title ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{(c as { accounts?: { name?: string } | null }).accounts?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2 font-medium">{c.lead_score}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum contato encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    lead: "bg-secondary text-secondary-foreground",
    qualified: "bg-accent text-accent-foreground",
    customer: "bg-success text-success-foreground",
    archived: "bg-muted text-muted-foreground",
  };
  const label: Record<string, string> = { lead: "Lead", qualified: "Qualificado", customer: "Cliente", archived: "Arquivado" };
  return <Badge className={map[status]}>{label[status] ?? status}</Badge>;
}

function NewContactDialog({ orgId, accounts }: { orgId: string; accounts: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const mut = useMutation({
    mutationFn: (v: { first_name: string; last_name?: string; email?: string; title?: string; account_id?: string }) =>
      useServerFn(createContact)({ data: { orgId, ...v, account_id: v.account_id || null, email: v.email || null } }),
    onSuccess: () => {
      toast.success("Contato criado");
      qc.invalidateQueries({ queryKey: ["contacts", orgId] });
      setOpen(false); setFirst(""); setLast(""); setEmail(""); setTitle(""); setAccountId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo contato</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo contato</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate({ first_name: first, last_name: last, email, title, account_id: accountId }); }}>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} required /></div>
            <div><Label>Sobrenome</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Cargo</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button type="submit" disabled={mut.isPending}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
