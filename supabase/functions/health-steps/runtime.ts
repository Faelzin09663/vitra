import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createHealthHandler } from "../_shared/health-handler.ts";
import type { EnvReader } from "../_shared/server-env.ts";

export function createHealthEndpoint(env: EnvReader) {
  const admin = createClient(
    env.get("SUPABASE_URL")!,
    env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return createHealthHandler({
    allowRequest: async (hash) => {
      const { data, error } = await admin.rpc("consume_health_steps", {
        token_digest: hash,
      });
      if (error) throw error;
      return data === true;
    },
    findOwner: async (hash) => {
      const { data, error } = await admin
        .from("health_connections")
        .select("user_id")
        .eq("token_hash", hash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      return data?.user_id || null;
    },
    save: async (owner, date, steps) => {
      const { error } = await admin
        .from("daily_steps")
        .upsert(
          {
            user_id: owner,
            recorded_on: date,
            steps,
            source: "apple-health-shortcut",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,recorded_on" },
        );
      if (error) throw error;
    },
  });
}
