import { supabase } from "./supabase";
import type { Store } from "./store";
export const BACKUP_TABLES = {
  daily_records: "recorded_on",
  daily_steps: "recorded_on",
  custom_exercises: "created_at",
  pain_reports: "date",
  body_measurements: "date",
  progress_photos: "date",
  photo_analyses: "created_at",
  daily_checkins: "date",
  habits: "created_at",
  habit_logs: "date",
  vit_conversations: "updated_at",
  vit_messages: "sequence",
  vit_memories: "updated_at",
} as const;
export async function collectBackup(userId: string, dashboard: Store) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const readAll = async (table: string, order: string) => {
    const rows: unknown[] = [];
    for (let offset = 0;; offset += 1000) {
      let query = supabase!
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .order(order, { ascending: true });
      if (
        [
          "pain_reports",
          "progress_photos",
          "photo_analyses",
          "habits",
          "custom_exercises",
          "vit_conversations",
          "vit_memories",
        ].includes(table)
      ) {
        query = query.order("id");
      }
      if (table === "habit_logs") query = query.order("habit_id");
      const { data, error } = await query.range(offset, offset + 999);
      if (error) {
        throw new Error(
          "Não foi possível exportar o histórico completo. Confira a conexão e as migrações.",
        );
      }
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  };
  const entries = await Promise.all(
    Object.entries(BACKUP_TABLES).map(async ([table, order]) => [
      table,
      await readAll(table, order),
    ]),
  );
  return {
    format: "vitra-backup",
    version: 4,
    exportedAt: new Date().toISOString(),
    dashboard,
    tables: Object.fromEntries(entries),
    photos:
      "Somente metadados. Baixe as imagens privadas separadamente antes de excluir a conta.",
  };
}
export async function exportBackup(userId: string, dashboard: Store) {
  const backup = await collectBackup(userId, dashboard);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `vitra-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  // Integration tokens and authentication credentials are deliberately not exported.
}
