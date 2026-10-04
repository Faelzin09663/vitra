import type { Equipment } from "./exercises";
import { exercises } from "./exercises";
import { toWorkoutExercise } from "../lib/exerciseCatalog";
import { uid } from "../lib/uid";
import type { Workout } from "../lib/store";
export type Program = {
  id: string;
  name: string;
  level: "iniciante" | "intermediário";
  days: number;
  goal: string;
  requiredEquipment: Equipment[];
  durationWeeks: number;
  workouts: Omit<Workout, "id" | "weekdays">[];
};
const template = (name: string, focus: string, names: string[]) => ({
  name,
  focus,
  exercises: names.map((n) => {
    const ex = exercises.find((e) => e.name === n);
    if (!ex) throw new Error("Exercício de programa ausente");
    return { ...toWorkoutExercise(ex), restSeconds: 120 };
  }),
});
const push = template("Empurrar", "Peito, ombros e tríceps", [
  "Supino reto",
  "Supino inclinado com halteres",
  "Desenvolvimento de ombros",
  "Elevação lateral",
  "Tríceps na polia",
]);
const pull = template("Puxar", "Costas e bíceps", [
  "Puxada frontal",
  "Remada baixa",
  "Crucifixo inverso",
  "Rosca direta",
  "Rosca martelo",
]);
const legs = template("Pernas", "Quadríceps, posterior e glúteos", [
  "Agachamento livre",
  "Levantamento romeno",
  "Cadeira extensora",
  "Flexão de joelho sentado",
  "Panturrilha em pé",
]);
const full = [
  template("Corpo inteiro A", "Base de força", [
    "Agachamento goblet",
    "Supino reto com halteres",
    "Remada unilateral",
    "Prancha frontal",
  ]),
  template("Corpo inteiro B", "Controle e equilíbrio", [
    "Levantamento romeno com halteres",
    "Desenvolvimento de ombros",
    "Puxada frontal",
    "Passada reversa",
  ]),
  template("Corpo inteiro C", "Prática e constância", [
    "Leg press",
    "Flexão inclinada",
    "Remada baixa",
    "Ponte de glúteos",
    "Panturrilha unilateral",
  ]),
];
const specs: [
  string,
  string,
  Program["level"],
  Omit<Workout, "id" | "weekdays">[],
][] = [
  ["full-body-3", "Full Body 3x", "intermediário", full],
  [
    "upper-lower-4",
    "Upper/Lower 4x",
    "intermediário",
    [
      template("Superior A", "Empurrar e puxar", [
        "Supino reto",
        "Remada curvada",
        "Elevação lateral",
        "Rosca direta",
      ]),
      legs,
      template("Superior B", "Variações de superior", [
        "Supino inclinado com halteres",
        "Puxada neutra",
        "Desenvolvimento de ombros",
        "Tríceps corda",
      ]),
      template("Inferior B", "Posterior e unilateral", [
        "Levantamento romeno",
        "Agachamento búlgaro",
        "Flexão de joelho sentado",
        "Panturrilha sentada",
      ]),
    ],
  ],
  ["ppl-3", "Push/Pull/Legs 3x", "intermediário", [push, pull, legs]],
  [
    "ppl-6",
    "Push/Pull/Legs 6x",
    "intermediário",
    [
      push,
      pull,
      legs,
      template("Empurrar B", "Variações de peito", [
        "Supino na máquina",
        "Crucifixo inclinado",
        "Elevação lateral na polia",
        "Tríceps francês",
      ]),
      template("Puxar B", "Variações de costas", [
        "Remada apoiada",
        "Puxada neutra",
        "Face pull",
        "Rosca inclinada",
      ]),
      template("Pernas B", "Variações de pernas", [
        "Leg press",
        "Passada com halteres",
        "Flexão de joelho deitado",
        "Panturrilha no leg press",
      ]),
    ],
  ],
  [
    "abc",
    "ABC",
    "intermediário",
    [
      { ...push, name: "ABC — A" },
      { ...pull, name: "ABC — B" },
      { ...legs, name: "ABC — C" },
    ],
  ],
  [
    "abcde",
    "ABCDE",
    "intermediário",
    [
      template("ABCDE — A", "Peito", [
        "Supino reto",
        "Supino inclinado com halteres",
        "Crucifixo reto",
      ]),
      template("ABCDE — B", "Costas", [
        "Puxada frontal",
        "Remada curvada",
        "Remada baixa",
      ]),
      template("ABCDE — C", "Pernas", [
        "Agachamento livre",
        "Leg press",
        "Flexão de joelho sentado",
        "Panturrilha em pé",
      ]),
      template("ABCDE — D", "Ombros", [
        "Desenvolvimento de ombros",
        "Elevação lateral",
        "Crucifixo inverso",
      ]),
      template("ABCDE — E", "Braços", [
        "Rosca direta",
        "Rosca martelo",
        "Tríceps corda",
        "Tríceps testa",
      ]),
    ],
  ],
  [
    "iniciante-3",
    "Primeiros passos 3x",
    "iniciante",
    full.map((w) => ({
      ...w,
      name: `Iniciante — ${w.name.at(-1)}`,
      exercises: w.exercises.map((ex) => ({ ...ex, sets: 2, reps: "10–12" })),
    })),
  ],
];
export const programs: Program[] = specs.map(([id, name, level, workouts]) => ({
  id,
  name,
  level,
  days: workouts.length,
  goal: "Construir constância e força com progressão gradual",
  durationWeeks: 8,
  requiredEquipment: [
    ...new Set(
      workouts.flatMap((w) =>
        w.exercises.map(
          (e) => exercises.find((c) => c.id === e.exerciseId)!.equipment,
        ),
      ),
    ),
  ],
  workouts,
}));
export function importProgram(
  program: Program,
  existing: Workout[],
  weekdays: number[][],
): { workouts: Workout[]; renamed: string[] } {
  const names = new Set(existing.map((w) => w.name.toLocaleLowerCase("pt-BR"))),
    renamed: string[] = [];
  const added = program.workouts.map((w, i) => {
    let name = w.name,
      n = 2;
    while (names.has(name.toLocaleLowerCase("pt-BR")))
      name = `${w.name} (${n++})`;
    if (name !== w.name) renamed.push(`${w.name} → ${name}`);
    names.add(name.toLocaleLowerCase("pt-BR"));
    return {
      ...structuredClone(w),
      id: uid(),
      name,
      weekdays: [
        ...new Set(
          (weekdays[i] || []).filter(
            (d) => Number.isInteger(d) && d >= 0 && d <= 6,
          ),
        ),
      ],
    };
  });
  return { workouts: [...existing, ...added], renamed };
}
