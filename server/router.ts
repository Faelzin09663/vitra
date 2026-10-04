import {
  corsHeaders,
  parseAllowedOrigins,
  validPreflight,
} from "../supabase/functions/_shared/cors.ts";
import {
  missingServerSettings,
  type EnvReader,
} from "../supabase/functions/_shared/server-env.ts";
export type Handler = (request: Request) => Response | Promise<Response>;
export type EndpointFactory = (env: EnvReader) => Handler;

export function createRouter(
  env: EnvReader,
  factories: Record<string, EndpointFactory>,
  serveStatic: Handler,
): Handler {
  const handlers = new Map<string, Handler>();
  const origins = parseAllowedOrigins(env.get("ALLOWED_ORIGINS"));
  return async (request) => {
    const path = new URL(request.url).pathname;
    if (path !== "/api" && !path.startsWith("/api/"))
      return serveStatic(request);
    const headers = corsHeaders(request.headers.get("Origin"), origins);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    const reply = (status: number, error: string) =>
      new Response(JSON.stringify({ error }), { status, headers });
    const name = path.slice(5);
    if (!Object.hasOwn(factories, name))
      return reply(404, "Rota indisponível.");
    const origin = request.headers.get("Origin");
    if (origin && !origins.includes(origin))
      return reply(403, "Origem não permitida.");
    if (request.method === "OPTIONS")
      return origin && validPreflight(request)
        ? new Response(null, { status: 204, headers })
        : reply(403, "Preflight não permitido.");
    if (request.method !== "POST") return reply(405, "Método não permitido.");
    if (missingServerSettings(env).length)
      return reply(
        503,
        "Configure as credenciais do backend no .env e reinicie o servidor Vitra.",
      );
    try {
      let handler = handlers.get(name);
      if (!handler) {
        handler = factories[name](env);
        handlers.set(name, handler);
      }
      const response = await handler(request);
      const combined = new Headers(response.headers);
      headers.forEach((value, key) => combined.set(key, value));
      return new Response(response.body, {
        status: response.status,
        headers: combined,
      });
    } catch {
      // Never forward/log SDK errors, environment values, tokens or request bodies.
      return reply(
        503,
        "Serviço indisponível. Confira a configuração do servidor Vitra.",
      );
    }
  };
}
