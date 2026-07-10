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
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="p-5 flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">N</span>
          Nexus
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center justify-end px-4 gap-2">
          <Button onClick={() => setCopilotOpen(true)} variant="default" size="sm">
            <Sparkles className="h-4 w-4 mr-2" /> Copilot
          </Button>
        </header>
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>

      <CopilotPanel open={copilotOpen} onOpenChange={setCopilotOpen} />
    </div>
  );
}
