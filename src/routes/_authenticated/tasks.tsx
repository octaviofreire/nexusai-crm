import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveOrgId } from "@/lib/orgs.functions";
import { listTasks, createTask, toggleTask } from "@/lib/tasks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tarefas — Nexus" }] }),
  component: TasksPage,
});

function TasksPage() {
  const qc = useQueryClient();
  const getOrg = useServerFn(getActiveOrgId);
  const listTasksFn = useServerFn(listTasks);
  const toggleTaskFn = useServerFn(toggleTask);
  const orgQ = useSuspenseQuery({ queryKey: ["orgId"], queryFn: () => getOrg() });
  const orgId = orgQ.data as string | null;
  const list = useQuery({
    queryKey: ["tasks", orgId], enabled: !!orgId,
    queryFn: () => listTasksFn({ data: { orgId: orgId! } }),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggleTaskFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", orgId] }),
  });
  if (!orgId) return null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Suas ações do dia.</p>
        </div>
        <NewTask orgId={orgId} />
      </div>
      <Card><CardContent className="p-0">
        <ul className="divide-y">
          {(list.data ?? []).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <Checkbox checked={t.done} onCheckedChange={(v) => toggle.mutate({ id: t.id, done: Boolean(v) })} />
              <div className="flex-1">
                <div className={`text-sm ${t.done ? "line-through text-muted-foreground" : "font-medium"}`}>{t.title}</div>
                {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
              </div>
              {t.due_date && <div className="text-xs text-muted-foreground">{format(new Date(t.due_date), "dd MMM")}</div>}
            </li>
          ))}
          {(list.data ?? []).length === 0 && <li className="p-8 text-center text-muted-foreground text-sm">Nenhuma tarefa.</li>}
        </ul>
      </CardContent></Card>
    </div>
  );
}

function NewTask({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const createTaskFn = useServerFn(createTask);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const mut = useMutation({
    mutationFn: () => createTaskFn({ data: { orgId, title, description, due_date: dueDate || null } }),
    onSuccess: () => {
      toast.success("Tarefa criada");
      qc.invalidateQueries({ queryKey: ["tasks", orgId] });
      setOpen(false); setTitle(""); setDescription(""); setDueDate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova tarefa</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
          <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Vencimento</Label><Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={mut.isPending}>Salvar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
