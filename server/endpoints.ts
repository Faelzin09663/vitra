import { createMealEndpoint } from "../supabase/functions/analyze-meal/runtime.ts";
import { createBodyEndpoint } from "../supabase/functions/analyze-body-photos/runtime.ts";
import { createCoachEndpoint } from "../supabase/functions/coach/runtime.ts";
import { createHealthEndpoint } from "../supabase/functions/health-steps/runtime.ts";
import { createDeleteEndpoint } from "../supabase/functions/delete-account/runtime.ts";
import { createVitEndpoint } from "../supabase/functions/vit/runtime.ts";

export const endpointFactories = {
  "analyze-meal": createMealEndpoint,
  "analyze-body-photos": createBodyEndpoint,
  coach: createCoachEndpoint,
  vit: createVitEndpoint,
  "health-steps": createHealthEndpoint,
  "delete-account": createDeleteEndpoint,
};
