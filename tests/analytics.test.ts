import { it, expect } from "vitest";
import {
  estimate1RM,
  detectPlateaus,
  weeklyMuscleBalance,
  dismissUntil,
  alertsDismissed,
  sessionPerformance,
  type AnalyticsLog,
} from "../src/lib/analytics";
import { exercises } from "../src/data/exercises";
const log = (
  date: string,
  load = 50,
  deload = false,
  name = "Supino reto",
): AnalyticsLog => ({
  date,
  deload,
  exercises: [{ name }],
  sets: {
    "0-0": { load, reps: 10, done: true },
    "0-1": { load, reps: 10, done: true, type: "aquecimento" },
  },
});
it("Epley limita reps e ignora aquecimento/incompletas", () => {
  expect(estimate1RM(60, 10)).toBe(80);
  expect(estimate1RM(60, 1)).toBe(60);
  expect(estimate1RM(60, 13)).toBeNull();
  expect(estimate1RM(NaN, 8)).toBeNull();
  expect(sessionPerformance(log("2026-10-04")).volume).toBe(500);
});
it("platô exige ambas janelas e pelo menos 3 semanas", () => {
  const rows = ["2026-08-25", "2026-09-04", "2026-09-20", "2026-10-01"].map(
    (date) => log(date),
  );
  expect(detectPlateaus(rows, "2026-10-04")).toHaveLength(1);
  expect(detectPlateaus(rows.slice(1), "2026-10-04")).toEqual([]);
  expect(
    detectPlateaus(
      rows.map((r, i) => (i === 3 ? log(r.date, 55) : r)),
      "2026-10-04",
    ),
  ).toEqual([]);
  expect(
    detectPlateaus(
      rows.map((r, i) => ({ ...r, deload: i === 0 })),
      "2026-10-04",
    ),
  ).toEqual([]);
});
it("equilíbrio usa primário/secundário, razão e limiar de duas semanas", () => {
  const rows = [
    log("2026-09-20"),
    log("2026-09-21"),
    log("2026-10-01", 30, false, "Remada baixa"),
  ];
  const balance = weeklyMuscleBalance(rows, exercises, "2026-10-04");
  expect(balance.push / balance.pull).toBe(2);
  expect(balance.total["peito"]).toBe(2);
  expect(balance.total["tríceps"]).toBe(1);
  expect(balance.enough).toBe(true);
  expect(
    weeklyMuscleBalance([rows[0]], exercises, "2026-10-04").alerts,
  ).toEqual([]);
});
it("dispensa somente por 28 dias", () => {
  expect(dismissUntil("2026-10-04")).toBe("2026-11-01");
  expect(alertsDismissed("2026-11-01", "2026-10-31")).toBe(true);
  expect(alertsDismissed("2026-11-01", "2026-11-01")).toBe(false);
});

it("counts exactly 42 calendar days and links legacy names to new slugs", () => {
  const rows = ["2026-08-24", "2026-09-01", "2026-09-20", "2026-10-01"].map(
    (date) => log(date),
  );
  rows[2].exercises[0].exerciseId = "supino-reto";
  expect(detectPlateaus(rows, "2026-10-04")).toHaveLength(1);
  rows[0].date = "2026-08-23";
  expect(detectPlateaus(rows, "2026-10-04")).toEqual([]);
});
