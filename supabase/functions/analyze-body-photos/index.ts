import { serverEnvironment } from "../_shared/server-env.ts";
import { createBodyEndpoint } from "./runtime.ts";
Deno.serve(createBodyEndpoint(serverEnvironment(Deno.env)));
