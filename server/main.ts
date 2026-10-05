import {
  missingServerSettings,
  serverEnvironment,
} from "../supabase/functions/_shared/server-env.ts";
import { endpointFactories } from "./endpoints.ts";
import { createRouter } from "./router.ts";
import { createStaticHandler } from "./static.ts";

const env = serverEnvironment(Deno.env);
const port = Number(env.get("API_PORT") || "8787");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("API_PORT inválida.");
}
const missing = missingServerSettings(env);
if (missing.length) {
  console.warn(
    "Backend pendente: preencha " +
      missing.join(", ") +
      " no .env. O app e o banco continuam disponíveis.",
  );
}
const router = createRouter(
  env,
  endpointFactories,
  createStaticHandler(
    new URL("../dist/", import.meta.url),
    (url) => Deno.readFile(url),
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
