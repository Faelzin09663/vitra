import { createClient } from "@supabase/supabase-js";
import { createCoachHandler } from "../_shared/coach-handler.ts";
import { adultConsent } from "../_shared/ai-consent.ts";
import {
  createGeminiProvider,
  geminiConfig,
} from "../_shared/gemini-provider.ts";
import { PublicError } from "../_shared/private-ai-handler.ts";
import { wellbeingConcern } from "../_shared/body-schema.ts";
import { isoDate } from "../../../src/lib/analytics/index.ts";
import type { CoachData } from "../_shared/coach-data.ts";
import type { CheckIn, Habit, HabitLog } from "../../../src/lib/habits.ts";
import type { EnvReader } from "../_shared/server-env.ts";

export function createCoachEndpoint(env: EnvReader) {
  const url = env.get("SUPABASE_URL")!,
    admin = createClient(url, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const userClient = (token: string) =>
    createClient(url, env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const today = () =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    );
  return createCoachHandler({
    allowedOrigins: env.get("ALLOWED_ORIGINS"),
    today,
    provider: createGeminiProvider(
      geminiConfig((name) => env.get(name), "coach"),
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
      return adultConsent(data?.data, "ai_consent");
    },
    allowRequest: async (owner, kind) => {
      const { data, error } = await admin.rpc("consume_ai_request", {
        owner,
        kind,
      });
      if (error) throw error;
      return data === true;
    },
    loadData: (userId, token, now) => loadCoachData(env, userId, token, now),
  });
}

export async function loadCoachData(
  env: EnvReader,
  userId: string,
  token: string,
  now: string,
): Promise<CoachData> {
  const userClient = (token: string) =>
    createClient(env.get("SUPABASE_URL")!, env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const client = userClient(token),
    from = new Date(Date.parse(now) - 89 * 86400000)
      .toISOString()
      .slice(0, 10);
  const row = await client
    .from("user_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (row.error || !row.data) {
    throw new PublicError(503, "Registros indisponíveis.");
  }
  const dashboard = row.data.data;
  const read = async (table: string, column = "date") => {
    const r = await client
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .gte(column, from)
      .lte(column, now)
      .order(column)
      .limit(1000);
    if (r.error || !r.data || r.data.length >= 1000) {
      throw new PublicError(
        503,
        "Não foi possível ler o período completo.",
      );
    }
    return r.data;
  };
  const [history, checkins, pain, habitLogs, habitsResult] = await Promise.all([
    read("daily_records", "recorded_on"),
    read("daily_checkins"),
    read("pain_reports"),
    read("habit_logs"),
    client
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("created_at")
      .limit(100),
  ]);
  if (
    habitsResult.error ||
    !habitsResult.data ||
    habitsResult.data.length >= 100
  ) {
    throw new PublicError(503, "Hábitos indisponíveis.");
  }
  const days = new Map<string, Record<string, unknown>>(
    history.map((r) => [r.recorded_on, r.data]),
  );
  days.set(isoDate(dashboard.day), dashboard);
  const meals: CoachData["meals"] = [];
  for (const [date, d] of days) {
    if (date < from || date > now) continue;
    const entries = d.meals;
    if (Array.isArray(entries)) {
      for (const m of entries) {
        if (
          ["calories", "protein", "carbs", "fat"].every(
            (k) =>
              typeof m[k] === "number" &&
              Number.isFinite(m[k]) &&
              m[k] >= 0 &&
              m[k] <= 100000,
          )
        ) {
          meals.push({
            date,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fat: m.fat,
          });
        }
      }
    }
  }
  const logs = new Map<string, CoachData["workouts"][number]>();
  for (const d of [...days.values(), dashboard]) {
    if (Array.isArray(d.workoutLogs)) {
      for (const log of d.workoutLogs) {
        if (
          log &&
          typeof log.date === "string" &&
          isoDate(log.date) >= from &&
          isoDate(log.date) <= now &&
          Array.isArray(log.exercises) &&
          log.sets &&
          typeof log.sets === "object"
        ) {
          logs.set(String(log.id || log.at || JSON.stringify(log)), log);
        }
      }
    }
  }
  const weights: Array<{ date: string; value: number }> = Array.isArray(
      dashboard.weights,
    )
    ? dashboard.weights
      .filter(
        (w: { date: string; value: number }) =>
          typeof w.date === "string" &&
          isoDate(w.date) >= from &&
          isoDate(w.date) <= now &&
          Number.isFinite(w.value) &&
          w.value > 0 &&
          w.value <= 500,
      )
      .map((w: { date: string; value: number }) => ({
        date: isoDate(w.date),
        value: w.value,
      }))
      .sort((a: { date: string }, b: { date: string }) =>
        a.date.localeCompare(b.date)
      )
    : [];
  const height = dashboard.profile?.heightCm,
    weight = weights.at(-1)?.value,
    bmi = height && weight ? weight / (height / 100) ** 2 : null;
  const wellbeingRisk = wellbeingConcern(
    [
      ...checkins.map((r) => r.note || ""),
      ...pain.map((r) => r.note || ""),
      ...(Array.isArray(dashboard.weights)
        ? dashboard.weights
          .slice(-10)
          .map((r: { note?: string }) => r.note || "")
        : []),
    ].join(" "),
    bmi,
  );
  // Whitelist DTO: no auth/profile names, email, object paths, food names, notes or photos.
  return {
    workouts: [...logs.values()],
    meals,
    weights,
    checkins: checkins as CheckIn[],
    pain: pain.map((r) => ({
      date: r.date,
      region: r.region,
      intensity: r.intensity,
    })),
    habits: habitsResult.data as Habit[],
    habitLogs: habitLogs as HabitLog[],
    plannedDays: Array.isArray(dashboard.workouts)
      ? new Set(
        dashboard.workouts.flatMap(
          (w: { weekdays?: number[] }) => w.weekdays || [],
        ),
      ).size
      : 0,
    wellbeingRisk,
  };
}
