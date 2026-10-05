import { describe, expect, it } from "vitest";
import {
  energyBudget,
  metEnergy,
  workoutEnergy,
  cardioEnergy,
} from "../src/lib/energy";
import {
  createInitialStore,
  saveProfile,
  startWorkout,
  finishWorkout,
  addCardio,
  normalizeStore,
  addWeight,
} from "../src/lib/store";
const profile = {
  fullName: "Teste",
  age: 30,
  heightCm: 180,
  sex: "male" as const,
  activity: 1.55,
  calorieMode: "automatic" as const,
  energyBasis: "logged" as const,
  calorieObjective: "deficit" as const,
  deficitKcal: 250,
  exerciseCreditPct: 50,
};
describe("Gasto e meta diária", () => {
  it("subtrai repouso e não inventa gasto sem peso ou duração", () => {
    expect(metEnergy(80, 60, 3.5)).toMatchObject({
      grossKcal: 294,
      netKcal: 210,
    });
    expect(metEnergy(null, 60, 3.5)).toBeNull();
    expect(metEnergy(80, 0, 3.5)).toBeNull();
    expect(metEnergy(80, 361, 3.5)).toBeNull();
    expect(cardioEnergy("Outra atividade", 30, 80)).toBeNull();
  });
  it("rateia exercícios concluídos sem duplicar ou gerar parcelas negativas", () => {
    const ex = [
      { name: "A", sets: 1, reps: "10" },
      { name: "B", sets: 1, reps: "10" },
      { name: "C", sets: 1, reps: "10" },
      { name: "D", sets: 1, reps: "10" },
    ];
    const sets = Object.fromEntries(
      ex.map((_, i) => [`${i}-0`, { load: 10, reps: 10, done: true }]),
    );
    const energy = workoutEnergy(ex, sets, 1, 80)!;
    expect(energy.exercises!.every((e) => e.netKcal >= 0)).toBe(true);
    expect(energy.exercises!.reduce((s, e) => s + e.netKcal, 0)).toBe(
      energy.netKcal,
    );
    expect(workoutEnergy(ex, {}, 3600, 80)).toBeNull();
  });
  it("treino finalizado aumenta meta mantendo o déficit e salva peso usado", () => {
    const now = new Date(2026, 9, 4, 10);
    let s = createInitialStore(now);
    s = { ...s, ...saveProfile(s, profile, 80) };
    expect(s.calorieGoal).toBe(1886);
    s = {
      ...s,
      ...startWorkout(s, now),
      sets: { "0-0": { load: 20, reps: 10, done: true } },
    };
    s = { ...s, ...finishWorkout(s, new Date(now.getTime() + 3600000)) };
    expect(s.workoutLogs[0].energy?.netKcal).toBe(210);
    expect(s.calorieGoal).toBe(1991);
    s = { ...s, ...addWeight(s, 78, s.day) };
    expect(s.workoutLogs[0].energy?.weightKg).toBe(80);
    expect(energyBudget(s).deficit).toBe(250);
  });
  it("não soma treino ao fator semanal nem crédito a metas manuais", () => {
    let s = createInitialStore();
    s = {
      ...s,
      ...saveProfile(
        s,
        {
          ...profile,
          energyBasis: "activity",
          calorieObjective: "maintenance",
        },
        80,
      ),
    };
    s = { ...s, ...addCardio(s, "Caminhada", 30) };
    expect(s.calorieGoal).toBe(2759);
    expect(energyBudget(s).credit).toBe(0);
    s = {
      ...s,
      profile: { ...profile, calorieMode: "manual" },
      calorieGoal: 2200,
    };
    expect(energyBudget(s).target).toBe(2200);
  });
  it("virada de dia tira o crédito, sem reestimar registros antigos", () => {
    const now = new Date(2026, 9, 4, 10);
    let s = createInitialStore(now);
    s = { ...s, ...saveProfile(s, profile, 80) };
    s = { ...s, ...addCardio(s, "Caminhada", 30, now, 2) };
    expect(energyBudget(s).cardioKcal).toBe(118);
    expect(s.calorieGoal).toBe(1945);
    s = normalizeStore(s, new Date(2026, 9, 5, 10));
    expect(s.calorieGoal).toBe(1886);
    expect(energyBudget(s).exerciseKcal).toBe(0);
  });
});
