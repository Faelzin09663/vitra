import { it, expect, vi } from "vitest";
import { collectBackup, BACKUP_TABLES } from "../src/lib/exportBackup";
import { createInitialStore } from "../src/lib/store";
import { createDeleteAccountHandler } from "../supabase/functions/_shared/delete-account-handler";
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: { from } }));
it("backup inclui todas as tabelas novas, paginação e isolamento sem tokens/imagens", async () => {
  const calls: string[] = [];
  from.mockImplementation((table: string) => {
    calls.push(table);
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((_key: string, id: string) => {
        expect(id).toBe("owner");
        return chain;
      }),
      order: vi.fn(() => chain),
      range: vi.fn(async (start: number) => ({
        data:
          start === 0 && table === "pain_reports"
            ? Array(1000).fill({ date: "2026-10-04" })
            : [{ row: table }],
        error: null,
      })),
    };
    return chain;
  });
  const backup = await collectBackup("owner", createInitialStore());
  expect(Object.keys(backup.tables).sort()).toEqual(
    Object.keys(BACKUP_TABLES).sort(),
  );
  expect(backup.tables.pain_reports).toHaveLength(1001);
  expect(calls).not.toContain("health_connections");
  expect(JSON.stringify(backup)).not.toContain("token_hash");
  expect(backup.version).toBe(3);
});
it("exclusão exige JWT, senha e confirmação; nunca aceita alvo vindo do cliente", async () => {
  const remove = vi.fn(async () => {}),
    verify = vi.fn(async () => true);
  const handler = createDeleteAccountHandler({
    authenticate: async () => "owner",
    verifyPassword: verify,
    deleteOwnData: remove,
  });
  const request = (body: object, auth = true) =>
    new Request("https://local.test", {
      method: "POST",
      headers: auth ? { Authorization: "Bearer jwt" } : {},
      body: JSON.stringify(body),
    });
  const body = {
    confirmation: "EXCLUIR MINHA CONTA",
    password: "test-password-only",
  };
  expect((await handler(request(body, false))).status).toBe(401);
  expect((await handler(request({ ...body, userId: "victim" }))).status).toBe(
    400,
  );
  expect((await handler(request({ ...body, confirmation: "ok" }))).status).toBe(
    400,
  );
  verify.mockResolvedValueOnce(false);
  expect((await handler(request(body))).status).toBe(403);
  expect(remove).not.toHaveBeenCalled();
  expect((await handler(request(body))).status).toBe(200);
  expect(remove).toHaveBeenCalledWith("owner");
});
