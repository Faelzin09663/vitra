import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { VitPanel } from "../src/components/VitPanel";
import { VitConsentSettings } from "../src/components/VitConsentSettings";
import { createInitialStore } from "../src/lib/store";
const { save, remove, invoke, table, query } = vi.hoisted(() => {
  const query: any = {};
  for (const name of ["select", "eq", "order", "limit", "lt"]) {
    query[name] = vi.fn(() => query);
  }
  query.then = (fn: any) =>
    Promise.resolve({
      data: [{
        id: "m",
        role: "assistant",
        content: "Resposta salva anteriormente.",
        sequence: 2,
        photo_id: null,
        metadata: { memorySuggestions: ["Prefiro refeições simples."] },
      }],
      error: null,
    }).then(fn);
  return {
    save: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    invoke: vi.fn(),
    table: vi.fn(() => query),
    query,
  };
});
vi.mock("../src/lib/supabase", () => ({ supabase: { from: table } }));
vi.mock("../src/lib/api", () => ({ invokeAPI: invoke }));
vi.mock("../src/lib/useRecords", () => ({
  useRecords: (name: string) => ({
    rows: name === "vit_conversations"
      ? [{
        id: "00000000-0000-4000-8000-000000000001",
        title: "Minha conversa",
        user_id: "owner",
        updated_at: "2026-10-04",
      }]
      : [],
    loading: false,
    error: "",
    save,
    remove,
    reload: vi.fn(async () => {}),
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function view() {
  const s = createInitialStore();
  s.profile.age = 30;
  s.preferences.vit_consent = { version: 1, grantedAt: "2026-10-04T12:00:00Z" };
  const beforeAsk = vi.fn(async () => {});
  render(
    <React.StrictMode>
      <VitPanel
        store={s}
        userId="owner"
        beforeAsk={beforeAsk}
        onConsent={vi.fn()}
        onBodyConsent={vi.fn()}
      />
    </React.StrictMode>,
  );
  return { beforeAsk };
}
it("restaura histórico da conta em StrictMode e exige confirmar antes de salvar memória proposta", async () => {
  view();
  await screen.findByText("Resposta salva anteriormente.");
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar memória" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Prefiro refeições simples.",
        active: true,
      }),
    )
  );
});
it("envia texto com conversa/requestId depois de persistir o perfil, sem enviar contexto do cliente", async () => {
  invoke.mockResolvedValue({
    data: { answer: "Nova resposta", memorySuggestions: [], model: "mock" },
    error: null,
  });
  const { beforeAsk } = view();
  await screen.findByText("Resposta salva anteriormente.");
  fireEvent.change(screen.getByLabelText("Converse com o VIT"), {
    target: { value: "Como melhorar meu treino?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar ao VIT" }));
  await waitFor(() => expect(invoke).toHaveBeenCalled());
  expect(invoke.mock.calls[0][1].body).toMatchObject({
    conversationId: "00000000-0000-4000-8000-000000000001",
    message: "Como melhorar meu treino?",
    photoId: null,
  });
  expect(Object.keys(invoke.mock.calls[0][1].body).sort()).toEqual([
    "conversationId",
    "message",
    "photoId",
    "requestId",
  ]);
  expect(beforeAsk.mock.invocationCallOrder[0]).toBeLessThan(
    invoke.mock.invocationCallOrder[0],
  );
});
it("termo VIT separa a autorização de fotos e não envia automaticamente", async () => {
  const onConsent = vi.fn(async () => {}), onBody = vi.fn(async () => {});
  render(
    <VitConsentSettings
      age={30}
      consent={null}
      bodyConsent={null}
      onConsent={onConsent}
      onBodyConsent={onBody}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Autorizar VIT" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByLabelText(/Autorizo o VIT/));
  fireEvent.click(screen.getByRole("button", { name: "Autorizar VIT" }));
  await waitFor(() =>
    expect(onConsent).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1 }),
    )
  );
  expect(onBody).not.toHaveBeenCalled();
  expect(invoke).not.toHaveBeenCalled();
});
