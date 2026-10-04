import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createAnalysisHandler } from "../_shared/analyze-handler.ts";
import {
  createGeminiProvider,
  geminiConfig,
} from "../_shared/gemini-provider.ts";
import { adultConsent } from "../_shared/ai-consent.ts";
import type { EnvReader } from "../_shared/server-env.ts";

export function createMealEndpoint(env: EnvReader) {
  const admin = createClient(
    env.get("SUPABASE_URL")!,
    env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return createAnalysisHandler({
    allowedOrigins: env.get("ALLOWED_ORIGINS"),
    provider: createGeminiProvider(
      geminiConfig((name) => env.get(name), "meal"),
    ),
    authenticate: async (token) => {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user?.id || null;
    },
    hasConsent: async (userId) => {
      const { data, error } = await admin
        .from("user_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return adultConsent(data?.data, "ai_consent");
    },
    allowRequest: async (userId, kind) => {
      const { data, error } = await admin.rpc("consume_ai_request", {
        owner: userId,
        kind,
      });
      if (error) throw error;
      return data === true;
    },
  });
}
