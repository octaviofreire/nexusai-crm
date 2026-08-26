# Redesign visual — Nexus CRM "Deep Slate Luxe"

Tema escuro completo, denso e premium, baseado no protótipo aprovado. Paleta travada: Ardósia & Violeta. Fontes: Space Grotesk (títulos) + DM Sans (texto) + JetBrains Mono (números/KPIs). Nenhuma funcionalidade muda — apenas apresentação.

## 1. Sistema de design (src/styles.css + fontes)
- Novos tokens semânticos em `:root` (tema escuro vira o padrão do app):
  - `--background` ardósia profunda (#0a0c10), `--card`/#0d1117, bordas hairline `white/5`, acento violeta #8B5CF6 (com variantes glow/soft).
  - Tokens novos: `--font-display` (Space Grotesk), `--font-sans` (DM Sans), `--font-mono` (JetBrains Mono para valores numéricos).
  - Sombras suaves e utilitário de "glow" violeta para botões primários/ativo.
- Carregar as 3 fontes via `<link>` no head de `src/routes/__root.tsx` (nunca @import de URL).
- Mapear tokens no `@theme inline` para utilitários Tailwind (`bg-card`, `text-accent`, `border-border` etc. continuam funcionando).

## 2. Shell (src/components/app-shell.tsx)
- Sidebar escura slim: logo com tile violeta + brilho, item ativo com fundo violeta/10 + borda violeta/20, hover sutil nos demais, rodapé com "Sair".
- Topbar integrada ao tema escuro; botão Copilot com destaque violeta.
- Conteúdo principal sobre fundo `--background` escuro.

## 3. Dashboard (src/routes/_authenticated/dashboard.tsx)
- Faixa de 4 KPIs compactos: micro-label uppercase (Space Grotesk), valor em JetBrains Mono, indicador de delta com seta, blob de brilho violeta no canto do card.
- Gráficos Recharts em escala violeta, gridlines finas, tooltips escuros; layout denso lado a lado (Pipeline por estágio + Distribuição de valor) ocupando a largura toda.
- Lista "Minhas tarefas pendentes" no estilo do protótipo (dot colorido + título + prazo).

## 4. Demais telas autenticadas (Vendas/Kanban, Contatos, Contas, Tarefas, Relatórios, Configurações)
- Adaptar cards, tabelas, badges, diálogos e inputs ao tema escuro usando os tokens novos (sem hardcode de cor).
- Kanban: colunas com fundo sutil, headers slim com totais, cards escuros com borda hairline.
- Relatórios: mesma linguagem de gráficos violeta do dashboard.
- Painel do Copilot (sheet) também no tema escuro.

## 5. Páginas públicas (index, auth)
- Ajustar para o tema escuro consistente (hero e tela de login com o novo visual).
- Corrigir o erro de hydration mismatch em /auth (branch server/client divergente — isolar com ClientOnly ou remover a divergência).

## 6. Validação
- Build + verificação visual via Playwright nas telas principais (dashboard, vendas, contatos) autenticado.
- Atualizar memória do projeto com a nova identidade visual.

## Fora de escopo
- Nenhuma mudança de funcionalidade, dados, RLS ou rotas de API.
