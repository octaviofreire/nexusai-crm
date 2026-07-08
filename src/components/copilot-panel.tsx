import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CopilotPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, [open]);

  const { messages, sendMessage, status, addToolResult } = useChat({
    api: "/api/copilot",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    onError: (e) => toast.error(e.message || "Falha na chamada ao Copilot"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Copilot
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Pergunte qualquer coisa sobre seus dados do Nexus. Exemplos:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>"Liste os negócios abertos com maior valor"</li>
                <li>"Resuma o histórico do contato Marina Alves"</li>
                <li>"Crie uma tarefa para ligar amanhã para o cliente X"</li>
              </ul>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={m.role === "user"
                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%] text-sm"
                : "bg-muted rounded-2xl rounded-tl-sm px-3 py-2 max-w-[95%] text-sm space-y-2"}>
                {m.parts.map((p, i) => {
                  if (p.type === "text") {
                    return m.role === "user"
                      ? <span key={i}>{p.text}</span>
                      : <div key={i} className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{p.text}</ReactMarkdown></div>;
                  }
                  if (p.type === "tool-invocation") {
                    const inv = p.toolInvocation;
                    if (inv.state === "call" || inv.state === "partial-call") {
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed rounded px-2 py-1">
                          <Wrench className="h-3 w-3 animate-pulse" /> Executando <code>{inv.toolName}</code>…
                        </div>
                      );
                    }
                    if (inv.state === "result") {
                      return (
                        <details key={i} className="text-xs border rounded px-2 py-1 bg-background">
                          <summary className="cursor-pointer flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-success" /> {inv.toolName}</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-[10px] max-h-40 overflow-auto">{JSON.stringify(inv.result, null, 2)}</pre>
                        </details>
                      );
                    }
                    // needs-approval
                    if (inv.state === "call" && "toolCallId" in inv) {
                      return null;
                    }
                  }
                  // approval prompt
                  if (p.type === "tool-invocation" && "toolInvocation" in p) {
                    return null;
                  }
                  return null;
                })}
                {/* approval UI for pending human-in-the-loop */}
                {m.parts.filter((p): p is Extract<typeof p, { type: "tool-invocation" }> => p.type === "tool-invocation")
                  .filter((p) => p.toolInvocation.state === "call" && p.toolInvocation.toolName === "create_task")
                  .map((p) => {
                    const inv = p.toolInvocation;
                    return (
                      <div key={inv.toolCallId} className="border rounded-md p-2 bg-background text-xs space-y-2">
                        <div className="font-medium">Aprovar: criar tarefa?</div>
                        <pre className="bg-muted p-2 rounded max-h-40 overflow-auto text-[10px]">{JSON.stringify(inv.args, null, 2)}</pre>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => addToolResult({ toolCallId: inv.toolCallId, result: { approved: true } })}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addToolResult({ toolCallId: inv.toolCallId, result: { approved: false, reason: "Usuário rejeitou" } })}>
                            <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
          {isLoading && <div className="text-xs text-muted-foreground">Copilot está pensando…</div>}
        </div>

        <form onSubmit={submit} className="p-3 border-t flex gap-2">
          <input
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Pergunte ao Copilot…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !token}
          />
          <Button type="submit" size="icon" disabled={isLoading || !token || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
