import { serverEnvironment } from "../_shared/server-env.ts";
import { createDeleteEndpoint } from "./runtime.ts";
Deno.serve(createDeleteEndpoint(serverEnvironment(Deno.env)));
