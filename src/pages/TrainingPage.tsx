import React from "react";
import { Check, Plus, Dumbbell } from "lucide-react";
import { currentWorkout, finishWorkout, type Store } from "../lib/store";
import { WorkoutLibrary } from "../components/WorkoutLibrary";
import { FeatureSkeleton } from "../components/FeatureSkeleton";
const GymMode = React.lazy(() =>
  import("../components/GymMode").then((m) => ({ default: m.GymMode })),
);
const SessionTools = React.lazy(() =>
  import("../components/SessionTools").then((m) => ({
    default: m.SessionTools,
  })),
);
const TrainingAnalytics = React.lazy(() =>
  import("../components/TrainingAnalytics").then((m) => ({
    default: m.TrainingAnalytics,
  })),
);
export default function TrainingPage({
  store,
  userId,
  onChange,
  onBegin,
  onAdd,
  onNotice,
  onSave,
  onRemove,
  onImport,
}: {
  store: Store;
  userId: string;
  onChange: (patch: Partial<Store>) => void;
  onBegin: () => void;
  onAdd: () => void;
  onNotice: (text: string) => void;
  onSave: (w: Store["workouts"][number]) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  onImport: (workouts: Store['workouts']) => void | Promise<void>;
}) {
  const [gym, setGym] = React.useState(true),
    training = Boolean(store.activeWorkout),
    selected = currentWorkout(store),
    active = store.activeWorkout,
    workout = active
      ? {
          ...selected,
          name: active.name || selected.name,
          exercises: active.exercises || selected.exercises,
        }
      : selected;
  const finish = () => {
    onChange(finishWorkout(store));
    onNotice("Treino registrado. Mais um passo por você!");
  };
  return (
    <>
      {(!training || !gym) && (
        <WorkoutLibrary
          store={store}
          userId={userId}
          onImport={onImport}
          onSelect={(id) => onChange({ selectedWorkoutId: id })}
          onSave={onSave}
          onRemove={onRemove}
        />
      )}
      {training && (
        <div className="feature-tabs">
          <button onClick={() => setGym((v) => !v)}>
            {gym ? "Visão normal" : "Modo academia"}
          </button>
        </div>
      )}
      <React.Suspense fallback={<FeatureSkeleton />}>
        {training && gym ? (
          <GymMode
            store={store}
            userId={userId}
            onChange={onChange}
            onFinish={finish}
          />
        ) : (
          <>
            <section className="panel">
              <div className="section-heading">
                <h2>
                  {workout.name} · {workout.focus}
                </h2>
                <button
                  className="primary"
                  onClick={
                    training
                      ? onAdd
                      : () => {
                          setGym(true);
                          onBegin();
                        }
                  }
                >
                  {training ? "Adicionar exercício" : "Começar treino"}
                  <Plus size={16} />
                </button>
              </div>
              {workout.exercises.map((ex, i) => (
                <div className="exercise" key={i}>
                  <div className="exercise-title">
                    <span className="tile blue">
                      <Dumbbell size={20} />
                    </span>
                    <div>
                      <h3>{ex.name}</h3>
                      <p>
                        {ex.sets} séries · {ex.reps} repetições ·{" "}
                        {ex.restSeconds ?? 60}s descanso
                      </p>
                    </div>
                  </div>
                  {training &&
                    Array.from({ length: ex.sets }, (_, j) => {
                      const key = `${i}-${j}`,
                        set = store.sets[key] || {
                          load: 0,
                          reps: 10,
                          done: false,
                        };
                      return (
                        <div className="set-row" key={j}>
                          <span>Série {j + 1}</span>
                          <label>
                            Carga (kg)
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              min={0}
                              value={set.load}
                              onChange={(e) =>
                                onChange({
                                  sets: {
                                    ...store.sets,
                                    [key]: {
                                      ...set,
                                      load: Number(e.target.value),
                                    },
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            Repetições
                            <input
                              type="number"
                              min={1}
                              value={set.reps}
                              onChange={(e) =>
                                onChange({
                                  sets: {
                                    ...store.sets,
                                    [key]: {
                                      ...set,
                                      reps: Number(e.target.value),
                                    },
                                  },
                                })
                              }
                            />
                          </label>
                          <button
                            aria-label={`Concluir série ${j + 1} de ${ex.name}`}
                            className={set.done ? "checked" : ""}
                            onClick={() =>
                              onChange({
                                sets: {
                                  ...store.sets,
                                  [key]: { ...set, done: !set.done },
                                },
                                ...(active && !set.done
                                  ? {
                                      activeWorkout: {
                                        ...active,
                                        restUntil: new Date(
                                          Date.now() +
                                            (ex.restSeconds ?? 60) * 1000,
                                        ).toISOString(),
                                      },
                                    }
                                  : {}),
                              })
                            }
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      );
                    })}
                </div>
              ))}
              {training && (
                <button className="primary" onClick={finish}>
                  Finalizar treino <Check size={17} />
                </button>
              )}
            </section>
            {training && (
              <SessionTools store={store} userId={userId} onChange={onChange} />
            )}
          </>
        )}
        {(!training || !gym) && (
          <TrainingAnalytics
            store={store}
            userId={userId}
            onChange={onChange}
            compact
          />
        )}
      </React.Suspense>
    </>
  );
}
