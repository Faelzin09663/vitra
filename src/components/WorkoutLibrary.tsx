import { uid } from "../lib/uid";
import React from "react";
import {
  Dumbbell,
  Plus,
  Pencil,
  Copy,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  Check,
  CalendarDays,
} from "lucide-react";
import { ModalDialog } from "./ModalDialog";
import { ExerciseExplorer } from "./ExerciseExplorer";
import { linkLegacyExercise, toWorkoutExercise } from "../lib/exerciseCatalog";
import type { Exercise, Store, Workout } from "../lib/store";
const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function WorkoutLibrary({
  store,
  onSelect,
  onSave,
  onRemove,
  userId = "",
  onImport,
}: {
  userId?: string;
  onImport?: (workouts: Workout[]) => void | Promise<void>;
  store: Store;
  onSelect: (id: string) => void;
  onSave: (workout: Workout) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = React.useState<Workout | null>(null),
    [removeId, setRemoveId] = React.useState(""),
    [browse, setBrowse] = React.useState(false),
    [picker, setPicker] = React.useState<number | null>(null),
    [saving, setSaving] = React.useState(false),
    [saveError, setSaveError] = React.useState('');
  const savingRef = React.useRef(false);
  async function confirmChange(action: () => void | Promise<void>, done: () => void) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try { await action(); done(); }
    catch { setSaveError('Não foi possível salvar o treino na sua conta. Confira a conexão e tente salvar novamente.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const selected = store.activeWorkout?.workoutId || store.selectedWorkoutId;
  const changeExercise = (index: number, patch: Partial<Exercise>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            exercises: d.exercises.map((ex, i) =>
              i === index ? { ...ex, ...patch } : ex,
            ),
          }
        : null,
    );
  function move(index: number, offset: number) {
    setDraft((d) => {
      if (!d || index + offset < 0 || index + offset >= d.exercises.length)
        return d;
      const exercises = [...d.exercises];
      [exercises[index], exercises[index + offset]] = [
        exercises[index + offset],
        exercises[index],
      ];
      return { ...d, exercises };
    });
  }
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    const workout = {
      ...draft,
      name: draft.name.trim(),
      focus: draft.focus.trim(),
      exercises: draft.exercises.map((ex) => ({
        ...ex,
        ...linkLegacyExercise(ex),
        name: ex.name.trim(),
        reps: ex.reps.trim(),
      })),
    };
    void confirmChange(() => onSave(workout), () => setDraft(null));
  }
  return (
    <section className="workout-library">
      <div className="section-heading">
        <h2>Seus treinos</h2>
        <button
          className="primary"
          onClick={() =>
            setDraft({
              id: uid(),
              name: "",
              focus: "",
              weekdays: [],
              exercises: [],
            })
          }
        >
          <Plus size={16} />
          Criar treino
        </button>
      </div>
      <p className="sub">
        Monte sessões diferentes para o mesmo grupo muscular e organize sua
        semana.
      </p>
      <div className="workout-library-grid">
        {store.workouts.map((w) => (
          <article
            key={w.id}
            className={`workout-option ${selected === w.id ? "selected" : ""}`}
          >
            <button
              className="workout-select"
              disabled={Boolean(store.activeWorkout && selected !== w.id)}
              onClick={() => onSelect(w.id)}
            >
              <span className="tile blue">
                <Dumbbell size={20} />
              </span>
              <div>
                <strong>{w.name}</strong>
                <span>{w.focus || "Treino personalizado"}</span>
              </div>
              {selected === w.id && <Check size={17} />}
            </button>
            <p>
              {w.exercises.length} exercícios
              {w.weekdays.length > 0 && (
                <> · {w.weekdays.map((d) => days[d]).join(", ")}</>
              )}
            </p>
            <div className="workout-option-actions">
              <button
                className="text"
                disabled={store.activeWorkout?.workoutId === w.id}
                onClick={() => setDraft(structuredClone(w))}
              >
                <Pencil size={13} />
                Editar
              </button>
              <button
                className="text"
                onClick={() =>
                  setDraft({
                    ...structuredClone(w),
                    id: uid(),
                    name: `${w.name} — variação`,
                    weekdays: [],
                  })
                }
              >
                <Copy size={13} />
                Duplicar
              </button>
              <button
                className="text remove-workout"
                disabled={
                  store.workouts.length === 1 ||
                  store.activeWorkout?.workoutId === w.id
                }
                aria-label={`Excluir ${w.name}`}
                onClick={() => setRemoveId(w.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {store.activeWorkout && (
        <p className="estimate-note">
          Finalize o treino atual antes de começar outro. Os exercícios da
          sessão em andamento são preservados.
        </p>
      )}
      <button type="button" onClick={() => setBrowse((v) => !v)}>
        Biblioteca / Programas
      </button>
      {browse && (
        <ExerciseExplorer
          userId={userId}
          workouts={store.workouts}
          onImport={onImport}
          onAdd={(ex) =>
            onSave({
              ...store.workouts.find((w) => w.id === store.selectedWorkoutId)!,
              exercises: [
                ...(store.workouts.find((w) => w.id === store.selectedWorkoutId)
                  ?.exercises || []),
                toWorkoutExercise(ex),
              ],
            })
          }
        />
      )}
      {draft && (
        <ModalDialog
          label="Configurar treino"
          className="workout-editor feature-panel"
          onClose={() => {
            if (savingRef.current) return;
            setDraft(null);
            setPicker(null);
          }}
        >
          <div className="section-heading">
            <h2>
              {store.workouts.some((w) => w.id === draft.id)
                ? "Editar treino"
                : "Criar treino"}
            </h2>
            <button
              aria-label="Fechar"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setPicker(null);
              }}
            >
              <X size={20} />
            </button>
          </div>
          {picker !== null ? (
            <>
              <button type="button" onClick={() => setPicker(null)}>
                Voltar ao editor
              </button>
              <ExerciseExplorer
                selector
                userId={userId}
                workouts={store.workouts}
                onAdd={(ex) => {
                  if (picker === -1)
                    setDraft({
                      ...draft,
                      exercises: [...draft.exercises, toWorkoutExercise(ex)],
                    });
                  else
                    changeExercise(picker, {
                      name: ex.name,
                      exerciseId: ex.id,
                    });
                  setPicker(null);
                }}
              />
            </>
          ) : (
            <form onSubmit={save}>
              <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                <label>
                  Nome do treino
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Ex.: Peito 2 — sexta"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>
                <label>
                  Foco do treino
                  <input
                    value={draft.focus}
                    onChange={(e) =>
                      setDraft({ ...draft, focus: e.target.value })
                    }
                    placeholder="Ex.: Peito e bíceps"
                    maxLength={120}
                  />
                </label>
                <label className="weekday-label">
                  <span>
                    <CalendarDays size={15} />
                    Dias da semana (opcional)
                  </span>
                </label>
                <div className="weekday-selector">
                  {days.map((day, i) => (
                    <button
                      type="button"
                      key={day}
                      aria-pressed={draft.weekdays.includes(i)}
                      className={draft.weekdays.includes(i) ? "selected" : ""}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          weekdays: draft.weekdays.includes(i)
                            ? draft.weekdays.filter((v) => v !== i)
                            : [...draft.weekdays, i].sort(),
                        })
                      }
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setPicker(-1)}>
                  Escolher na biblioteca
                </button>
                <div className="section-heading editor-exercises-heading">
                  <h2>Exercícios</h2>
                  <button
                    type="button"
                    className="text"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        exercises: [
                          ...draft.exercises,
                          { name: "", sets: 3, reps: "8–12", restSeconds: 60 },
                        ],
                      })
                    }
                  >
                    <Plus size={15} />
                    Adicionar exercício
                  </button>
                </div>
                {!draft.exercises.length && (
                  <p className="estimate-note">
                    Adicione pelo menos um exercício antes de salvar.
                  </p>
                )}
                {draft.exercises.map((ex, i) => (
                  <div className="editor-exercise" key={i}>
                    <div className="editor-exercise-top">
                      <span>Exercício {i + 1}</span>
                      <div>
                        <button
                          type="button"
                          aria-label={`Subir exercício ${i + 1}`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Descer exercício ${i + 1}`}
                          disabled={i === draft.exercises.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remover exercício ${i + 1}`}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              exercises: draft.exercises.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <button type="button" onClick={() => setPicker(i)}>
                      Vincular pela biblioteca
                    </button>
                    <label>
                      Nome do exercício
                      <input
                        value={ex.name}
                        onChange={(e) =>
                          changeExercise(i, {
                            name: e.target.value,
                            exerciseId: undefined,
                          })
                        }
                        minLength={2}
                        maxLength={120}
                        required
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Séries
                        <input
                          type="number"
                          value={ex.sets}
                          min="1"
                          max="20"
                          required
                          onChange={(e) =>
                            changeExercise(i, { sets: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Repetições
                        <input
                          value={ex.reps}
                          maxLength={30}
                          required
                          onChange={(e) =>
                            changeExercise(i, { reps: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Descanso (s)
                        <input
                          type="number"
                          value={ex.restSeconds ?? 60}
                          min="0"
                          max="600"
                          required
                          onChange={(e) =>
                            changeExercise(i, {
                              restSeconds: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
                <button
                  className="primary submit"
                  disabled={!draft.exercises.length}
                >
                  {saving ? 'Salvando treino…' : 'Salvar treino'} <Check size={16} />
                </button>
              </fieldset>
              {saveError && <p role="alert">{saveError}</p>}
            </form>
          )}
        </ModalDialog>
      )}
      {removeId && (
        <ModalDialog label="Excluir treino" onClose={() => { if (!savingRef.current) setRemoveId(''); }}>
          <h2>Excluir este modelo de treino?</h2>
          <p className="estimate-note">
            Os treinos concluídos e seu histórico continuarão salvos.
          </p>
          <div className="confirm-actions">
            <button className="text" disabled={saving} onClick={() => setRemoveId("")}>
              Cancelar
            </button>
            <button
              className="primary"
              disabled={saving}
              onClick={() => void confirmChange(() => onRemove(removeId), () => setRemoveId(''))}
            >
              {saving ? 'Salvando…' : 'Excluir modelo'}
            </button>
          </div>
          {saveError && <p role="alert">{saveError}</p>}
        </ModalDialog>
      )}
    </section>
  );
}
