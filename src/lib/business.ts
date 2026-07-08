/**
 * Regras de negócio pura (sem I/O) — servem tanto ao frontend quanto ao Copilot
 * e são cobertas por testes unitários em business.test.ts.
 */

export type ForecastDeal = {
  amount: number;
  probability: number; // 0..100
  expected_close_date: string | null;
  status: "open" | "won" | "lost";
};

export type ForecastResult = {
  weighted: number;   // Σ amount × probability/100 (só open)
  committed: number;  // Σ amount de deals ganhos no período
  pipeline: number;   // Σ amount de deals open
};

/**
 * Forecast simples: soma ponderada por probabilidade de negócios em aberto,
 * dentro (opcionalmente) de uma janela de fechamento previsto.
 */
export function forecast(deals: ForecastDeal[], from?: Date, to?: Date): ForecastResult {
  let weighted = 0, committed = 0, pipeline = 0;
  for (const d of deals) {
    const close = d.expected_close_date ? new Date(d.expected_close_date) : null;
    if (from && close && close < from) continue;
    if (to && close && close > to) continue;
    if (d.status === "won") committed += Number(d.amount) || 0;
    if (d.status === "open") {
      const amt = Number(d.amount) || 0;
      pipeline += amt;
      weighted += (amt * Math.max(0, Math.min(100, d.probability))) / 100;
    }
  }
  return {
    weighted: round2(weighted),
    committed: round2(committed),
    pipeline: round2(pipeline),
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

export type ScoringContact = {
  title?: string | null;
  status?: "lead" | "qualified" | "customer" | "archived" | null;
  interactions_last_30d?: number;
  deals_open?: number;
  has_email?: boolean;
  has_phone?: boolean;
};

/**
 * Lead scoring heurístico (0–100). Combina qualidade de dados,
 * cargo, engajamento recente e presença de negócios em aberto.
 */
export function leadScore(c: ScoringContact): number {
  let s = 0;
  if (c.has_email) s += 10;
  if (c.has_phone) s += 5;

  const title = (c.title ?? "").toLowerCase();
  if (/(ceo|founder|owner|presidente|diretor|director|cto|cfo|coo|vp)/.test(title)) s += 25;
  else if (/(gerente|manager|head|lead|coordenador)/.test(title)) s += 15;
  else if (title.length > 0) s += 5;

  if (c.status === "qualified") s += 15;
  if (c.status === "customer") s += 25;

  const inter = c.interactions_last_30d ?? 0;
  s += Math.min(20, inter * 4);

  s += Math.min(15, (c.deals_open ?? 0) * 5);

  return Math.max(0, Math.min(100, Math.round(s)));
}
