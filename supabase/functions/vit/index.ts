import { createVitEndpoint } from "./runtime.ts";
import { serverEnvironment } from "../_shared/server-env.ts";
Deno.serve(createVitEndpoint(serverEnvironment(Deno.env)));
