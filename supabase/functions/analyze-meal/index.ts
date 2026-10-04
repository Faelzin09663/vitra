import { serverEnvironment } from "../_shared/server-env.ts";
import { createMealEndpoint } from "./runtime.ts";
Deno.serve(createMealEndpoint(serverEnvironment(Deno.env)));
