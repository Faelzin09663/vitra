import { energyBudget } from "../../../src/lib/energy.ts";
import { nutritionEstimates } from "../../../src/lib/nutrition.ts";
import { isoDate } from "../../../src/lib/analytics/index.ts";
import type { Store } from "../../../src/lib/store.ts";

export function vitDayContext(dashboard: Store, today: string) {
  const bmi = nutritionEstimates(
    dashboard.profile,
    dashboard.weights.at(-1)?.value ?? null,
  ).bmi;
  return {
    budget: energyBudget({
      ...dashboard,
      day: today,
      meals: isoDate(dashboard.day) === today ? dashboard.meals : [],
    }),
    requiresSupport: dashboard.profile.calorieObjective === "deficit" &&
      bmi !== null && bmi < 18.5,
  };
}
