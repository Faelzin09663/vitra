import { invokeAPI } from "../lib/api";
import React from "react";
import { ModalDialog } from "./ModalDialog";
export function AccountData({
  onExport,
  beforeDelete,
  onDeleted,
}: {
  onExport: () => void;
  beforeDelete: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false),
    [confirmation, setConfirmation] = React.useState(""),
    [password, setPassword] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await beforeDelete();
      const r = await invokeAPI("delete-account", {
        body: { confirmation, password },
      });
      setPassword("");
      if (r.error || r.data?.deleted !== true)
        throw new Error(
          r.error?.message || "Não foi possível excluir. Confira sua senha e tente novamente.",
        );
      await onDeleted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-panel">
      <h2>Seus dados</h2>
      <button onClick={onExport}>Exportar backup completo</button>
      <p>
        O backup contém todos os registros e metadados das fotos. Baixe as
        imagens separadamente em Evolução → Fotos.
      </p>
      <button onClick={() => setOpen(true)}>Excluir minha conta</button>
      {open && (
        <ModalDialog
          label="Excluir minha conta"
          onClose={() => {
            if (!busy) {
              setOpen(false);
              setPassword("");
            }
          }}
        >
          <h2>Excluir conta e registros permanentemente?</h2>
          <p>
            Isso apaga seus registros, fotos privadas e análises salvas. Exporte
            o backup e baixe as imagens antes de continuar. Essa ação não pode
            ser desfeita.
          </p>
          <button disabled={busy} onClick={onExport}>
            Exportar antes de excluir
          </button>
          <form onSubmit={remove}>
            <label>
              Digite EXCLUIR MINHA CONTA
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
                autoComplete="off"
              />
            </label>
            <label>
              Senha atual
              <input
                type="password"
                value={password}
                maxLength={200}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button
              className="primary"
              disabled={
                busy || confirmation !== "EXCLUIR MINHA CONTA" || !password
              }
            >
              {busy ? "Excluindo…" : "Confirmar exclusão permanente"}
            </button>
          </form>
          <button
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setPassword("");
            }}
          >
            Cancelar
          </button>
        </ModalDialog>
      )}
    </section>
  );
}
