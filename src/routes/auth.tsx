import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Conta criada. Você já está entrando…");
  }

  async function googleSignIn() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(String(res.error?.message ?? res.error));
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 font-display text-xl font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">N</span>
          Nexus CRM
        </div>
        <div className="space-y-5">
          <h1 className="text-4xl font-display font-semibold leading-tight">
            O CRM com um <span className="text-sidebar-primary">Copilot de IA</span> ao seu lado.
          </h1>
          <p className="text-sidebar-foreground/70 max-w-md">
            Centralize contatos, pipeline de vendas e histórico de interações. Pergunte qualquer coisa ao Copilot — ele responde com base nos seus dados reais.
          </p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80">
            <li className="flex gap-2"><Sparkles className="h-4 w-4 text-sidebar-primary" /> Kanban de vendas com previsão automática</li>
            <li className="flex gap-2"><Sparkles className="h-4 w-4 text-sidebar-primary" /> Copilot que resume, prioriza e cria tarefas</li>
            <li className="flex gap-2"><Sparkles className="h-4 w-4 text-sidebar-primary" /> Multi-empresa com isolamento total</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© Nexus CRM · Feito com Lovable</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-display">Entrar no Nexus</CardTitle>
            <CardDescription>Acesse sua conta ou crie uma nova em segundos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3 pt-4">
                  <div className="space-y-1"><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Senha</Label><Input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
                  <Button type="submit" disabled={loading} className="w-full">Entrar</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3 pt-4">
                  <div className="space-y-1"><Label>Nome</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" /></div>
                  <div className="space-y-1"><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Senha</Label><Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></div>
                  <Button type="submit" disabled={loading} className="w-full">Criar conta</Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="relative my-6"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div></div>
            <Button variant="outline" className="w-full" onClick={googleSignIn}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5.04c1.65 0 3.14.57 4.31 1.68l3.24-3.24C17.46 1.47 14.97.5 12 .5 7.36.5 3.37 3.13 1.42 6.97l3.76 2.92C6.14 6.98 8.86 5.04 12 5.04z"/><path fill="#4285F4" d="M23.5 12.26c0-.86-.08-1.68-.22-2.47H12v4.68h6.47c-.28 1.5-1.13 2.77-2.4 3.62l3.7 2.87c2.16-2 3.41-4.94 3.41-8.7z"/><path fill="#FBBC05" d="M5.18 14.11a7.2 7.2 0 0 1 0-4.62L1.42 6.57A11.98 11.98 0 0 0 .5 12c0 1.94.46 3.77 1.28 5.4l3.4-3.29z"/><path fill="#34A853" d="M12 23.5c3.24 0 5.96-1.07 7.94-2.91l-3.7-2.87c-1.03.7-2.35 1.11-4.24 1.11-3.14 0-5.86-1.94-6.82-4.85l-3.4 3.3C3.37 20.87 7.36 23.5 12 23.5z"/></svg>
              Continuar com Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
