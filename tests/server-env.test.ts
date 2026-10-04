import { describe, it, expect, vi } from "vitest";
import { serverEnvironment } from "../supabase/functions/_shared/server-env";
import { createRouter } from "../server/router";
import { createStaticHandler } from "../server/static";
import { privateAIHandler } from "../supabase/functions/_shared/private-ai-handler";
const values = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "public-test",
  SUPABASE_SERVICE_ROLE_KEY: "private-server-marker",
  ALLOWED_ORIGINS: "http://localhost:5173",
};
const env = (v: Record<string, string> = values) =>
  serverEnvironment({ get: (key) => v[key] });
const staticPage = () => new Response("app");
function request(path = "analyze-meal", extra: RequestInit = {}) {
  return new Request("http://localhost:8787/api/" + path, {
    method: "POST",
    ...extra,
  });
}
describe("backend local com .env", () => {
  it("reaproveita somente a conexão pública e não aceita service role com VITE_", () => {
    expect(env().get("SUPABASE_URL")).toBe(values.VITE_SUPABASE_URL);
    expect(env().get("SUPABASE_ANON_KEY")).toBe("public-test");
    expect(
      env({ VITE_SUPABASE_SERVICE_ROLE_KEY: "private-server-marker" }).get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ),
    ).toBeUndefined();
    expect(
      env({
        SUPABASE_SECRET_KEY: "new-private-marker",
        SUPABASE_SERVICE_ROLE_KEY: "old-private-marker",
      }).get("SUPABASE_SERVICE_ROLE_KEY"),
    ).toBe("new-private-marker");
  });
  it("sem credencial administrativa, não cria clientes nem expõe valores", async () => {
    const factory = vi.fn();
    const router = createRouter(
      env({ ...values, SUPABASE_SERVICE_ROLE_KEY: "" }),
      { "analyze-meal": factory },
      staticPage,
    );
    const response = await router(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("public-test");
    expect(factory).not.toHaveBeenCalled();
    expect(
      await (await router(new Request("http://localhost:8787/"))).text(),
    ).toBe("app");
  });
  it("continua validando JWT antes da ação", async () => {
    const action = vi.fn(async () => ({ ok: true }));
    const auth = vi.fn(async (token: string) =>
      token === "valid-session" ? "owner" : null,
    );
    const router = createRouter(
      env(),
      {
        coach: (e) =>
          privateAIHandler(
            { authenticate: auth, allowedOrigins: e.get("ALLOWED_ORIGINS") },
            action,
          ),
      },
      staticPage,
    );
    expect((await router(request("coach"))).status).toBe(401);
    expect(
      (
        await router(
          request("coach", {
            headers: { Authorization: "Bearer invalid" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(401);
    expect(action).not.toHaveBeenCalled();
    expect(
      (
        await router(
          request("coach", {
            headers: {
              Authorization: "Bearer valid-session",
              Origin: "http://localhost:5173",
            },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(200);
    expect(action.mock.calls[0][1]).toBe("owner");
  });
  it("nega origem externa e preflight diferente de POST antes do SDK", async () => {
    const factory = vi.fn(() => () => new Response("ok"));
    const router = createRouter(env(), { coach: factory }, staticPage);
    expect(
      (
        await router(
          request("coach", { headers: { Origin: "https://evil.example" } }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await router(
          request("coach", {
            method: "OPTIONS",
            headers: {
              Origin: "http://localhost:5173",
              "Access-Control-Request-Method": "DELETE",
            },
          }),
        )
      ).status,
    ).toBe(403);
    const allowed = await router(
      request("coach", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      }),
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(factory).not.toHaveBeenCalled();
  });
  it("não entrega index.html para API desconhecida ou método inválido", async () => {
    const router = createRouter(
      env(),
      { coach: () => () => new Response("ok") },
      staticPage,
    );
    expect((await router(request("toString"))).status).toBe(404);
    expect((await router(request("missing"))).status).toBe(404);
    expect((await router(request("coach", { method: "GET" }))).status).toBe(
      405,
    );
  });
  it("isola erros internos e mantém resposta sem cache", async () => {
    const router = createRouter(
      env(),
      {
        coach: () => () => {
          throw new Error("private-server-marker");
        },
      },
      staticPage,
    );
    const response = await router(request("coach"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("private-server-marker");
  });
});
describe("arquivos públicos", () => {
  const root = new URL("file:///vitra/dist/");
  it("serve o build, assets e SPA, com HEAD sem corpo", async () => {
    const read = vi.fn(async (url: URL) => {
      if (
        !["index.html", "assets/app.js"].some((p) => url.href === root.href + p)
      )
        throw new Error();
      return new TextEncoder().encode(url.pathname);
    });
    const handler = createStaticHandler(root, read);
    const asset = await handler(
      new Request("https://vitra.test/assets/app.js"),
    );
    expect(asset.headers.get("Content-Type")).toContain("javascript");
    expect(
      (await handler(new Request("https://vitra.test/evolucao"))).status,
    ).toBe(200);
    expect(
      await (
        await handler(new Request("https://vitra.test/", { method: "HEAD" }))
      ).text(),
    ).toBe("");
    expect(
      (await handler(new Request("https://vitra.test/assets/missing.js")))
        .status,
    ).toBe(404);
    expect(
      read.mock.calls.every(([url]) => url.href.startsWith(root.href)),
    ).toBe(true);
  });
  it.each([
    "/.env",
    "/.env.local.backup",
    "/%2eenv",
    "/%2e%2e%5c.env",
    "/%00",
    "/%zz",
    "/.git/config",
  ])("bloqueia arquivo privado/caminho inválido %s", async (path) => {
    const read = vi.fn(async () =>
      new TextEncoder().encode("private-server-marker"),
    );
    const response = await createStaticHandler(
      root,
      read,
    )(new Request("https://vitra.test" + path));
    expect([400, 404]).toContain(response.status);
    expect(read).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("private-server-marker");
  });
});
