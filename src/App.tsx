import React from "react";
import {
  House,
  Dumbbell,
  Utensils,
  TrendingUp,
  Settings,
  Bell,
  ChevronRight,
  ArrowRight,
  Plus,
  Droplets,
  Flame,
  Activity,
  Bike,
  Scale,
  Clock,
  Leaf,
  Target,
  Check,
  X,
  Download,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useCloudStore } from "./lib/useCloudStore";
import {
  createInitialStore,
  normalizeStore,
  addWater,
  addCardio,
  startWorkout,
  addWeight,
  localDateKey,
  currentWorkout,
  scheduledWorkout,
  saveProfile,
  saveWorkout,
  removeWorkout,
  appendExercise,
  type Store,
} from "./lib/store";
import { WorkoutTimer } from "./components/WorkoutTimer";
import { useWorkoutClock } from "./lib/useWorkoutClock";
import { WeightCheckIn } from "./components/WeightProgress";
import { MealAnalyzer } from "./components/MealAnalyzer";
import { AIConsentSettings } from "./components/AIConsentSettings";
import { StepsPanel } from "./components/StepsPanel";
import { exportBackup } from "./lib/exportBackup";
import { ProfilePanel } from "./components/ProfilePanel";
import { ModalDialog } from "./components/ModalDialog";
import { AccountData } from "./components/AccountData";
import { FeatureSkeleton } from "./components/FeatureSkeleton";
const ProgressPage = React.lazy(() => import("./pages/ProgressPage"));
const TrainingPage = React.lazy(() => import("./pages/TrainingPage"));
const DailyWellbeing = React.lazy(() =>
  import("./components/DailyWellbeing").then((m) => ({
    default: m.DailyWellbeing,
  })),
);
import { ThemeToggle } from "./theme/ThemeControls";
const defaults = createInitialStore();
export default function App({
  user,
  signOut,
}: {
  user: User;
  signOut: () => Promise<void>;
}) {
  const {
    data: d,
    update,
    loading,
    error: syncError,
    status,
    ready,
    retry,
    flush,
    updateAndFlush,
  } = useCloudStore<Store>(user.id, defaults, normalizeStore);
  const [signingOut, setSigningOut] = React.useState(false);
  const fullName =
    d.profile.fullName || String(user.user_metadata.full_name || "Meu perfil");
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  async function logout() {
    setSigningOut(true);
    try {
      if (ready) await flush();
      await signOut();
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "Não foi possível sair. Tente novamente.",
      );
      setSigningOut(false);
    }
  }

  const [page, setPage] = React.useState("Hoje"),
    [modal, setModal] = React.useState(""),
    [notice, setNotice] = React.useState("");
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (ready) headingRef.current?.focus();
  }, [page, ready]);
  const training = Boolean(d.activeWorkout);

  const { elapsed } = useWorkoutClock(d.activeWorkout);
  const date = d.day;
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const selectedWorkout = currentWorkout(d);
  const workout = d.activeWorkout
    ? {
        ...selectedWorkout,
        name: d.activeWorkout.name || selectedWorkout.name,
        focus: d.activeWorkout.focus ?? selectedWorkout.focus,
        exercises: d.activeWorkout.exercises || selectedWorkout.exercises,
      }
    : selectedWorkout;
  const homeWorkout = d.activeWorkout ? workout : scheduledWorkout(d);
  const beginWorkout = (id = d.selectedWorkoutId) => {
    if (!training)
      update({
        selectedWorkoutId: id,
        ...startWorkout({ ...d, selectedWorkoutId: id }),
      });
    setPage("Treinos");
  };

  React.useEffect(() => {
    if (!d.activeWorkout) return;
    document.title = `Vitra · Treino ${Math.floor(elapsed / 60)} min`;
    return () => {
      document.title = "Vitra · Meu dia";
    };
  }, [training, Math.floor(elapsed / 60)]);
  const rollover = () => {
    if (!ready) return;
    const normalized = normalizeStore(d);
    if (normalized.day !== d.day || normalized.week !== d.week)
      update(normalized);
  };
  React.useEffect(() => {
    if (!ready) return;
    const id = setInterval(rollover, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") rollover();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [d, ready]);
  const cal = d.meals.reduce((s, m) => s + m.calories, 0);
  const percent = (v: number, g: number) =>
    Math.min(100, Math.round((v / g) * 100));
  const nav = [
    { name: "Hoje", icon: House },
    { name: "Treinos", icon: Dumbbell },
    { name: "Alimentação", icon: Utensils },
    { name: "Evolução", icon: TrendingUp },
  ];
  const exportData = async () => {
    try {
      await flush();
      await exportBackup(user.id, d);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Falha ao exportar os dados.",
      );
    }
  };
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k));
    if (modal === "refeição")
      update({
        meals: [
          ...d.meals,
          {
            name: String(f.get("name")),
            calories: n("calories"),
            protein: n("protein"),
            carbs: n("carbs"),
            fat: n("fat"),
          },
        ],
      });
    if (modal === "cardio")
      update(
        addCardio(
          d,
          String(f.get("activity")),
          n("minutes"),
          new Date(),
          n("distance"),
        ),
      );
    if (modal === "peso")
      update(
        addWeight(
          d,
          n("weight"),
          String(f.get("date")).split("-").reverse().join("/"),
          String(f.get("note") || ""),
        ),
      );
    if (modal === "metas")
      update({
        waterGoal: n("water"),
        calorieGoal: n("calories"),
        cardioGoalKm: n("cardio"),
        profile: { ...d.profile, calorieMode: "manual" },
      });
    if (modal === "exercício")
      update(
        appendExercise(d, {
          name: String(f.get("name")),
          sets: n("sets"),
          reps: String(f.get("reps")),
          restSeconds: 60,
        }),
      );
    setModal("");
  }
  const meals = (
    <>
      {d.meals.length ? (
        d.meals.map((m, i) => (
          <div className="meal-row" key={i}>
            <span className="tile orange">
              <Utensils size={18} />
            </span>
            <div>
              <strong>{m.name}</strong>
              <small>
                P {m.protein}g · C {m.carbs}g · G {m.fat}g
              </small>
            </div>
            <b>
              {m.calories}{" "}
              <small>kcal{m.estimated ? " · estimativa" : ""}</small>
            </b>
            <button
              aria-label="Excluir refeição"
              onClick={() =>
                update({ meals: d.meals.filter((_, j) => j !== i) })
              }
            >
              <X size={14} />
            </button>
          </div>
        ))
      ) : (
        <div className="empty">
          <span className="empty-icon">
            <Utensils size={24} />
          </span>
          <strong>Seu dia começa com uma boa refeição</strong>
          <p>Registre o que você come e acompanhe sua meta.</p>
          <button className="text" onClick={() => setModal("refeição")}>
            <Plus size={15} />
            Adicionar primeira refeição
          </button>
        </div>
      )}
    </>
  );
  if (loading || signingOut)
    return (
      <div className="auth-loading" role="status">
        <span className="spinner" />
        {signingOut ? "Salvando e saindo…" : "Carregando seus registros…"}
      </div>
    );
  if (!ready)
    return (
      <div className="auth-loading">
        <p role="alert">{syncError}</p>
        <button className="primary" onClick={retry}>
          Tentar novamente
        </button>
        <button className="text" onClick={logout}>
          Sair da conta
        </button>
      </div>
    );
  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <aside>
        <a href="#" className="brand" onClick={() => setPage("Hoje")}>
          <span className="brand-symbol">
            v<i>•</i>
          </span>
          vitra<span>.</span>
        </a>
        <div className="workspace">SEU ESPAÇO DE BEM-ESTAR</div>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "nav active" : "nav"}
              onClick={() => setPage(name)}
            >
              <Icon size={20} />
              <span>{name}</span>
              {page === name && <i />}
            </button>
          ))}
        </nav>
        <div className="aside-bottom">
          <div className="tip">
            <Leaf size={23} />
            <strong>Um pouco, todos os dias.</strong>
            <p>
              Pequenos hábitos constroem
              <br />
              grandes mudanças.
            </p>
            <span>
              Você está no caminho certo <ArrowRight size={13} />
            </span>
          </div>
          <button className="nav settings" onClick={() => setModal("metas")}>
            <Settings size={18} />
            <span>Metas e configurações</span>
          </button>
          <div className="profile">
            <button
              className="avatar profile-avatar"
              aria-label="Abrir meu perfil"
              onClick={() => setPage("Perfil")}
            >
              {initials}
            </button>
            <button className="profile-name" onClick={() => setPage("Perfil")}>
              <strong>{fullName}</strong>
              <small>{user.email}</small>
            </button>
            <button className="text" onClick={logout}>
              Sair
            </button>
          </div>
        </div>
      </aside>
      <div className="content">
        <header>
          <div className="crumb">
            Meu espaço <ChevronRight size={13} />
            <span>{page === "Hoje" ? "Meu dia" : page}</span>
          </div>
          <div className="header-right">
            <ThemeToggle />
            <i className="dot" />
            <span role="status">{status}</span>
            <button aria-label="Notificações" onClick={() => setNotice(status)}>
              <Bell size={20} />
            </button>
            <button
              className="avatar profile-avatar"
              aria-label="Abrir meu perfil"
              onClick={() => setPage("Perfil")}
            >
              {initials}
            </button>
          </div>
        </header>
        {syncError && (
          <div className="sync-error" role="alert">
            <span>{syncError}</span>
            <button onClick={retry}>Tentar salvar novamente</button>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          <div className="heading">
            <div>
              <div className="eyebrow">UM NOVO DIA, UMA NOVA OPORTUNIDADE</div>
              <h1 ref={headingRef} tabIndex={-1}>
                {page === "Hoje"
                  ? "Vamos cuidar de você."
                  : page === "Treinos"
                    ? "Seu próximo passo começa aqui."
                    : page === "Alimentação"
                      ? "Nutra sua melhor versão."
                      : page === "Perfil"
                        ? "Seu perfil, seu ritmo."
                        : "Cada passo conta."}
                {page === "Hoje" && <span className="sun">☀</span>}
              </h1>
              <p>
                Seu treino, sua alimentação e sua evolução. Um dia de cada vez.
              </p>
            </div>
            <div className="date">
              <span>
                {new Date().toLocaleDateString("pt-BR", { weekday: "long" })}
              </span>
              <strong>
                {new Date().toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "long",
                })}
              </strong>
            </div>
          </div>
          {d.activeWorkout && (
            <WorkoutTimer
              active={d.activeWorkout}
              elapsed={elapsed}
              onChange={(activeWorkout) => update({ activeWorkout })}
            />
          )}
          {page === "Hoje" && (
            <>
              <React.Suspense fallback={<FeatureSkeleton />}>
                <DailyWellbeing userId={user.id} store={d} />
              </React.Suspense>
              <WeightCheckIn store={d} onRegister={() => setModal("peso")} />
              <div className="section-heading">
                <h2>
                  Meu dia <span className="tag">HOJE</span>
                </h2>
                <button className="text" onClick={() => setModal("metas")}>
                  Ajustar metas <Settings size={14} />
                </button>
              </div>
              <div className="stats">
                {[
                  {
                    name: "Água",
                    icon: Droplets,
                    color: "blue",
                    value: d.water / 1000,
                    goal: d.waterGoal / 1000,
                    unit: "L",
                    progress: percent(d.water, d.waterGoal),
                    caption: `${percent(d.water, d.waterGoal)}% da meta`,
                  },
                  {
                    name: "Alimentação",
                    icon: Flame,
                    color: "orange",
                    value: cal,
                    goal: d.calorieGoal,
                    unit: "kcal",
                    progress: percent(cal, d.calorieGoal),
                    caption: `${Math.max(0, d.calorieGoal - cal)} kcal restantes`,
                  },
                  {
                    name: "Cardio",
                    icon: Activity,
                    color: "purple",
                    value: d.cardioKm,
                    goal: d.cardioGoalKm,
                    unit: "km",
                    progress: percent(d.cardioKm, d.cardioGoalKm),
                    caption: `${Math.max(0, d.cardioGoalKm - d.cardioKm).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km para sua meta`,
                  },
                ].map(
                  ({
                    name,
                    icon: Icon,
                    color,
                    value,
                    goal,
                    unit,
                    progress,
                    caption,
                  }) => (
                    <section className="stat" key={name}>
                      <div className="stat-top">
                        <span className={`tile ${color}`}>
                          <Icon size={20} />
                        </span>
                        <strong>{name}</strong>
                        <small>
                          {name === "Cardio" ? "Nesta semana" : "Meta diária"}
                        </small>
                      </div>
                      <div className="metric">
                        {value.toLocaleString("pt-BR")}{" "}
                        <small>
                          / {goal.toLocaleString("pt-BR")} {unit}
                        </small>
                      </div>
                      <div className={`progress ${color}`}>
                        <i style={{ width: `${progress}%` }} />
                      </div>
                      <div className="stat-foot">
                        <span>{caption}</span>
                        {name === "Água" ? (
                          <button onClick={() => update(addWater(d, 250))}>
                            <Plus size={12} />
                            250 ml
                          </button>
                        ) : (
                          <Icon size={14} />
                        )}
                      </div>
                    </section>
                  ),
                )}
              </div>
              <div className="two-col">
                <section className="workout">
                  <div className="workout-art">
                    <div className="workout-label">
                      <i />
                      SEU TREINO DE HOJE
                    </div>
                    <div className="dumbbell-art">
                      <div className="bar" />
                      {[0, 1, 2, 3].map((i) => (
                        <div className={`plate p${i}`} key={i} />
                      ))}
                    </div>
                    <div className="letter">A</div>
                    <div className="workout-title">
                      <span>FORÇA & CONSTÂNCIA</span>
                      <h2>{homeWorkout.name}</h2>
                      <p>{homeWorkout.focus || "Treino personalizado"}</p>
                    </div>
                  </div>
                  <div className="workout-bottom">
                    <div className="workout-meta">
                      <span>
                        <Dumbbell size={15} />
                        {homeWorkout.exercises.length} exercícios
                      </span>
                      <span>
                        <Clock size={15} />~ 45 min
                      </span>
                      <span>
                        <Activity size={15} />
                        Intermediário
                      </span>
                    </div>
                    <button
                      className="primary"
                      onClick={() => beginWorkout(homeWorkout.id)}
                    >
                      {training ? "Continuar treino" : "Começar treino"}{" "}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </section>
                <section className="panel quick">
                  <h2>Pequenas ações, grandes mudanças</h2>
                  <p>O que você quer registrar agora?</p>
                  <div className="quick-grid">
                    {[
                      {
                        name: "Refeição",
                        desc: "Alimente seu dia",
                        icon: Utensils,
                        color: "orange",
                      },
                      {
                        name: "Água",
                        desc: "Hidrate-se",
                        icon: Droplets,
                        color: "blue",
                      },
                      {
                        name: "Cardio",
                        desc: "Movimente-se",
                        icon: Bike,
                        color: "purple",
                      },
                      {
                        name: "Peso",
                        desc: "Acompanhe você",
                        icon: Scale,
                        color: "green",
                      },
                    ].map(({ name, desc, icon: Icon, color }) => (
                      <button
                        key={name}
                        onClick={() => setModal(name.toLowerCase())}
                      >
                        <span className={`tile ${color}`}>
                          <Icon size={21} />
                        </span>
                        <strong>{name}</strong>
                        <small>{desc}</small>
                        <Plus size={15} />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <div className="two-col lower">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Sua semana, no seu ritmo</h2>
                    <span className="pill">
                      <i className="dot" />
                      Em construção
                    </span>
                  </div>
                  <p className="sub">
                    Cada dia é uma chance de fazer algo por você.
                  </p>
                  <div className="week">
                    {["S", "T", "Q", "Q", "S", "S", "D"].map((name, i) => {
                      const dt = new Date(monday);
                      dt.setDate(dt.getDate() + i);
                      const isToday = dt.toLocaleDateString("pt-BR") === date;
                      const done = d.sessions.includes(
                        dt.toLocaleDateString("pt-BR"),
                      );
                      return (
                        <div
                          key={i}
                          className={isToday ? "day current" : "day"}
                        >
                          <span>{name}</span>
                          <div>
                            {done ? (
                              <Check size={17} />
                            ) : isToday ? (
                              <Dumbbell size={17} />
                            ) : (
                              <i />
                            )}
                          </div>
                          <small>
                            {isToday ? "Hoje" : done ? "Feito" : "—"}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  <div className="week-note">
                    <span className="tile blue">
                      <Target size={18} />
                    </span>
                    <p>
                      O mais importante é continuar.
                      <br />
                      <strong>Seu próximo treino já é uma conquista.</strong>
                    </p>
                  </div>
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Alimentação de hoje</h2>
                    <button
                      className="text"
                      onClick={() => setPage("Alimentação")}
                    >
                      Ver tudo <ArrowRight size={14} />
                    </button>
                  </div>
                  {meals}
                  <div className="macros">
                    {(["protein", "carbs", "fat"] as const).map((key, i) => (
                      <div key={key}>
                        <span>
                          <i className={["blue", "orange", "purple"][i]} />
                          {["Proteínas", "Carboidratos", "Gorduras"][i]}
                        </span>
                        <strong>
                          {d.meals.reduce((s, m) => s + m[key], 0)}{" "}
                          <small>g</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <StepsPanel userId={user.id} />
            </>
          )}
          {page === "Treinos" && (
            <React.Suspense fallback={<FeatureSkeleton />}>
              <TrainingPage
                store={d}
                userId={user.id}
                onChange={update}
                onBegin={() => beginWorkout()}
                onAdd={() => setModal("exercício")}
                onNotice={setNotice}
                onSave={(w) => update(saveWorkout(d, w))}
                onRemove={(id) => update(removeWorkout(d, id))}
              />
            </React.Suspense>
          )}
          {page === "Alimentação" && (
            <>
              <MealAnalyzer
                consent={d.preferences.ai_consent}
                age={d.profile.age}
                onConsentChange={(value) =>
                  updateAndFlush({
                    preferences: { ...d.preferences, ai_consent: value },
                  })
                }
                beforeAnalyze={flush}
                onSave={(meal) => update({ meals: [...d.meals, meal] })}
              />
              <section className="panel">
                <div className="section-heading">
                  <h2>
                    {cal.toLocaleString("pt-BR")} /{" "}
                    {d.calorieGoal.toLocaleString("pt-BR")} kcal hoje
                  </h2>
                  <button
                    className="primary"
                    onClick={() => setModal("refeição")}
                  >
                    Adicionar refeição <Plus size={16} />
                  </button>
                </div>
                <div className="progress orange food-progress">
                  <i style={{ width: `${percent(cal, d.calorieGoal)}%` }} />
                </div>
                {meals}
              </section>
            </>
          )}
          {page === "Evolução" && (
            <React.Suspense fallback={<FeatureSkeleton />}>
              <ProgressPage
                store={d}
                userId={user.id}
                status={status}
                onRegister={() => setModal("peso")}
                onExport={exportData}
                onChange={update}
                beforeAsk={flush}
                onConsent={(kind, value) =>
                  updateAndFlush({
                    preferences: { ...d.preferences, [kind]: value },
                  })
                }
                onSave={(w) => update(saveWorkout(d, w))}
              />
            </React.Suspense>
          )}
          {page === "Perfil" && (
            <>
              <AccountData
                onExport={exportData}
                beforeDelete={flush}
                onDeleted={signOut}
              />
              <ProfilePanel
                store={d}
                fallbackName={String(user.user_metadata.full_name || "")}
                email={user.email}
                onSave={(profile, weight) =>
                  update(saveProfile(d, profile, weight))
                }
              />
              <section className="panel">
                <AIConsentSettings
                  consent={d.preferences.ai_consent}
                  age={d.profile.age}
                  onChange={(value) =>
                    updateAndFlush({
                      preferences: { ...d.preferences, ai_consent: value },
                    })
                  }
                />
              </section>
            </>
          )}
          <footer>
            <strong>vitra.</strong>
            <span>Feito para o seu ritmo.</span>
            <span>
              <i className="dot" />
              Um dia de cada vez.
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {nav.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={page === name ? "active" : ""}
            onClick={() => setPage(name)}
          >
            <Icon size={21} />
            {name}
          </button>
        ))}
      </nav>
      {notice && (
        <button className="toast" onClick={() => setNotice("")}>
          <Check size={18} />
          {notice}
          <X size={16} />
        </button>
      )}
      {modal && (
        <ModalDialog
          label={modal === "metas" ? "Suas metas" : `Registrar ${modal}`}
          onClose={() => setModal("")}
        >
          <div className="section-heading">
            <h2>
              {modal === "metas"
                ? "Suas metas, seu ritmo"
                : `Registrar ${modal}`}
            </h2>
            <button aria-label="Fechar" onClick={() => setModal("")}>
              <X size={20} />
            </button>
          </div>
          {modal === "água" ? (
            <>
              <p>Quanto de água você bebeu?</p>
              <div className="water-options">
                {[250, 500, 750].map((v) => (
                  <button
                    className="primary"
                    key={v}
                    onClick={() => {
                      update(addWater(d, v));
                      setModal("");
                    }}
                  >
                    <Droplets size={17} />
                    {v} ml
                  </button>
                ))}
              </div>
              <button
                className="text"
                onClick={() => update(addWater(d, -250))}
              >
                Desfazer 250 ml
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              {modal === "refeição" && (
                <>
                  <label>
                    Nome da refeição
                    <input
                      name="name"
                      placeholder="Ex.: Café da manhã"
                      required
                    />
                  </label>
                  <label>
                    Calorias (kcal)
                    <input name="calories" type="number" min="0" required />
                  </label>
                  <div className="form-grid">
                    {["protein", "carbs", "fat"].map((k, i) => (
                      <label key={k}>
                        {["Proteínas", "Carboidratos", "Gorduras"][i]} (g)
                        <input
                          name={k}
                          type="number"
                          min="0"
                          defaultValue="0"
                        />
                      </label>
                    ))}
                  </div>
                </>
              )}
              {modal === "cardio" && (
                <>
                  <label>
                    Atividade
                    <select name="activity">
                      <option>Caminhada</option>
                      <option>Corrida</option>
                      <option>Bicicleta</option>
                      <option>Outra atividade</option>
                    </select>
                  </label>
                  <label>
                    Distância (km)
                    <input
                      name="distance"
                      type="number"
                      min="0.01"
                      max="1000"
                      step="0.01"
                      placeholder="Ex.: 3,5"
                      required
                    />
                  </label>
                  <label>
                    Duração (minutos, opcional)
                    <input
                      name="minutes"
                      type="number"
                      min="0"
                      max="1440"
                      placeholder="Ex.: 30"
                    />
                  </label>
                </>
              )}
              {modal === "peso" && (
                <>
                  <p className="estimate-note">
                    Registre a cada 3 dias, de preferência em condições
                    semelhantes. O treino e o cardio do dia serão vinculados ao
                    registro.
                  </p>
                  <label>
                    Dia do registro
                    <input
                      name="date"
                      type="date"
                      max={localDateKey()}
                      defaultValue={localDateKey()}
                      required
                    />
                  </label>
                  <label>
                    Peso (kg)
                    <input
                      name="weight"
                      type="number"
                      min="1"
                      max="500"
                      step="0.1"
                      required
                    />
                  </label>
                  <label>
                    Observações (opcional)
                    <textarea
                      name="note"
                      rows={2}
                      maxLength={500}
                      placeholder="Ex.: pela manhã, antes do café"
                    />
                  </label>
                </>
              )}
              {modal === "metas" && (
                <>
                  <label>
                    Água por dia (ml)
                    <input
                      name="water"
                      type="number"
                      min="1"
                      defaultValue={d.waterGoal}
                      required
                    />
                  </label>
                  <label>
                    Calorias por dia (kcal)
                    <input
                      name="calories"
                      type="number"
                      min="1"
                      defaultValue={d.calorieGoal}
                      required
                    />
                  </label>
                  <label>
                    Cardio por semana (km)
                    <input
                      name="cardio"
                      type="number"
                      min="0.1"
                      step="0.1"
                      defaultValue={d.cardioGoalKm}
                      required
                    />
                  </label>
                  <button type="button" className="text" onClick={exportData}>
                    <Download size={15} />
                    Exportar backup
                  </button>
                  <div className="account-settings">
                    <button
                      type="button"
                      className="text"
                      onClick={() => {
                        setModal("");
                        setPage("Perfil");
                      }}
                    >
                      Editar meu perfil
                    </button>
                    <strong>{fullName}</strong>
                    <small>{user.email}</small>
                    <button type="button" className="text" onClick={logout}>
                      Sair da conta
                    </button>
                  </div>
                </>
              )}
              {modal === "exercício" && (
                <>
                  <label>
                    Nome do exercício
                    <input name="name" required />
                  </label>
                  <label>
                    Séries
                    <input
                      name="sets"
                      type="number"
                      min="1"
                      max="20"
                      defaultValue="3"
                      required
                    />
                  </label>
                  <label>
                    Repetições
                    <input name="reps" defaultValue="8–12" required />
                  </label>
                </>
              )}
              <button className="primary submit">
                Salvar registro <Check size={17} />
              </button>
            </form>
          )}
        </ModalDialog>
      )}
    </div>
  );
}
