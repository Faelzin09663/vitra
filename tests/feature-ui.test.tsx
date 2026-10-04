import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { WorkoutLibrary } from "../src/components/WorkoutLibrary";
import { GymMode } from "../src/components/GymMode";
import { BodyProgress } from "../src/components/BodyProgress";
import { DailyWellbeing } from "../src/components/DailyWellbeing";
import { CoachPanel } from "../src/components/CoachPanel";
import { createInitialStore, startWorkout, type Store } from "../src/lib/store";
const { save, invoke } = vi.hoisted(() => ({
  save: vi.fn(async () => {}),
  invoke: vi.fn(),
}));
vi.mock("../src/lib/useRecords", () => ({
  useRecords: () => ({
    rows: [],
    loading: false,
    error: "",
    save,
    remove: vi.fn(),
    reload: vi.fn(),
  }),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: { functions: { invoke } } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("seletor fica dentro do editor e mantém foco e referência", async () => {
  const onSave = vi.fn();
  render(
    <WorkoutLibrary
      userId="owner"
      store={createInitialStore()}
      onSelect={vi.fn()}
      onSave={onSave}
      onRemove={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Criar treino" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(screen.getByLabelText("Nome do treino"), {
    target: { value: "Novo treino" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Escolher na biblioteca" }),
  );
  fireEvent.change(screen.getByLabelText("Buscar exercício"), {
    target: { value: "bench press" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Adicionar ao treino" }),
  );
  expect(screen.getByLabelText("Nome do exercício")).toHaveProperty(
    "value",
    "Supino reto",
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar treino" }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      exercises: [expect.objectContaining({ exerciseId: "supino-reto" })],
    }),
  );
});
it("academia conclui em um toque e desfaz preservando a sessão", async () => {
  let initial = createInitialStore();
  initial = { ...initial, ...startWorkout(initial) };
  function Harness() {
    const [store, setStore] = React.useState<Store>(initial);
    return (
      <GymMode
        store={store}
        userId="owner"
        onChange={(patch) => setStore((s) => ({ ...s, ...patch }))}
        onFinish={vi.fn()}
      />
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Concluir série" }));
  expect(screen.getByText("Série 2 de 3")).toBeTruthy();
  expect(screen.getByRole("timer", { name: "Descanso" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
  expect(screen.getByText("Série 1 de 3")).toBeTruthy();
});
it("medidas são upsert por data, mantendo campos opcionais", async () => {
  render(
    <BodyProgress
      userId="owner"
      store={createInitialStore()}
      onConsent={vi.fn()}
      beforeAnalyze={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Registrar medidas" }));
  fireEvent.change(screen.getByLabelText("Cintura (cm)"), {
    target: { value: "90" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar medidas" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        waist: 90,
        neck: null,
      }),
      "user_id,date",
    ),
  );
});
it("check-in usa upsert e não exige preencher todas as notas", async () => {
  render(<DailyWellbeing userId="owner" store={createInitialStore()} />);
  fireEvent.click(screen.getByRole("button", { name: "Energia: 4" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar check-in" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ energy: 4, mood: null }),
      "user_id,date",
    ),
  );
});
it("Aplicar proposta abre formulário e nunca escreve antes da confirmação", async () => {
  const store = createInitialStore();
  store.profile.age = 30;
  store.preferences.ai_consent = {
    version: 2,
    grantedAt: "2026-10-04T12:00:00Z",
  };
  const suggestion = {
    action: "Revisar repetições",
    reason: "Há poucos dados.",
    change: {
      workoutIndex: 0,
      exerciseId: "supino-reto",
      sets: 3,
      reps: "8-10",
      restSeconds: 90,
    },
  };
  invoke.mockResolvedValue({
    data: {
      source: { from: "2026-09-28", to: "2026-10-04", records: 2 },
      response: {
        title: "Sua rotina",
        observations: [
          "Há poucos dados.",
          "Registre sessões.",
          "Revise a agenda.",
        ],
        suggestions: [
          suggestion,
          { ...suggestion, change: null },
          { ...suggestion, change: null },
        ],
      },
    },
    error: null,
  });
  const onSave = vi.fn();
  render(
    <CoachPanel
      store={store}
      beforeAsk={vi.fn(async () => {})}
      onConsent={vi.fn()}
      onSave={onSave}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "O que ajustar no meu treino?" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Aplicar (revisar antes)" }),
  );
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Repetições"), {
    target: { value: "10-12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar alteração" }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      exercises: expect.arrayContaining([
        expect.objectContaining({ reps: "10-12" }),
      ]),
    }),
  );
});
