import { serverEnvironment } from "../_shared/server-env.ts";
import { createCoachEndpoint } from "./runtime.ts";
Deno.serve(createCoachEndpoint(serverEnvironment(Deno.env)));
