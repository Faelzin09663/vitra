import { serverEnvironment } from "../_shared/server-env.ts";
import { createHealthEndpoint } from "./runtime.ts";
Deno.serve(createHealthEndpoint(serverEnvironment(Deno.env)));
