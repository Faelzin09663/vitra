import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProfilePanel } from "../src/components/ProfilePanel";
import { WorkoutLibrary } from "../src/components/WorkoutLibrary";
import { calorieInputsNeeded, nutritionEstimates } from "../src/lib/nutrition";
import {
  addWeight,
  createInitialStore,
  finishWorkout,
  normalizeStore,
  removeWorkout,
  saveProfile,
  saveWorkout,
  scheduledWorkout,
  startWorkout,
} from "../src/lib/store";
afterEach(cleanup);
const profile = {
  fullName: "Rafael",
  age: 30,
  heightCm: 180,
  sex: "male" as const,
  activity: 1.55,
  calorieMode: "automatic" as const,
};
describe("Perfil e calorias", () => {
  it("informa exatamente os dados faltantes sem impedir o perfil manual", () => {
    const store = createInitialStore();
    expect(calorieInputsNeeded(store.profile, 80.5)).toEqual([
      "altura entre 100 e 250 cm",
      "idade entre 18 e 100 anos",
      "sexo usado na fórmula",
    ]);
    expect(calorieInputsNeeded(profile, 80.5)).toEqual([]);
    expect(calorieInputsNeeded({ ...profile, activity: 9 }, 80.5)).toEqual([
      "nível de atividade",
    ]);
    const onSave = vi.fn();
    render(
      <ProfilePanel store={store} fallbackName="Rafael" onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ calorieMode: "manual", age: null }),
      null,
    );
  });
  it("remove o erro antigo e mostra a estimativa automática antes de salvar", () => {
    const store = createInitialStore();
    store.weights = [{ date: store.day, value: 80.5 }];
    const onSave = vi.fn();
    render(
      <ProfilePanel store={store} fallbackName="Rafael" onSave={onSave} />,
    );
    fireEvent.click(
      screen.getByRole("radio", { name: /Manutenção estimada, automática/ }),
    );
    expect(screen.getByText("Faltam dados para estimar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(screen.getByRole("alert").textContent).toContain("altura");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Altura (cm)"), {
      target: { value: "180" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText("Idade (anos)"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Sexo usado na fórmula"), {
      target: { value: "male" },
    });
    expect(screen.queryByText("Faltam dados para estimar")).toBeNull();
    expect(
      screen.getByText("Manutenção estimada: 2.142 kcal/dia"),
    ).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        heightCm: 180,
        age: 30,
        sex: "male",
        calorieMode: "automatic",
      }),
      80.5,
    );
    fireEvent.change(screen.getByLabelText("Peso atual (kg)"), {
      target: { value: "79" },
    });
    expect(
      screen.getByText("Manutenção estimada: 2.124 kcal/dia"),
    ).toBeTruthy();
  });
  it("calcula IMC e Mifflin–St Jeor com coeficiente de atividade", () => {
    const result = nutritionEstimates(profile, 80);
    expect(result.bmi).toBeCloseTo(24.691, 2);
    expect(result.basal).toBe(1780);
    expect(result.daily).toBe(2759);
    expect(nutritionEstimates({ ...profile, sex: "female" }, 80).basal).toBe(
      1614,
    );
  });
  it("não recomenda calorias com dados ausentes ou idade menor que 18", () => {
    expect(nutritionEstimates({ ...profile, age: 16 }, 80).daily).toBeNull();
    expect(
      nutritionEstimates({ ...profile, heightCm: null }, 80).daily,
    ).toBeNull();
    expect(nutritionEstimates(profile, null).bmi).toBeNull();
  });
  it("atualiza peso, meta automática e histórico em conjunto", () => {
    let store = createInitialStore();
    store = { ...store, ...saveProfile(store, profile, 80) };
    expect(store.weights.at(-1)?.value).toBe(80);
    expect(store.calorieGoal).toBe(2759);
    store = { ...store, ...addWeight(store, 78, store.day) };
    expect(store.calorieGoal).toBe(2728);
    store = {
      ...store,
      profile: { ...profile, calorieMode: "manual" },
      calorieGoal: 2300,
    };
    store = { ...store, ...addWeight(store, 76, store.day) };
    expect(store.calorieGoal).toBe(2300);
  });
  it("um peso antigo registrado depois não substitui o peso atual nos cálculos", () => {
    let store = { ...createInitialStore(), profile };
    store = { ...store, ...addWeight(store, 80, "03/10/2026") };
    store = { ...store, ...addWeight(store, 90, "01/10/2026") };
    expect(store.weights.at(-1)?.value).toBe(80);
    expect(store.calorieGoal).toBe(2759);
  });
  it("abre os campos do perfil e envia alterações ao salvamento", () => {
    const onSave = vi.fn();
    render(
      <ProfilePanel
        store={createInitialStore()}
        fallbackName="Rafael"
        email="rafael@example.com"
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByLabelText("Peso atual (kg)"), {
      target: { value: "80" },
    });
    fireEvent.change(screen.getByLabelText("Altura (cm)"), {
      target: { value: "180" },
    });
    fireEvent.change(screen.getByLabelText("Idade (anos)"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Sexo usado na fórmula"), {
      target: { value: "male" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Rafael",
        age: 30,
        heightCm: 180,
        sex: "male",
      }),
      80,
    );
  });
});
describe("Múltiplos treinos", () => {
  const second = {
    id: "peito-sexta",
    name: "Peito 2",
    focus: "Peito e bíceps",
    weekdays: [5],
    exercises: [
      { name: "Crucifixo inclinado", sets: 4, reps: "12", restSeconds: 90 },
    ],
  };
  it("migra o treino legado sem perder exercícios", () => {
    const legacy = createInitialStore();
    const saved = JSON.parse(JSON.stringify(legacy));
    delete saved.workouts;
    delete saved.profile;
    delete saved.selectedWorkoutId;
    saved.exercises = [
      { name: "Exercício personalizado", sets: 4, reps: "10" },
    ];
    const migrated = normalizeStore(saved);
    expect(migrated.workouts[0].exercises[0].name).toBe(
      "Exercício personalizado",
    );
    expect(migrated.selectedWorkoutId).toBe("workout-a");
  });
  it("guarda nome e exercícios da sessão, mesmo editando outro modelo", () => {
    let store = createInitialStore();
    store = { ...store, ...saveWorkout(store, second) };
    store = { ...store, ...startWorkout(store) };
    store = {
      ...store,
      ...saveWorkout(store, {
        ...second,
        name: "Peito diferente",
        exercises: [{ name: "Outro", sets: 2, reps: "8" }],
      }),
    };
    const finished = finishWorkout(store);
    expect(finished.workoutLogs?.[0].name).toBe("Peito 2");
    expect(finished.workoutLogs?.[0].exercises[0].name).toBe(
      "Crucifixo inclinado",
    );
  });
  it("seleciona a sessão agendada sem impedir dois treinos do mesmo grupo", () => {
    let store = createInitialStore();
    store = {
      ...store,
      ...saveWorkout(store, second),
      selectedWorkoutId: "workout-a",
    };
    expect(scheduledWorkout(store, new Date(2026, 9, 9)).id).toBe(
      "peito-sexta",
    );
    expect(
      removeWorkout({ ...store, ...startWorkout(store) }, "workout-a"),
    ).toEqual({});
  });
  it("permite criar um treino com seus próprios exercícios e dias", () => {
    const onSave = vi.fn();
    render(
      <WorkoutLibrary
        store={createInitialStore()}
        onSelect={vi.fn()}
        onSave={onSave}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Criar treino" }));
    fireEvent.change(screen.getByLabelText("Nome do treino"), {
      target: { value: "Peito 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sex", exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar exercício" }),
    );
    fireEvent.change(screen.getByLabelText("Nome do exercício"), {
      target: { value: "Crucifixo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar treino" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Peito 2",
        weekdays: [5],
        exercises: [
          expect.objectContaining({
            name: "Crucifixo",
            sets: 3,
            restSeconds: 60,
          }),
        ],
      }),
    );
  });
});
