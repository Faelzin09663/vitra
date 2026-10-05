import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import {
  createVitHandler,
  type SavedVitResponse,
} from "../_shared/vit-handler.ts";
import { adultConsent } from "../_shared/ai-consent.ts";
import {
  createGeminiProvider,
  geminiConfig,
} from "../_shared/gemini-provider.ts";
import { PublicError } from "../_shared/private-ai-handler.ts";
import { parseBodyAnalysis } from "../_shared/body-schema.ts";
import { coachContext } from "../_shared/coach-data.ts";
import { loadCoachData } from "../coach/runtime.ts";
import { createBodyEndpoint } from "../analyze-body-photos/runtime.ts";
import { vitDayContext } from "../_shared/vit-context.ts";
import type { Store } from "../../../src/lib/store.ts";
import type { EnvReader } from "../_shared/server-env.ts";
export function createVitEndpoint(env: EnvReader) {
  const url = env.get("SUPABASE_URL")!;
  const admin = createClient(url, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = (token: string) =>
    createClient(url, env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const readDashboard = async (owner: string, token: string) => {
    const r = await client(token).from("user_data").select("data").eq(
      "user_id",
      owner,
    ).maybeSingle();
    if (r.error || !r.data) {
      throw new PublicError(
        503,
        "Perfil indisponível. Salve seus dados antes de conversar.",
      );
    }
    return r.data.data as Store;
  };
  return createVitHandler({
    allowedOrigins: env.get("ALLOWED_ORIGINS"),
    provider: createGeminiProvider(
      geminiConfig((name) => env.get(name), "vit"),
    ),
    authenticate: async (token) => {
      const r = await admin.auth.getUser(token);
      return r.error ? null : r.data.user?.id || null;
    },
    hasConsent: async (owner, token) =>
      adultConsent(await readDashboard(owner, token), "vit_consent"),
    allowRequest: async (owner) => {
      const r = await admin.rpc("consume_ai_request", { owner, kind: "chat" });
      if (r.error) throw r.error;
      return r.data === true;
    },
    existing: async (owner, conversation, request) => {
      const r = await admin.from("vit_messages").select(
        "role,content,photo_id,metadata",
      ).eq("user_id", owner).eq("conversation_id", conversation).eq(
        "request_id",
        request,
      );
      if (r.error) {
        throw new PublicError(
          503,
          "Ative a migração do VIT no Supabase antes de conversar.",
        );
      }
      const answer = r.data?.find((x) => x.role === "assistant"),
        prompt = r.data?.find((x) => x.role === "user");
      return answer && prompt
        ? {
          prompt: prompt.content,
          photoId: prompt.photo_id,
          response: answer.metadata as SavedVitResponse,
        }
        : null;
    },
    loadState: async (owner, conversation, token) => {
      const db = client(token),
        today = new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Sao_Paulo",
        }).format(new Date());
      const own = await db.from("vit_conversations").select("id").eq(
        "id",
        conversation,
      ).eq("user_id", owner).maybeSingle();
      if (own.error || !own.data) {
        throw new PublicError(404, "Conversa indisponível.");
      }
      const [dashboard, data, messages, memories] = await Promise.all([
        readDashboard(owner, token),
        loadCoachData(env, owner, token, today),
        db.from("vit_messages").select("role,content,sequence").eq(
          "conversation_id",
          conversation,
        ).eq("user_id", owner).order("sequence", { ascending: false }).limit(
          16,
        ),
        db.from("vit_memories").select("content").eq("user_id", owner).eq(
          "active",
          true,
        ).order("updated_at", { ascending: false }).order("id").limit(20),
      ]);
      if (messages.error || memories.error) {
        throw new PublicError(
          503,
          "Não foi possível ler a memória da sua conta.",
        );
      }
      const daily = vitDayContext(dashboard, today);
      return {
        context: coachContext(data, today),
        budget: daily.budget,
        goal: {
          objective: dashboard.profile.calorieObjective || "maintenance",
          method: dashboard.profile.energyBasis || "activity",
        },
        wellbeingRisk: data.wellbeingRisk || daily.requiresSupport,
        history: [...(messages.data || [])].reverse().map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        memories: (memories.data || []).map((m) => m.content),
      };
    },
    analyzePhoto: async (_owner, id, token) => {
      // Reuse the dedicated owner/consent/quota/vision validation pipeline. Never trust a client URL.
      const response = await createBodyEndpoint(env)(
        new Request("https://vitra.internal/analyze-body-photos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ photoIds: [id] }),
        }),
      );
      const data = await response.json();
      if (!response.ok) {
        throw new PublicError(
          response.status,
          typeof data.error === "string" ? data.error : "Foto indisponível.",
        );
      }
      return parseBodyAnalysis(JSON.stringify(data.analysis));
    },
    save: async (owner, conversation, request, prompt, photoId, response) => {
      const { answer, model, ...details } = response;
      const r = await admin.rpc("save_vit_turn", {
        owner,
        target_conversation: conversation,
        target_request: request,
        prompt_text: prompt,
        answer_text: answer,
        attachment: photoId,
        details,
        provider_model: model,
      });
      if (r.error || !r.data) {
        throw new PublicError(
          503,
          "Não foi possível salvar a conversa. Sua resposta não foi confirmada; tente novamente.",
        );
      }
      return r.data as SavedVitResponse;
    },
  });
}
