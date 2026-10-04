import React from "react";
import {
  exercises,
  isCatalogExercise,
  muscleGroups,
  equipmentTypes,
  movementPatterns,
  type CatalogExercise,
  type Muscle,
  type Equipment,
  type Pattern,
} from "../data/exercises";
import { searchExercises } from "../lib/exerciseCatalog";
import { programs, importProgram, type Program } from "../data/programs";
import { useRecords } from "../lib/useRecords";
import { uid } from "../lib/uid";
import { ModalDialog } from "./ModalDialog";
import type { Workout } from "../lib/store";
type Custom = {
  id: string;
  user_id: string;
  created_at: string;
  data: CatalogExercise;
};
export function ExerciseExplorer({
  userId,
  onAdd,
  workouts,
  onImport,
  selector = false,
}: {
  userId: string;
  onAdd: (ex: CatalogExercise) => void;
  workouts: Workout[];
  onImport?: (workouts: Workout[]) => void;
  selector?: boolean;
}) {
  const custom = useRecords<Custom>("custom_exercises", userId, "created_at");
  const [tab, setTab] = React.useState("Biblioteca"),
    [query, setQuery] = React.useState(""),
    [muscle, setMuscle] = React.useState(""),
    [gear, setGear] = React.useState(""),
    [pattern, setPattern] = React.useState(""),
    [detail, setDetail] = React.useState<CatalogExercise | null>(null),
    [program, setProgram] = React.useState<Program | null>(null),
    [weekdays, setWeekdays] = React.useState<number[][]>([]),
    [level, setLevel] = React.useState(""),
    [days, setDays] = React.useState(""),
    [create, setCreate] = React.useState(false),
    [message, setMessage] = React.useState(""),
    [busy, setBusy] = React.useState(false);
  const catalog = [
    ...exercises,
    ...custom.rows.map((row) => row.data).filter(isCatalogExercise),
  ];
  const matches = searchExercises(catalog, query, {
    muscle: (muscle as Muscle) || undefined,
    equipment: (gear as Equipment) || undefined,
    pattern: (pattern as Pattern) || undefined,
  });
  const preview = program ? importProgram(program, workouts, weekdays) : null;
  async function createCustom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget),
      id = uid();
    const entry: CatalogExercise = {
      id: `custom-${id}`,
      name: String(f.get("name")).trim(),
      aliases: String(f.get("aliases"))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      primaryMuscle: f.get("muscle") as Muscle,
      muscleGroup: f.get("muscle") as Muscle,
      secondaryMuscles: f.getAll("secondary") as Muscle[],
      movementPattern: f.get("pattern") as Pattern,
      equipment: f.get("gear") as Equipment,
      difficulty: f.get("difficulty") as CatalogExercise["difficulty"],
      instructions: String(f.get("instructions"))
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      tips: String(f.get("tips")).split("\n").filter(Boolean),
      commonMistakes: String(f.get("mistakes")).split("\n").filter(Boolean),
    };
    if (entry.instructions.length < 3 || entry.instructions.length > 5) {
      setMessage("Informe de 3 a 5 passos, um por linha.");
      setBusy(false);
      return;
    }
    try {
      await custom.save({ id, data: entry });
      setCreate(false);
      onAdd(entry);
      setMessage("Exercício personalizado salvo.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-panel">
      <div className="section-heading">
        <h2>{selector ? "Escolher exercício" : "Biblioteca e programas"}</h2>
        <button type="button" onClick={() => setCreate(true)}>
          Criar personalizado
        </button>
      </div>
      {!selector && (
        <div className="feature-tabs">
          {["Biblioteca", "Programas"].map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {custom.error && (
        <p role="alert">
          {custom.error}
          <button onClick={() => void custom.reload()}>Tentar novamente</button>
        </p>
      )}
      {tab === "Biblioteca" ? (
        <>
          <div className="feature-filters">
            <label>
              Buscar exercício
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome ou apelido"
              />
            </label>
            {[
              [muscle, setMuscle, muscleGroups, "Grupo muscular"],
              [gear, setGear, equipmentTypes, "Equipamento"],
              [pattern, setPattern, movementPatterns, "Movimento"],
            ].map(([value, change, values, label]) => (
              <label key={String(label)}>
                {String(label)}
                <select
                  value={value as string}
                  onChange={(e) =>
                    (change as (s: string) => void)(e.target.value)
                  }
                >
                  <option value="">Todos</option>
                  {(values as readonly string[]).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="sub">
            {matches.length} exercícios · instruções informativas; peça
            orientação presencial.
          </p>
          <div className="catalog-list">
            {matches.map((ex) => (
              <article key={ex.id}>
                <button
                  type="button"
                  className="catalog-detail"
                  onClick={() => setDetail(ex)}
                >
                  <strong>{ex.name}</strong>
                  <small>
                    {ex.muscleGroup} · {ex.equipment}
                  </small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(ex);
                    setMessage(`${ex.name} adicionado ao treino.`);
                  }}
                >
                  Adicionar ao treino
                </button>
              </article>
            ))}
          </div>
          {!matches.length && (
            <p>
              Nenhum exercício com esses filtros. Ajuste a busca ou crie um
              personalizado.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="feature-filters">
            <label>
              Nível
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">Todos</option>
                <option>iniciante</option>
                <option>intermediário</option>
              </select>
            </label>
            <label>
              Dias por semana
              <select value={days} onChange={(e) => setDays(e.target.value)}>
                <option value="">Todos</option>
                {[3, 4, 5, 6].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="feature-grid">
            {programs
              .filter(
                (p) =>
                  (!level || p.level === level) &&
                  (!days || p.days === Number(days)),
              )
              .map((p) => (
                <article key={p.id}>
                  <h3>{p.name}</h3>
                  <p>
                    {p.level} · {p.days} dias · {p.durationWeeks} semanas
                  </p>
                  <p>{p.goal}</p>
                  <small>{p.requiredEquipment.join(", ")}</small>
                  <button
                    onClick={() => {
                      setProgram(p);
                      setWeekdays(p.workouts.map(() => []));
                    }}
                  >
                    Pré-visualizar programa
                  </button>
                </article>
              ))}
          </div>
        </>
      )}
      {detail && (
        <ModalDialog label={detail.name} onClose={() => setDetail(null)}>
          <h2>{detail.name}</h2>
          <p>
            {detail.primaryMuscle} · secundários:{" "}
            {detail.secondaryMuscles.join(", ") || "—"} · {detail.difficulty}
          </p>
          <ol>
            {detail.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <h3>Dicas</h3>
          {detail.tips.map((s) => (
            <p key={s}>{s}</p>
          ))}
          <h3>Erros comuns</h3>
          {detail.commonMistakes.map((s) => (
            <p key={s}>{s}</p>
          ))}
          <button
            className="primary"
            onClick={() => {
              onAdd(detail);
              setDetail(null);
            }}
          >
            Adicionar ao treino
          </button>
          <button onClick={() => setDetail(null)}>Fechar</button>
        </ModalDialog>
      )}
      {program && preview && (
        <ModalDialog label="Importar programa" onClose={() => setProgram(null)}>
          <h2>{program.name}</h2>
          <p>
            Os treinos existentes serão preservados. Você poderá editar cada
            modelo depois.
          </p>
          {program.workouts.map((w, i) => (
            <article key={i}>
              <h3>{preview.workouts[workouts.length + i].name}</h3>
              <p>
                {w.exercises
                  .map(
                    (ex) =>
                      `${ex.name}: ${ex.sets} × ${ex.reps} · ${ex.restSeconds}s`,
                  )
                  .join(" / ")}
              </p>
              <div className="weekday-selector">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                  (d, n) => (
                    <button
                      key={d}
                      aria-label={`${w.name}: ${d}`}
                      aria-pressed={weekdays[i]?.includes(n)}
                      onClick={() =>
                        setWeekdays(
                          weekdays.map((v, j) =>
                            j === i
                              ? v.includes(n)
                                ? v.filter((k) => k !== n)
                                : [...v, n]
                              : v,
                          ),
                        )
                      }
                    >
                      {d}
                    </button>
                  ),
                )}
              </div>
            </article>
          ))}
          {preview.renamed.length > 0 && (
            <p role="status">
              Nomes já existentes serão renomeados: {preview.renamed.join("; ")}
            </p>
          )}
          <button
            className="primary"
            onClick={() => {
              onImport?.(preview.workouts);
              setProgram(null);
              setMessage(
                "Programa importado. Seus treinos anteriores foram mantidos.",
              );
            }}
          >
            Confirmar importação
          </button>
          <button onClick={() => setProgram(null)}>Cancelar</button>
        </ModalDialog>
      )}
      {create && (
        <ModalDialog
          label="Criar exercício personalizado"
          onClose={() => setCreate(false)}
        >
          <h2>Exercício personalizado</h2>
          <form onSubmit={createCustom}>
            <label>
              Nome
              <input name="name" required minLength={2} maxLength={120} />
            </label>
            <label>
              Apelidos (separados por vírgula)
              <input name="aliases" maxLength={300} />
            </label>
            <label>
              Grupo muscular
              <select name="muscle">
                {muscleGroups.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Músculos secundários
              <select name="secondary" multiple>
                {muscleGroups.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Movimento
              <select name="pattern">
                {movementPatterns.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Equipamento
              <select name="gear">
                {equipmentTypes.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Dificuldade
              <select name="difficulty">
                <option>iniciante</option>
                <option>intermediário</option>
                <option>avançado</option>
              </select>
            </label>
            <label>
              Instruções (3 a 5 linhas)
              <textarea name="instructions" required maxLength={1500} />
            </label>
            <label>
              Dicas
              <textarea name="tips" maxLength={1000} />
            </label>
            <label>
              Erros comuns
              <textarea name="mistakes" maxLength={1000} />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar e adicionar"}
            </button>
          </form>
          <button onClick={() => setCreate(false)}>Cancelar</button>
        </ModalDialog>
      )}
    </section>
  );
}
