import {
  privateAIHandler,
  PublicError,
  type PrivateAIBase,
} from "./private-ai-handler.ts";
export type DeleteAccountDeps = PrivateAIBase & {
  verifyPassword: (userId: string, password: string) => Promise<boolean>;
  deleteOwnData: (userId: string) => Promise<void>;
};
export function createDeleteAccountHandler(deps: DeleteAccountDeps) {
  return privateAIHandler(deps, async (body, userId) => {
    if (
      Object.keys(body).sort().join() !== "confirmation,password" ||
      body.confirmation !== "EXCLUIR MINHA CONTA" ||
      typeof body.password !== "string" ||
      body.password.length < 1 ||
      body.password.length > 200
    )
      throw new PublicError(400, "Confirme a exclusão com sua senha atual.");
    if (!(await deps.verifyPassword(userId, body.password)))
      throw new PublicError(403, "A senha não foi confirmada.");
    await deps.deleteOwnData(userId);
    return { deleted: true };
  });
}
