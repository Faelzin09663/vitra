import { exercises } from "../../../src/data/exercises.ts";
import { weeklyMuscleBalance } from "../../../src/lib/analytics/index.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createBodyHandler } from "../_shared/body-analysis-handler.ts";
import {
  createGeminiProvider,
  geminiConfig,
} from "../_shared/gemini-provider.ts";
import { adultConsent } from "../_shared/ai-consent.ts";
import { PublicError } from "../_shared/private-ai-handler.ts";
import type { EnvReader } from "../_shared/server-env.ts";

export function createBodyEndpoint(env: EnvReader) {
  const url = env.get("SUPABASE_URL")!,
    admin = createClient(url, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const userClient = (token: string) =>
    createClient(url, env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return createBodyHandler({
    allowedOrigins: env.get("ALLOWED_ORIGINS"),
    provider: createGeminiProvider(
      geminiConfig((name) => env.get(name), "body"),
    ),
    authenticate: async (token) => {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user?.id || null;
    },
    hasConsent: async (userId, token) => {
      const { data, error } = await userClient(token)
        .from("user_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return adultConsent(data?.data, "body_consent");
    },
    allowRequest: async (owner, kind) => {
      const { data, error } = await admin.rpc("consume_ai_request", {
        owner,
        kind,
      });
      if (error) throw error;
      return data === true;
    },
    loadPhotos: async (userId, ids, token) => {
      const client = userClient(token);
      const { data, error } = await client
        .from("progress_photos")
        .select("id,date,angle,note,storage_path")
        .eq("user_id", userId)
        .in("id", ids);
      if (error || data?.length !== ids.length)
        throw new PublicError(404, "Fotos indisponíveis.");
      const photos = [];
      for (const id of ids) {
        const row = data.find((p) => p.id === id)!;
        if (
          !row.storage_path.startsWith(userId + "/") ||
          row.storage_path.includes("..")
        )
          throw new PublicError(404, "Foto indisponível.");
        const file = await client.storage
          .from("progress-photos")
          .download(row.storage_path);
        if (
          file.error ||
          !file.data ||
          file.data.size > 1500000 ||
          !["image/jpeg", "image/webp"].includes(file.data.type)
        )
          throw new PublicError(404, "Foto indisponível.");
        const bytes = new Uint8Array(await file.data.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        photos.push({
          id: row.id,
          date: row.date,
          angle: row.angle,
          note: row.note,
          mimeType: file.data.type as "image/jpeg" | "image/webp",
          base64: btoa(binary),
        });
      }
      const profile = await client
        .from("user_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      const height = profile.data?.data?.profile?.heightCm,
        weight = profile.data?.data?.weights?.at(-1)?.value;
      const b = weeklyMuscleBalance(
        profile.data?.data?.workoutLogs || [],
        exercises,
        new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Sao_Paulo",
        }).format(new Date()),
      );
      return {
        photos,
        balance: {
          weekly: b.weekly,
          push: b.push,
          pull: b.pull,
          enough: b.enough,
        },
        bmi: height && weight ? weight / (height / 100) ** 2 : null,
      };
    },
  });
}
