import { endpointFactories } from "./endpoints.ts";
import { createRouter, type EndpointFactory } from "./router.ts";
import {
  type EnvReader,
  serverEnvironment,
} from "../supabase/functions/_shared/server-env.ts";
import { parseAllowedOrigins } from "../supabase/functions/_shared/cors.ts";

/** Only explicit settings and trusted deployment metadata can authorize an origin. */
export function vercelEnvironment(source: EnvReader): EnvReader {
  const origins = parseAllowedOrigins(source.get("ALLOWED_ORIGINS"));
  if (source.get("VERCEL") === "1") {
    for (
      const name of [
        "VERCEL_URL",
        "VERCEL_PROJECT_PRODUCTION_URL",
        "VERCEL_BRANCH_URL",
      ]
    ) {
      const hostname = source.get(name)?.trim();
      if (hostname && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(hostname)) {
        origins.push(`https://${hostname}`);
      }
    }
  }
  return serverEnvironment({
    get: (name) =>
      name === "ALLOWED_ORIGINS"
        ? [...new Set(origins)].join(",")
        : source.get(name),
  });
}

export function createVercelHandler(
  source: EnvReader,
  name: keyof typeof endpointFactories,
  factories: Record<string, EndpointFactory> = endpointFactories,
) {
  return createRouter(
    vercelEnvironment(source),
    { [name]: factories[name] },
    () =>
      Response.json({ error: "Rota indisponível." }, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      }),
  );
}

// Access happens only in server entrypoints; no private values are embedded at build time.
export const processEnvironment: EnvReader = {
  get: (name) =>
    (globalThis as unknown as {
      process: { env: Record<string, string | undefined> };
    }).process.env[name],
};
