import { describe, expect, it, vi } from "vitest";
import {
  createVitHandler,
  type VitDeps,
} from "../supabase/functions/_shared/vit-handler";
import { parseVitResponse } from "../supabase/functions/_shared/vit-schema";
import { AIProviderError } from "../supabase/functions/_shared/ai-provider";
import {
  adultConsent,
  hasVitConsent,
} from "../supabase/functions/_shared/ai-consent";
import { vitDayContext } from "../supabase/functions/_shared/vit-context";
import { createInitialStore } from "../src/lib/store";
const conversation = "00000000-0000-4000-8000-000000000001",
  requestId = "00000000-0000-4000-8000-000000000002",
  photo = "00000000-0000-4000-8000-000000000003";
const body = {
  conversationId: conversation,
  requestId,
  message: "O que posso comer hoje?",
};
const response = {
  answer:
    "Uma opção é arroz, feijão e legumes. Revise porções com base na sua meta.",
  memorySuggestions: ["Prefiro refeições simples."],
};
function fixture(patch: Partial<VitDeps> = {}) {
  const save = vi.fn(async (_u, _c, _r, _m, _p, response) => response),
    generate = vi.fn(async () => JSON.stringify(response));
  const deps: VitDeps = {
    authenticate: async () => "owner",
    provider: { model: "mock-vit", generateStructured: generate },
    hasConsent: async () => true,
    allowRequest: async () => true,
    existing: async () => null,
    loadState: async () => ({
      context: { workouts: 2 },
      budget: { target: 2000 },
      goal: { objective: "deficit" },
      wellbeingRisk: false,
      history: [{ role: "user", content: "Meu email a@example.com" }],
      memories: ["Prefiro refeições simples."],
    }),
    analyzePhoto: async () => ({
      status: "analyzed",
      reason: "Foto adequada.",
      quality: {
        lighting: "Clara",
        distance: "Adequada",
        framing: "Adequado",
        pose: "Frontal",
        clothing: "Vestido",
      },
      changes: [],
      suggestions: ["Repita as condições."],
      limitations: "Não é avaliação clínica.",
    }),
    save,
    ...patch,
  };
  const handler = createVitHandler(deps),
    post = (data: unknown = body, auth = true) =>
      handler(
        new Request("https://vitra.test/api/vit", {
          method: "POST",
          headers: auth ? { Authorization: "Bearer session" } : {},
          body: JSON.stringify(data),
        }),
      );
  return { post, save, generate, deps };
}
describe("VIT: identidade, consentimento, memória e persistência", () => {
  it("orçamento não atribui refeição de ontem ao dia atual e evita orientar déficit abaixo da faixa de referência", () => {
    const store = createInitialStore(new Date(2026, 9, 3));
    store.meals = [{
      name: "Ontem",
      calories: 700,
      protein: 10,
      carbs: 20,
      fat: 10,
    }];
    expect(vitDayContext(store, "2026-10-04").budget.consumed).toBe(0);
    expect(vitDayContext(store, "2026-10-03").budget.consumed).toBe(700);
    store.profile = {
      ...store.profile,
      age: 30,
      heightCm: 175,
      sex: "male",
      calorieObjective: "deficit",
    };
    store.weights = [{ date: "03/10/2026", value: 50 }];
    expect(vitDayContext(store, "2026-10-04").requiresSupport).toBe(true);
    store.profile.calorieObjective = "maintenance";
    expect(vitDayContext(store, "2026-10-04").requiresSupport).toBe(false);
  });
  it("valida JWT, payload fechado, idade/consentimento e quota", async () => {
    const f = fixture();
    expect((await f.post(body, false)).status).toBe(401);
    expect((await f.post({ ...body, userId: "other" })).status).toBe(400);
    expect((await fixture({ hasConsent: async () => false }).post()).status)
      .toBe(403);
    expect((await fixture({ allowRequest: async () => false }).post()).status)
      .toBe(429);
    expect(f.generate).not.toHaveBeenCalled();
  });
  it("usa somente memória/contexto carregados pelo servidor e salva a resposta antes de confirmar", async () => {
    const f = fixture();
    const r = await f.post();
    expect(r.status).toBe(200);
    const payload = f.generate.mock.calls[0][0];
    expect(payload.parts[0].text).toContain("Prefiro refeições simples.");
    expect(payload.parts[0].text).not.toContain("a@example.com");
    expect(payload.parts[0].text).toContain("2000");
    expect(f.save).toHaveBeenCalledWith(
      "owner",
      conversation,
      requestId,
      body.message,
      null,
      expect.objectContaining({ model: "mock-vit" }),
    );
    expect(f.save.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.generate.mock.invocationCallOrder[0],
    );
  });
  it("não retorna sucesso quando a persistência falha; erros internos ficam privados", async () => {
    const f = fixture({
      save: async () => {
        throw new Error("private-server-marker");
      },
    });
    const r = await f.post();
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private-server-marker");
  });
  it("repetição idempotente não chama IA/quota; requestId não serve para outra mensagem", async () => {
    const allow = vi.fn(async () => true),
      f = fixture({
        allowRequest: allow,
        existing: async () => ({
          prompt: body.message,
          photoId: null,
          response: { ...response, model: "mock-vit" },
        }),
      });
    expect((await f.post()).status).toBe(200);
    expect(f.generate).not.toHaveBeenCalled();
    expect(allow).not.toHaveBeenCalled();
    expect((await f.post({ ...body, message: "Mensagem diferente" })).status)
      .toBe(409);
  });
  it("foto passa pelo pipeline restrito; URLs fornecidas pelo cliente são recusadas", async () => {
    const analyze = vi.fn(fixture().deps.analyzePhoto),
      f = fixture({ analyzePhoto: analyze });
    expect((await f.post({ ...body, photoId: photo })).status).toBe(200);
    expect(analyze).toHaveBeenCalledWith("owner", photo, "session");
    expect(f.generate.mock.calls[0][0].parts).toHaveLength(1);
    expect(
      (await f.post({ ...body, photoId: "https://evil.example/photo.jpg" }))
        .status,
    ).toBe(400);
  });
  it("foto sem consentimento ou titular não chega ao assistente", async () => {
    const f = fixture({
      analyzePhoto: async () => {
        throw new AIProviderError("blocked");
      },
    });
    expect((await f.post({ ...body, photoId: photo })).status).toBe(422);
    expect(f.generate).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });
  it("sinais de sofrimento impedem sugestões de déficit e não são guardados como memória", async () => {
    const base = fixture().deps.loadState,
      f = fixture({
        loadState: async (...args) => ({
          ...await base(...args),
          wellbeingRisk: true,
        }),
      });
    const r = await f.post();
    expect(r.status).toBe(200);
    expect(f.generate).not.toHaveBeenCalled();
    expect((await r.json()).memorySuggestions).toEqual([]);
  });
  it("consentimento VIT é independente do termo antigo e exige idade adulta salva", () => {
    const consent = { version: 1, grantedAt: "2026-10-04T12:00:00Z" };
    expect(hasVitConsent(consent)).toBe(true);
    expect(
      adultConsent({
        profile: { age: 30 },
        preferences: { vit_consent: consent },
      }, "vit_consent"),
    ).toBe(true);
    expect(
      adultConsent({
        profile: { age: 17 },
        preferences: { vit_consent: consent },
      }, "vit_consent"),
    ).toBe(false);
    expect(
      adultConsent({
        profile: { age: 30 },
        preferences: { ai_consent: { ...consent, version: 2 } },
      }, "vit_consent"),
    ).toBe(false);
  });
  it("schema limita a resposta e memórias propostas", () => {
    expect(() => parseVitResponse(JSON.stringify({ ...response, extra: "no" })))
      .toThrow();
    expect(() =>
      parseVitResponse(
        JSON.stringify({ ...response, memorySuggestions: Array(4).fill("x") }),
      )
    ).toThrow();
    expect(() =>
      parseVitResponse(
        JSON.stringify({ ...response, answer: "Sua gordura corporal é 20%" }),
      )
    ).toThrow();
  });
  it("recusa resposta e análise que excedam o limite de persistência antes de salvar", async () => {
    const base = fixture().deps.analyzePhoto,
      f = fixture({
        analyzePhoto: async (...args) => ({
          ...await base(...args),
          limitations: "x".repeat(15000),
        }),
      });
    expect((await f.post({ ...body, photoId: photo })).status).toBe(502);
    expect(f.save).not.toHaveBeenCalled();
  });
});
