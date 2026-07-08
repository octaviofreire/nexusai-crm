import { describe, it, expect } from "vitest";
import { forecast, leadScore } from "./business";

describe("forecast", () => {
  it("soma ponderada de deals abertos e ganhos", () => {
    const r = forecast([
      { amount: 1000, probability: 50, expected_close_date: null, status: "open" },
      { amount: 2000, probability: 25, expected_close_date: null, status: "open" },
      { amount: 500,  probability: 100, expected_close_date: null, status: "won" },
      { amount: 999,  probability: 90, expected_close_date: null, status: "lost" },
    ]);
    expect(r.pipeline).toBe(3000);
    expect(r.committed).toBe(500);
    expect(r.weighted).toBe(1000); // 1000*0.5 + 2000*0.25
  });

  it("respeita janela de datas", () => {
    const r = forecast(
      [
        { amount: 100, probability: 100, expected_close_date: "2026-01-15", status: "open" },
        { amount: 200, probability: 100, expected_close_date: "2026-03-01", status: "open" },
      ],
      new Date("2026-02-01"),
      new Date("2026-03-31"),
    );
    expect(r.weighted).toBe(200);
  });
});

describe("leadScore", () => {
  it("prioriza C-level engajado com deal aberto", () => {
    const s = leadScore({
      title: "CEO", status: "qualified",
      interactions_last_30d: 4, deals_open: 1,
      has_email: true, has_phone: true,
    });
    expect(s).toBeGreaterThanOrEqual(70);
  });
  it("baixa pontuação para contato frio sem dados", () => {
    expect(leadScore({})).toBeLessThan(20);
  });
  it("clampa entre 0 e 100", () => {
    const s = leadScore({ title: "CEO", status: "customer", interactions_last_30d: 99, deals_open: 99, has_email: true, has_phone: true });
    expect(s).toBeLessThanOrEqual(100);
  });
});
