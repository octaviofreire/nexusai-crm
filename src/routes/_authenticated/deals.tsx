import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveOrgId } from "@/lib/orgs.functions";
import { listPipelines, listDeals, moveDeal, createDeal } from "@/lib/deals.functions";
import { listContacts } from "@/lib/contacts.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/deals")({
  head: () => ({ meta: [{ title: "Vendas — Nexus" }] }),
  component: DealsPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Deal = { id: string; title: string; amount: number; currency: string; probability: number; status: string; stage_id: string; contacts?: { first_name: string; last_name?: string | null } | null; accounts?: { name?: string | null } | null };

function DealsPage() {
  const qc = useQueryClient();
  const getOrg = useServerFn(getActiveOrgId);
  const listPipelinesFn = useServerFn(listPipelines);
  const listDealsFn = useServerFn(listDeals);
  const listContactsFn = useServerFn(listContacts);
  const moveDealFn = useServerFn(moveDeal);
  const orgQ = useSuspenseQuery({ queryKey: ["orgId"], queryFn: () => getOrg() });
  const orgId = orgQ.data as string | null;
  const pipesQ = useQuery({ queryKey: ["pipelines", orgId], enabled: !!orgId, queryFn: () => listPipelinesFn({ data: { orgId: orgId! } }) });
  const dealsQ = useQuery({ queryKey: ["deals", orgId], enabled: !!orgId, queryFn: () => listDealsFn({ data: { orgId: orgId! } }) });
  const contactsQ = useQuery({ queryKey: ["contacts", orgId], enabled: !!orgId, queryFn: () => listContactsFn({ data: { orgId: orgId! } }) });
  const move = useMutation({
    mutationFn: (v: { id: string; stage_id: string }) => moveDealFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!orgId) return null;
  const pipeline = pipesQ.data?.[0];
  const stages = pipeline?.stages ?? [];
  const deals = (dealsQ.data ?? []) as unknown as Deal[];

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const stage_id = String(e.over.id);
    const deal = deals.find(d => d.id === id);
    if (!deal || deal.stage_id === stage_id) return;
    move.mutate({ id, stage_id });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-semibold">Vendas</h1>
          <p className="text-sm text-muted-foreground">Pipeline · arraste os cards para mover de estágio.</p>
        </div>
        {pipeline && <NewDeal orgId={orgId} pipelineId={pipeline.id} stages={stages} contacts={contactsQ.data ?? []} />}
      </div>

      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((s) => {
            const cards = deals.filter(d => d.stage_id === s.id);
            const total = cards.reduce((a, d) => a + Number(d.amount), 0);
            return <StageColumn key={s.id} id={s.id} name={s.name} total={total} count={cards.length}>
              {cards.map(d => <DealCard key={d.id} deal={d} />)}
            </StageColumn>;
          })}
        </div>
        <DragOverlay>{activeId ? <DealCard deal={deals.find(d => d.id === activeId)!} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function StageColumn({ id, name, total, count, children }: { id: string; name: string; total: number; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`w-72 shrink-0 rounded-xl border border-border bg-muted/40 flex flex-col transition-shadow ${isOver ? "ring-2 ring-primary glow-primary" : ""}`}>
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-sm font-display font-semibold">{name}</div>
          <div className="text-xs text-muted-foreground font-mono">{count} · {brl.format(total)}</div>
        </div>
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-32">{children}</div>
    </div>
  );
}

function DealCard({ deal, overlay }: { deal: Deal; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <Card ref={setNodeRef} {...listeners} {...attributes}
      className={`p-3 cursor-grab active:cursor-grabbing bg-card ${isDragging && !overlay ? "opacity-40" : ""}`}>
      <div className="text-sm font-medium">{deal.title}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name ?? ""}` : deal.accounts?.name ?? ""}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold">{brl.format(Number(deal.amount))}</span>
        <Badge variant="outline">{deal.probability}%</Badge>
      </div>
    </Card>
  );
}

function NewDeal({ orgId, pipelineId, stages, contacts }: {
  orgId: string; pipelineId: string;
  stages: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; first_name: string; last_name?: string | null }>;
}) {
  const qc = useQueryClient();
  const createDealFn = useServerFn(createDeal);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("0");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [contactId, setContactId] = useState<string>("");
  const mut = useMutation({
    mutationFn: () => createDealFn({ data: { orgId, pipeline_id: pipelineId, stage_id: stageId, title, amount: Number(amount) || 0, currency: "BRL", contact_id: contactId || null } }),
    onSuccess: () => {
      toast.success("Negócio criado");
      qc.invalidateQueries({ queryKey: ["deals", orgId] });
      setOpen(false); setTitle(""); setAmount("0"); setContactId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo negócio</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo negócio</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
          <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor (R$)</Label><Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Estágio</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Contato</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter><Button type="submit" disabled={mut.isPending || !stageId}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
