import {
  serverEnvironment,
  missingServerSettings,
} from "../supabase/functions/_shared/server-env.ts";
import { createMealEndpoint } from "../supabase/functions/analyze-meal/runtime.ts";
import { createBodyEndpoint } from "../supabase/functions/analyze-body-photos/runtime.ts";
import { createCoachEndpoint } from "../supabase/functions/coach/runtime.ts";
import { createHealthEndpoint } from "../supabase/functions/health-steps/runtime.ts";
import { createDeleteEndpoint } from "../supabase/functions/delete-account/runtime.ts";
import { createVitEndpoint } from "../supabase/functions/vit/runtime.ts";
import { createRouter } from "./router.ts";
import { createStaticHandler } from "./static.ts";

const env = serverEnvironment(Deno.env);
const port = Number(env.get("API_PORT") || "8787");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("API_PORT inválida.");
const missing = missingServerSettings(env);
if (missing.length)
  console.warn(
    "Backend pendente: preencha " +
      missing.join(", ") +
      " no .env. O app e o banco continuam disponíveis.",
  );
const router = createRouter(
  env,
  {
    "analyze-meal": createMealEndpoint,
    "analyze-body-photos": createBodyEndpoint,
    coach: createCoachEndpoint,
    vit: createVitEndpoint,
    "health-steps": createHealthEndpoint,
    "delete-account": createDeleteEndpoint,
  },
  createStaticHandler(new URL("../dist/", import.meta.url), (url) =>
    Deno.readFile(url),
  ),
);

Deno.serve(
  {
    port,
    hostname: "0.0.0.0",
    onListen: () => console.log(`Servidor Vitra ativo na porta ${port}.`),
  },
  router,
);
