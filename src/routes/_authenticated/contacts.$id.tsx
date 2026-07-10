import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getContact, addInteraction } from "@/lib/contacts.functions";
import { getActiveOrgId } from "@/lib/orgs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Mail, Phone, Building2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contacts/$id")({
  component: ContactDetail,
});

function ContactDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getOrg = useServerFn(getActiveOrgId);
  const getContactFn = useServerFn(getContact);
  const addInteractionFn = useServerFn(addInteraction);
  const orgQ = useQuery({ queryKey: ["orgId"], queryFn: () => getOrg() });
  const q = useQuery({ queryKey: ["contact", id], queryFn: () => getContactFn({ data: { id } }) });
  const [note, setNote] = useState("");
  const orgId = orgQ.data as string | null;

  const addM = useMutation({
    mutationFn: () => addInteractionFn({ data: { orgId: orgId!, contact_id: id, type: "note", body: note } }),
    onSuccess: () => {
      toast.success("Nota adicionada");
      setNote("");
      qc.invalidateQueries({ queryKey: ["contact", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="p-6">Carregando…</div>;
  const c = q.data?.contact;
  if (!c) return <div className="p-6">Contato não encontrado.</div>;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <Link to="/contacts" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Voltar</Link>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-display">{c.first_name} {c.last_name}</CardTitle>
            <div className="text-sm text-muted-foreground">{c.title}</div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {c.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {c.email}</div>}
            {c.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {c.phone}</div>}
            {(c as { accounts?: { name?: string } | null }).accounts?.name && (
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /> {(c as { accounts: { name: string } }).accounts.name}</div>
            )}
            <div className="pt-2"><Badge>Score {c.lead_score}</Badge></div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Nova nota</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escreva uma nota sobre esse contato…" />
              <div className="flex justify-end">
                <Button disabled={!note.trim() || addM.isPending || !orgId} onClick={() => addM.mutate()}>Salvar nota</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(q.data?.interactions ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem interações ainda.</p>}
              {q.data?.interactions.map((it) => (
                <div key={it.id} className="border-l-2 border-accent pl-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" /> {it.type} · {format(new Date(it.occurred_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                  </div>
                  {it.subject && <div className="font-medium text-sm">{it.subject}</div>}
                  <div className="text-sm whitespace-pre-wrap">{it.body}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Negócios</CardTitle></CardHeader>
            <CardContent>
              {(q.data?.deals ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem negócios vinculados.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {q.data?.deals.map((d) => (
                    <li key={d.id} className="flex justify-between">
                      <span>{d.title}</span>
                      <span className="text-muted-foreground">{Intl.NumberFormat("pt-BR", { style: "currency", currency: d.currency }).format(Number(d.amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
