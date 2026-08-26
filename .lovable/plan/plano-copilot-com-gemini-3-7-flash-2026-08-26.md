# Plano: Copilot com Gemini 3.7 Flash

## Objetivo
Trocar o modelo do assistente Copilot de `google/gemini-3-flash-preview` (geração antiga) para `google/gemini-3.7-flash`, o Gemini Flash mais recente — mais rápido e eficiente para chat com ferramentas.

## Mudanças

1. **`src/routes/api/copilot.ts`**
   - Alterar `gateway("google/gemini-3-flash-preview")` para `gateway("google/gemini-3.7-flash")`.
   - Habilitar o raciocínio do modelo via `providerOptions: { lovable: { reasoning: { effort: "low" } } }` no `streamText` e `sendReasoning: true` no `toUIMessageStreamResponse`, para o painel poder exibir o "pensando" do Gemini.
   - Nenhuma outra mudança: tools, system prompt e autenticação continuam iguais.

2. **`src/components/copilot-panel.tsx`**
   - Renderizar partes de raciocínio (`reasoning`) no histórico do chat, com um bloco recolhível "Raciocínio".

3. **Memória do projeto**
   - Atualizar a regra do modelo default do Copilot para `google/gemini-3.7-flash`.

## Validação
- Enviar uma mensagem real pelo painel do Copilot no preview e confirmar resposta + execução de tool (ex.: "Liste os negócios abertos").
- Confirmar ausência de erros 400 da AI Gateway nos logs de rede.

## Detalhes técnicos
- O caminho de chat permanece no `@ai-sdk/openai-compatible` (correto para modelos `google/*`; a Responses API é só para `openai/*`).
- `gemini-3.7-flash` não suporta fast mode (`service_tier: priority`), então nada disso será adicionado.
