import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createDeleteAccountHandler } from "../_shared/delete-account-handler.ts";
import { PublicError } from "../_shared/private-ai-handler.ts";
import type { EnvReader } from "../_shared/server-env.ts";

export function createDeleteEndpoint(env: EnvReader) {
  const url = env.get("SUPABASE_URL")!,
    admin = createClient(url, env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return createDeleteAccountHandler({
    allowedOrigins: env.get("ALLOWED_ORIGINS"),
    authenticate: async (token) => {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user?.id || null;
    },
    verifyPassword: async (userId, password) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data.user?.email) return false;
      const client = createClient(url, env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const result = await client.auth.signInWithPassword({
        email: data.user.email,
        password,
      });
      return !result.error && result.data.user?.id === userId;
    },
    deleteOwnData: async (userId) => {
      const bucket = admin.storage.from("progress-photos"),
        pending = [userId],
        files: string[] = [];
      let scanned = 0;
      while (pending.length) {
        const folder = pending.pop()!;
        if (
          !(folder === userId || folder.startsWith(userId + "/")) ||
          folder.includes("..")
        )
          throw new PublicError(
            503,
            "Não foi possível concluir a limpeza de fotos.",
          );
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await bucket.list(folder, {
            limit: 1000,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
          if (error || !data)
            throw new PublicError(503, "Não foi possível listar suas fotos.");
          for (const entry of data) {
            if (entry.name.includes("/") || entry.name.includes(".."))
              throw new PublicError(503, "Caminho de foto inválido.");
            const path = folder + "/" + entry.name;
            if (entry.id) files.push(path);
            else pending.push(path);
            if (++scanned > 10000)
              throw new PublicError(
                503,
                "Muitos arquivos; procure o administrador para concluir a exclusão.",
              );
          }
          if (data.length < 1000) break;
        }
      }
      for (let i = 0; i < files.length; i += 100) {
        const result = await bucket.remove(files.slice(i, i + 100));
        if (result.error)
          throw new PublicError(
            503,
            "Não foi possível apagar todas as fotos. Tente novamente.",
          );
      }
      // auth.users cascades through every Vitra user-owned table. Storage first avoids orphaned files.
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error)
        throw new PublicError(
          503,
          "Não foi possível excluir a conta. Tente novamente.",
        );
    },
  });
}
