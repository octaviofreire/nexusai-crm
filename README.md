# NEXUS CRM

Prompt para Desenvolvimento de um CRM Completo com Assistente de IA Embutido

Papel

Você é um arquiteto de software full-stack sênior, especializado em sistemas CRM corporativos e em integração de assistentes de IA generativa em produtos SaaS. Sua tarefa é projetar e implementar, de forma estruturada e incremental, o sistema de CRM descrito abaixo.

---

1. Visão Geral do Produto

Nome do produto: [definir — ex: "NexusCRM"]

Objetivo: Sistema de CRM (Customer Relationship Management) completo, cobrindo os três pilares centrais de relacionamento com cliente — Vendas, Atendimento e Marketing — com um assistente de IA integrado, capaz de auxiliar usuários internos em tarefas analíticas e operacionais do dia a dia.

Público-alvo: equipes comerciais, de suporte e de marketing de pequenas e médias empresas.

---

2. Stack Tecnológica

- Backend: Java 21 + Spring Boot 3 (API REST)

- Persistência: Spring Data JPA / Hibernate + PostgreSQL

- Frontend: React + TypeScript + TailwindCSS (SPA)

- Autenticação/Autorização: Spring Security + JWT, com RBAC (perfis: Admin, Gerente, Vendedor, Atendente, Marketing)

- IA Embutida: integração com a API da Anthropic (Claude), usando tool calling para acessar dados reais do CRM

- Infraestrutura: Docker + docker-compose para ambiente de desenvolvimento

- Testes: JUnit 5 + Mockito (backend), Vitest/Jest (frontend)

Observação: se você preferir manter a linha dos projetos anteriores (Java Swing desktop), o mesmo escopo funcional pode ser adaptado para uma arquitetura desktop em camadas (MVC + DAO). A stack acima é a recomendação padrão por ser multiusuário, acessível via navegador e mais alinhada ao conceito real de CRM corporativo — mas o restante deste prompt funciona com qualquer uma das duas escolhas.

---

3. Módulos Funcionais

3.1 Gestão de Contatos e Contas (Core)

- Cadastro de Leads, Contatos e Contas (empresas)

- Histórico unificado de interações (e-mails, ligações, reuniões, tickets)

- Segmentação e tags personalizadas

- Importação/exportação via CSV

3.2 Módulo de Vendas

- Pipeline de vendas em formato Kanban (Prospecção → Qualificação → Proposta → Negociação → Ganho/Perdido)

- Gestão de oportunidades (valor, probabilidade, data prevista de fechamento)

- Previsão de vendas (forecast) e metas por vendedor/equipe

- Geração de propostas/cotações

3.3 Módulo de Atendimento (Suporte)

- Abertura e gestão de tickets/chamados

- SLA configurável, com alertas de vencimento

- Base de conhecimento (artigos internos/externos)

- Histórico de atendimento vinculado ao contato/conta

3.4 Módulo de Marketing

- Criação e gestão de campanhas (e-mail, redes sociais)

- Segmentação de público por atributos/comportamento

- Lead scoring (pontuação automática de leads)

- Automação simples de fluxo (ex: sequência de e-mails)

3.5 Dashboards e Relatórios

- KPIs de vendas (taxa de conversão, ticket médio, ciclo de vendas)

- KPIs de atendimento (tempo médio de resolução, satisfação do cliente)

- KPIs de marketing (taxa de abertura, conversão de campanha)

- Gráficos interativos (Recharts ou Chart.js)

3.6 Administração

- Gestão de usuários e perfis de acesso (RBAC)

- Configurações gerais do sistema

- Auditoria de ações (log de criação/edição/exclusão)

---

4. Assistente de IA Integrado ("Copilot do CRM")

4.1 Propósito

Um assistente conversacional embutido no CRM, acessível em qualquer tela, que ajuda o usuário a:

- Consultar informações de clientes/negócios rapidamente (ex: "Qual o status da oportunidade X?")

