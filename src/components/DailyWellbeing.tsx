import React from "react";
import { useRecords } from "../lib/useRecords";
import { uid } from "../lib/uid";
import { localDateKey, type Store } from "../lib/store";
import {
  scheduledHabit,
  habitStats,
  derivedHabitLogs,
  movingAverage,
  canShowCorrelations,
  type CheckIn,
  type Habit,
  type HabitLog,
} from "../lib/habits";
import { ModalDialog } from "./ModalDialog";
import { TrendChart } from "./TrendChart";
const fields = {
  sleep_quality: "Qualidade do sono",
  energy: "Energia",
  mood: "Humor",
  stress: "Estresse",
  soreness: "Desconforto muscular",
} as const;
export function DailyWellbeing({
  userId,
  store,
  history = false,
}: {
  userId: string;
  store: Store;
  history?: boolean;
}) {
  const checkins = useRecords<CheckIn>("daily_checkins", userId),
    habits = useRecords<Habit>("habits", userId, "created_at"),
    logs = useRecords<HabitLog>("habit_logs", userId);
  const today = localDateKey(),
    current = checkins.rows.find((r) => r.date === today),
    [draft, setDraft] = React.useState<Partial<CheckIn>>({}),
    [editingDate, setEditingDate] = React.useState(today),
    [habit, setHabit] = React.useState<Partial<Habit> | null>(null),
    [message, setMessage] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [chartKey, setChartKey] = React.useState<keyof typeof fields>("energy");
  const loaded = React.useRef("");
  React.useEffect(() => {
    if (!history) setEditingDate(today);
  }, [today, history]);
  React.useEffect(() => {
    const signature = `${editingDate}:${JSON.stringify(checkins.rows.find((r) => r.date === editingDate) || {})}`;
    if (!checkins.loading && loaded.current !== signature) {
      loaded.current = signature;
      setDraft(checkins.rows.find((r) => r.date === editingDate) || {});
    }
  }, [checkins.rows, checkins.loading, editingDate]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const saveCheckin = () =>
    run(async () => {
      await checkins.save(
        {
          date: editingDate,
          sleep_hours: draft.sleep_hours ?? null,
          sleep_quality: draft.sleep_quality ?? null,
          energy: draft.energy ?? null,
          mood: draft.mood ?? null,
          stress: draft.stress ?? null,
          soreness: draft.soreness ?? null,
          note: draft.note || "",
        },
        "user_id,date",
      );
      setMessage("Check-in salvo. Você pode ajustar ao longo do dia.");
    });
  async function saveHabit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      await habits.save({
        id: habit?.id || uid(),
        name: String(f.get("name")).trim(),
        icon: String(f.get("icon")),
        frequency: f.get("frequency") as Habit["frequency"],
        weekdays: f.getAll("weekday").map(Number),
        target: f.get("target") ? Number(f.get("target")) : null,
        source: f.get("source") as Habit["source"],
        archived: habit?.archived || false,
      });
      setHabit(null);
    });
  }
  return (
    <section className="feature-panel">
      <h2>{history ? "Check-ins e hábitos" : "Como você está hoje?"}</h2>
      {message && <p role="status">{message}</p>}
      {[checkins.error, habits.error, logs.error]
        .filter(Boolean)
        .map((e, i) => (
          <p key={i} role="alert">
            {e}
          </p>
        ))}
      {checkins.loading && <p role="status">Carregando check-ins…</p>}
      {history && (
        <>
          <label>
            Tendência de 7 dias
            <select
              value={chartKey}
              onChange={(e) =>
                setChartKey(e.target.value as keyof typeof fields)
              }
            >
              {Object.entries(fields).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <TrendChart
            points={movingAverage(checkins.rows, chartKey)}
            label={`${fields[chartKey]} · média móvel`}
          />
          <p className="sub">
            {canShowCorrelations(checkins.rows)
              ? "Há pelo menos 21 dias de registros. Tendências não demonstram causa."
              : "Ainda não há 21 dias de dados para explorar relações entre hábitos e bem-estar."}
          </p>
          <label>
            Editar check-in de outra data
            <input
              type="date"
              value={editingDate}
              max={today}
              onChange={(e) => setEditingDate(e.target.value || today)}
            />
          </label>
        </>
      )}
      {!history && !current && !checkins.loading && (
        <p role="status">
          Seu check-in de hoje está pendente. Registre apenas o que fizer
          sentido.
        </p>
      )}
      <label>
        Horas de sono
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={24}
          step="0.5"
          value={draft.sleep_hours ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              sleep_hours: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      </label>
      <div className="checkin-ratings">
        {Object.entries(fields).map(([key, label]) => (
          <fieldset key={key}>
            <legend>{label} (1 baixo — 5 alto)</legend>
            <div className="feature-tabs">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  disabled={busy || checkins.loading}
                  aria-label={`${label}: ${n}`}
                  aria-pressed={draft[key as keyof typeof fields] === n}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      [key]: draft[key as keyof typeof fields] === n ? null : n,
                    })
                  }
                >
                  <span aria-hidden="true">
                    {["😶", "🙂", "😊", "😃", "🌟"][n - 1]}
                  </span>{" "}
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <label>
        Nota (opcional)
        <textarea
          maxLength={1000}
          value={draft.note || ""}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </label>
      <button
        className="primary"
        disabled={busy || checkins.loading}
        onClick={() => void saveCheckin()}
      >
        Salvar check-in
      </button>
      <div className="section-heading">
        <h2>Seus hábitos</h2>
        <button
          onClick={() =>
            setHabit({
              frequency: "diário",
              weekdays: [],
              source: "manual",
              icon: "✓",
            })
          }
        >
          Criar hábito
        </button>
      </div>
      {habits.rows.length === 0 && !habits.loading && (
        <>
          <p>Escolha um hábito e adapte à sua rotina.</p>
          <div className="feature-tabs">
            {[
              "Alongar",
              "Tomar creatina",
              "Caminhar 10 minutos",
              "Dormir antes das 23h",
            ].map((name) => (
              <button
                key={name}
                onClick={() =>
                  setHabit({
                    name,
                    frequency: "diário",
                    weekdays: [],
                    source: "manual",
                    icon: "✓",
                  })
                }
              >
                {name}
              </button>
            ))}
          </div>
          <p className="sub">
            Sugestões editáveis. Suplementos requerem orientação individual; o
            app não recomenda doses.
          </p>
        </>
      )}
      {habits.rows
        .filter((h) => !h.archived)
        .map((h) => {
          const entries =
              h.source === "manual" ? logs.rows : derivedHabitLogs(h, store),
            stats = habitStats(h, entries, today),
            entry = entries.find(
              (l) => l.habit_id === h.id && l.date === today,
            );
          return (
            <article key={h.id} className="habit-card">
              <div className="session-tools-row">
                <strong>
                  {h.icon} {h.name}
                </strong>
                <button
                  disabled={
                    busy || h.source !== "manual" || !scheduledHabit(h, today)
                  }
                  aria-pressed={Boolean(entry?.done)}
                  onClick={() =>
                    void run(() =>
                      logs.save(
                        {
                          habit_id: h.id,
                          date: today,
                          done: !entry?.done,
                          value: !entry?.done ? h.target || 1 : 0,
                        },
                        "habit_id,user_id,date",
                      ),
                    )
                  }
                >
                  {h.source === "manual"
                    ? entry?.done
                      ? "Feito ✓"
                      : scheduledHabit(h, today)
                        ? "Marcar feito"
                        : "Fora dos dias programados"
                    : entry?.done
                      ? "Meta cumprida ✓"
                      : "Automático pelos registros"}
                </button>
                <button onClick={() => setHabit(h)}>Editar</button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(() => habits.save({ ...h, archived: true }))
                  }
                >
                  Arquivar
                </button>
              </div>
              <p>
                Sequência atual: {stats.current} · melhor: {stats.best} dias
                programados
              </p>
              {h.target && (
                <p>
                  Meta: {h.target} · registrado hoje: {entry?.value || 0}
                </p>
              )}
              {h.target && h.source === "manual" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = Number(
                      new FormData(event.currentTarget).get("value"),
                    );
                    void run(() =>
                      logs.save(
                        {
                          habit_id: h.id,
                          date: today,
                          value,
                          done: value >= h.target!,
                        },
                        "habit_id,user_id,date",
                      ),
                    );
                  }}
                >
                  <label>
                    Valor de {h.name}
                    <input
                      key={`${today}:${entry?.value}`}
                      name="value"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={1000000}
                      step="0.01"
                      defaultValue={entry?.value || 0}
                      required
                    />
                  </label>
                  <button disabled={busy}>Salvar valor</button>
                </form>
              )}
              {history && (
                <div
                  className="heatmap"
                  role="img"
                  aria-label={`${h.name}: ${stats.calendar.filter((d) => d.done).length} dias cumpridos nos últimos 90 dias`}
                >
                  {stats.calendar.map((d) => (
                    <span
                      key={d.date}
                      className={d.done ? "done" : ""}
                      title={`${d.date}: ${d.done ? "feito" : d.scheduled ? "pendente" : "não programado"}`}
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      {history &&
        habits.rows
          .filter((h) => h.archived)
          .map((h) => (
            <div key={h.id}>
              <span>{h.name} · arquivado</span>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => habits.save({ ...h, archived: false }))
                }
              >
                Reativar
              </button>
            </div>
          ))}
      {habit && (
        <ModalDialog label="Configurar hábito" onClose={() => setHabit(null)}>
          <h2>Seu hábito, sua rotina</h2>
          <form onSubmit={saveHabit}>
            <label>
              Nome
              <input
                name="name"
                minLength={2}
                maxLength={100}
                defaultValue={habit.name}
                required
              />
            </label>
            <label>
              Ícone
              <input
                name="icon"
                maxLength={20}
                defaultValue={habit.icon || "✓"}
              />
            </label>
            <label>
              Frequência
              <select
                name="frequency"
                defaultValue={habit.frequency}
                onChange={(e) =>
                  setHabit({
                    ...habit,
                    frequency: e.target.value as Habit["frequency"],
                  })
                }
              >
                <option>diário</option>
                <option>dias da semana</option>
              </select>
            </label>
            {habit.frequency === "dias da semana" && (
              <fieldset>
                <legend>Dias programados</legend>
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                  (d, i) => (
                    <label key={d} className="consent-check">
                      <input
                        name="weekday"
                        type="checkbox"
                        value={i}
                        defaultChecked={habit.weekdays?.includes(i)}
                      />
                      {d}
                    </label>
                  ),
                )}
              </fieldset>
            )}
            <label>
              Origem
              <select name="source" defaultValue={habit.source}>
                <option value="manual">Marcação manual</option>
                <option value="water">Água (automático, em ml)</option>
                <option value="workout">Treino (automático)</option>
              </select>
            </label>
            <label>
              Meta numérica (opcional)
              <input
                name="target"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={habit.target ?? ""}
              />
            </label>
            <button className="primary" disabled={busy}>
              Salvar hábito
            </button>
          </form>
          <button onClick={() => setHabit(null)}>Cancelar</button>
        </ModalDialog>
      )}
    </section>
  );
}
