import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveOrgId } from "@/lib/orgs.functions";
import { listAccounts, createAccount } from "@/lib/contacts.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Contas — Nexus" }] }),
  component: AccountsPage,
});

function AccountsPage() {
  const getOrg = useServerFn(getActiveOrgId);
  const listAccountsFn = useServerFn(listAccounts);
  const orgQ = useSuspenseQuery({ queryKey: ["orgId"], queryFn: () => getOrg() });
  const orgId = orgQ.data as string | null;
  const list = useQuery({
    queryKey: ["accounts", orgId], enabled: !!orgId,
    queryFn: () => listAccountsFn({ data: { orgId: orgId! } }),
  });
  if (!orgId) return null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">Contas</h1>
          <p className="text-sm text-muted-foreground">Empresas que você atende.</p>
        </div>
        <NewAccount orgId={orgId} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(list.data ?? []).map((a) => (
          <Card key={a.id}><CardContent className="pt-6">
            <div className="font-medium">{a.name}</div>
            <div className="text-xs text-muted-foreground">{a.industry ?? "—"} · {a.size ?? "—"}</div>
            {a.website && <a href={a.website} target="_blank" className="text-xs text-accent hover:underline">{a.website}</a>}
          </CardContent></Card>
        ))}
        {(list.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>}
      </div>
    </div>
  );
}

function NewAccount({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const createAccountFn = useServerFn(createAccount);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [website, setWebsite] = useState("");
  const mut = useMutation({
    mutationFn: () => createAccountFn({ data: { orgId, name, industry, size, website } }),
    onSuccess: () => {
      toast.success("Conta criada");
      qc.invalidateQueries({ queryKey: ["accounts", orgId] });
      setOpen(false); setName(""); setIndustry(""); setSize(""); setWebsite("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova conta</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova conta</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Setor</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
            <div><Label>Porte</Label><Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="ex: 50-200" /></div>
          </div>
          <div><Label>Site</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={mut.isPending}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
