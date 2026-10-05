// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVercelHandler, vercelEnvironment } from "../server/vercel";
import { createVitHandler } from "../supabase/functions/_shared/vit-handler";

const values = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "public-marker",
  SUPABASE_SECRET_KEY: "private-server-marker",
  GEMINI_API_KEY: "private-ai-marker",
  VERCEL: "1",
  VERCEL_URL: "vitra-preview.example",
  VERCEL_PROJECT_PRODUCTION_URL: "vitra.example",
};
const source = (extra: Record<string, string> = {}) => ({
  get: (key: string) =>
    ({ ...values, ...extra } as Record<string, string>)[key],
});
const request = (
  origin = "https://vitra.example",
  path = "vit",
  init: RequestInit = {},
) =>
  new Request(`https://vitra.example/api/${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{}",
    ...init,
  });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("API Vitra na Vercel", () => {
  it("as seis funções publicadas chegam aos handlers e recusam chamadas sem autenticação", async () => {
    for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Unexpected network call"),
    );
    const entries = await Promise.all([
      import("../api/vit"),
      import("../api/coach"),
      import("../api/analyze-meal"),
      import("../api/analyze-body-photos"),
      import("../api/health-steps"),
      import("../api/delete-account"),
    ]);
    const paths = [
      "vit",
      "coach",
      "analyze-meal",
      "analyze-body-photos",
      "health-steps",
      "delete-account",
    ];
    for (let i = 0; i < entries.length; i++) {
      expect(
        (await entries[i].default.fetch(
          request("https://vitra.example", paths[i]),
        )).status,
      ).toBe(401);
    }
    expect(network).not.toHaveBeenCalled();
  });
  it("preflight do domínio publicado é atendido sem iniciar IA e cabeçalhos não autorizados são negados", async () => {
    const factory = vi.fn(() => () => Response.json({ ok: true }));
    const handler = createVercelHandler(source(), "vit", { vit: factory });
    const options = (headers: string) =>
      new Request("https://vitra.example/api/vit", {
        method: "OPTIONS",
        headers: {
          Origin: "https://vitra.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": headers,
        },
      });
    expect((await handler(options("authorization,content-type"))).status).toBe(
      204,
    );
    expect((await handler(options("x-untrusted"))).status).toBe(403);
    expect(factory).not.toHaveBeenCalled();
  });
  it("a rota VIT real existe no Node, exige JWT e não chama rede/IA sem login", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Unexpected network call"),
    );
    const result = await createVercelHandler(source(), "vit")(request());
    expect(result.status).toBe(401);
    expect((await result.json()).error).toBe("Entre na sua conta.");
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://vitra.example",
    );
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(network).not.toHaveBeenCalled();
  });
  it("origens são exatas, vêm do ambiente confiável e não dos headers do visitante", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Unexpected network call"),
    );
    const handler = createVercelHandler(source(), "vit");
    expect((await handler(request("https://vitra-preview.example"))).status)
      .toBe(401);
    expect(
      (await handler(request("https://vitra.example.evil.example"))).status,
    ).toBe(403);
    expect((await handler(request("https://evil.example"))).status).toBe(403);
    expect(
      vercelEnvironment(
        source({ VERCEL: "0", ALLOWED_ORIGINS: "https://custom.example" }),
      ).get("ALLOWED_ORIGINS"),
    ).toBe("https://custom.example");
    expect(
      vercelEnvironment(
        source({
          VERCEL_URL: "evil.example/path",
          VERCEL_PROJECT_PRODUCTION_URL: "evil.example?query=1",
        }),
      ).get("ALLOWED_ORIGINS"),
    ).toBeUndefined();
    expect(network).not.toHaveBeenCalled();
  });
  it("cada função publica sua rota; um nome diferente ou desconhecido não é delegado", async () => {
    const factory = vi.fn(() => () => Response.json({ ok: true }));
    const handler = createVercelHandler(source(), "vit", { vit: factory });
    expect((await handler(request("https://vitra.example", "coach"))).status)
      .toBe(404);
    expect((await handler(request("https://vitra.example", "toString"))).status)
      .toBe(404);
    expect(factory).not.toHaveBeenCalled();
    expect((await handler(request())).status).toBe(200);
  });
  it("mantém consentimento/quota/provedor injetado e confirmação de persistência no VIT publicado", async () => {
    const generate = vi.fn(async () =>
      JSON.stringify({
        answer: "Podemos organizar uma refeição simples.",
        memorySuggestions: [],
      })
    );
    const save = vi.fn(async (
      _owner,
      _conversation,
      _id,
      _prompt,
      _photo,
      response,
    ) => response);
    const factory = (env: any) =>
      createVitHandler({
        allowedOrigins: env.get("ALLOWED_ORIGINS"),
        authenticate: async () => "owner",
        hasConsent: async () => true,
        allowRequest: async () => true,
        existing: async () => null,
        loadState: async () => ({
          context: {},
          budget: { target: 2000 },
          goal: {},
          wellbeingRisk: false,
          history: [],
          memories: [],
        }),
        analyzePhoto: async () => {
          throw new Error("No photo expected");
        },
        provider: { model: "mock", generateStructured: generate },
        save,
      });
    const body = JSON.stringify({
      conversationId: "00000000-0000-4000-8000-000000000001",
      requestId: "00000000-0000-4000-8000-000000000002",
      message: "Como organizar meu almoço?",
    });
    const handler = createVercelHandler(source(), "vit", { vit: factory });
    const result = await handler(
      request("https://vitra.example", "vit", {
        headers: {
          Origin: "https://vitra.example",
          Authorization: "Bearer mock-session",
          "Content-Type": "application/json",
        },
        body,
      }),
    );
    expect(result.status).toBe(200);
    expect((await result.json()).answer).toContain("refeição simples");
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.invocationCallOrder[0]).toBeGreaterThan(
      generate.mock.invocationCallOrder[0],
    );
  });
  it("o entrypoint /api/vit exporta fetch e preserva erros seguros de configuração", async () => {
    for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
    const entry = await import("../api/vit");
    expect(typeof entry.default.fetch).toBe("function");
    expect((await entry.default.fetch(request())).status).toBe(401);
    const missing = await createVercelHandler(
      source({ SUPABASE_SECRET_KEY: "" }),
      "vit",
    )(request());
    expect(missing.status).toBe(503);
    expect(await missing.text()).not.toContain("private-ai-marker");
  });
});
