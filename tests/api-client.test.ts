import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { invokeAPI, apiURL } from "../src/lib/api";
const { getSession, fetchMock } = vi.hoisted(() => ({
  getSession: vi.fn(),
  fetchMock: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: { auth: { getSession } } }));
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  getSession.mockResolvedValue({
    data: { session: { access_token: "user-session-marker" } },
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("envia apenas sessão e corpo ao backend Vitra", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ analysis: {}, model: "mock" })),
  );
  const result = await invokeAPI("analyze-meal", {
    body: { description: "arroz" },
  });
  expect(result.error).toBeNull();
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(window.location.origin + "/api/analyze-meal");
  expect(options.headers).toEqual({
    Authorization: "Bearer user-session-marker",
    "Content-Type": "application/json",
  });
  expect(options.credentials).toBe("omit");
  expect(options.redirect).toBe("error");
  expect(options.body).toBe(JSON.stringify({ description: "arroz" }));
});
it("sessão ausente ou rejeitada não chama o backend", async () => {
  for (const session of [
    { data: { session: null }, error: null },
    { data: { session: { access_token: "token" } }, error: new Error() },
  ]) {
    getSession.mockResolvedValue(session);
    expect(
      (await invokeAPI("coach", { body: { action: "week" } })).error?.message,
    ).toContain("conta");
  }
  expect(fetchMock).not.toHaveBeenCalled();
});
it("preserva erro público HTTP sem perder Response para a tela de refeições", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ error: "Preencha o .env do backend." }), {
      status: 503,
    }),
  );
  const result = await invokeAPI("coach", { body: { action: "week" } });
  expect(result.data).toBeNull();
  expect(result.error?.message).toContain(".env");
  expect(await result.error?.context?.json()).toEqual({
    error: "Preencha o .env do backend.",
  });
});
it("timeout/erro de rede não expõe detalhes do erro", async () => {
  fetchMock.mockRejectedValue(new Error("private-server-marker"));
  const result = await invokeAPI("coach", { body: { action: "week" } });
  expect(result.error?.message).not.toContain("private-server-marker");
  expect(result.data).toBeNull();
});
it("URL pública suporta backend separado sem query nem credenciais", () => {
  vi.stubEnv("VITE_API_URL", "https://api.vitra.test/api");
  expect(apiURL("health-steps")).toBe(
    "https://api.vitra.test/api/health-steps",
  );
  vi.stubEnv("VITE_API_URL", "https://user:password@api.vitra.test/api");
  expect(() => apiURL("coach")).toThrow("inválida");
});
