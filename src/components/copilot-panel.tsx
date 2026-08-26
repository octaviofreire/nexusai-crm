import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, CheckCircle2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CopilotPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [input, setInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, [open]);

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/copilot",
      headers: (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (e) => toast.error(e.message || "Falha no Copilot"),
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
                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap"
                : "bg-muted rounded-2xl rounded-tl-sm px-3 py-2 max-w-[95%] text-sm space-y-2"}>
                {m.parts.map((p, i) => {
                  if (p.type === "text") {
                    return m.role === "user"
                      ? <span key={i}>{p.text}</span>
                      : <div key={i} className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{p.text}</ReactMarkdown></div>;
                  }
                  if (p.type === "reasoning") {
                    const rp = p as { text?: string; state?: string };
                    if (!rp.text) return null;
                    return (
                      <details key={i} className="text-xs border rounded px-2 py-1 bg-background/60 text-muted-foreground">
                        <summary className="cursor-pointer flex items-center gap-2"><Sparkles className="h-3 w-3" /> Raciocínio</summary>
                        <div className="mt-1 whitespace-pre-wrap">{rp.text}</div>
                      </details>
                    );
                  }
                  if (typeof p.type === "string" && p.type.startsWith("tool-")) {
                    const tp = p as { type: string; state?: string; output?: unknown; input?: unknown };
                    const name = tp.type.replace(/^tool-/, "");
                    if (tp.state === "output-available") {
                      return (
                        <details key={i} className="text-xs border rounded px-2 py-1 bg-background">
                          <summary className="cursor-pointer flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-success" /> {name}</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-[10px] max-h-40 overflow-auto">{JSON.stringify(tp.output, null, 2)}</pre>
                        </details>
                      );
                    }
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed rounded px-2 py-1">
                        <Wrench className="h-3 w-3 animate-pulse" /> Executando <code>{name}</code>…
                      </div>
                    );
                  }
                  return null;
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