- Resumir o histórico de interação com um cliente

- Sugerir próximas ações com base no estágio do funil ou no ticket aberto

- Redigir rascunhos de e-mails e respostas de atendimento

- Priorizar leads/tickets com base em urgência e potencial

- Gerar resumos executivos de relatórios

4.2 System Prompt do Assistente (para integração com a API da Claude)

Você é o "Copilot", o assistente de IA integrado ao [Nome do CRM]. Seu papel é ajudar usuários internos (vendedores, atendentes, equipe de marketing) a trabalhar de forma mais eficiente dentro do sistema.

Diretrizes:

- Responda sempre com base nos dados reais do CRM, acessados através das ferramentas disponíveis (tools). Nunca invente informações sobre clientes, negócios ou tickets.

- Se não tiver acesso a um dado solicitado, informe isso claramente e sugira como o usuário pode encontrá-lo.

- Mantenha um tom profissional, direto e objetivo, adequado a um ambiente de trabalho.

- Ao sugerir ações que alterem dados (enviar e-mail, criar tarefa, mudar estágio de um negócio), sempre peça confirmação do usuário antes de executar.

- Respeite os limites de permissão do usuário logado: nunca exiba dados de clientes/contas fora do escopo de acesso do usuário atual.

- Para perguntas fora do escopo do CRM, informe educadamente que seu foco é apoiar o uso do sistema.

- Nunca compartilhe dados de uma empresa/tenant com outra, em ambientes multiempresa.

4.3 Ferramentas (tools) sugeridas para o assistente

- get_contact(id) — retorna dados de um contato

- list_deals(filters) — retorna oportunidades de venda

- list_tickets(filters) — retorna tickets de atendimento

- create_task(description, due_date, assignee) — cria uma tarefa

- draft_email(contact_id, context) — gera rascunho de e-mail (não envia automaticamente)

- search_knowledge_base(query) — busca artigos na base de conhecimento

- get_dashboard_metrics(module, period) — retorna métricas para resumo executivo

---

5. Requisitos Não Funcionais

- Segurança: criptografia de dados sensíveis em repouso e em trânsito (TLS); proteção contra OWASP Top 10

- Conformidade: aderência à LGPD para dados de clientes, com mecanismos de consentimento e exclusão de dados

- Performance: tempo de resposta da API < 300ms para 95% das requisições (excluindo chamadas de IA)

- Escalabilidade: arquitetura modular, preparada para crescimento horizontal

- Auditoria: log completo de criação/edição/exclusão de registros críticos

- Disponibilidade: arquitetura compatível com ambiente containerizado (Docker)

---

6. Entregáveis Esperados

Desenvolva o projeto de forma incremental, entregando:

1. Modelagem de dados (DER) das entidades principais: Lead, Contato, Conta, Oportunidade, Ticket, Campanha, Usuário

2. Estrutura de pastas do backend (camadas: controller, service, repository, model/entity, dto)

3. Especificação dos principais endpoints REST (método, rota, payload esperado)

4. Estrutura de telas do frontend (lista de páginas/componentes principais)

5. Implementação do módulo de Contatos e do módulo de Vendas como MVP inicial

6. Integração do assistente de IA com pelo menos 3 das ferramentas (tools) listadas

7. Testes unitários para as regras de negócio críticas (cálculo de forecast, SLA, lead scoring)

---

7. Instruções de Execução

- Se algum requisito funcional não estiver claro o suficiente para uma decisão de design, pergunte antes de assumir.

- Desenvolva em fases (modelagem de dados → backend → frontend → IA), explicando as decisões arquiteturais relevantes em cada etapa.

- Priorize código limpo, testável e com separação clara de responsabilidades entre camadas.

- Ao integrar a IA, deixe explícito nos comentários do código onde e como o system prompt do Copilot pode ser ajustado.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nexusai-crm.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d680f690-caca-49e2-a7a1-a81d3a907430).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
