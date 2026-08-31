import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Building2, KanbanSquare, CheckSquare, Settings, LogOut, Sparkles, BarChart3 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CopilotPanel } from "@/components/copilot-panel";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/deals", label: "Vendas", icon: KanbanSquare },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/contacts", label: "Contatos", icon: Users },
  { to: "/accounts", label: "Contas", icon: Building2 },
  { to: "/tasks", label: "Tarefas", icon: CheckSquare },
  { to: "/settings", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [copilotOpen, setCopilotOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="p-6 flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-display font-bold glow-primary">
            N
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">Nexus</span>
        </div>
        <nav className="flex-1 px-4 space-y-1 mt-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border border-primary/20"
                    : "border border-transparent hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-sidebar-accent-foreground" : "group-hover:text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-sidebar-border flex items-center justify-end px-6 gap-2">
          <Button onClick={() => setCopilotOpen(true)} variant="default" size="sm" className="glow-primary">
            <Sparkles className="h-4 w-4 mr-2" /> Copilot
          </Button>
        </header>
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>

      <CopilotPanel open={copilotOpen} onOpenChange={setCopilotOpen} />
    </div>
  );
}
