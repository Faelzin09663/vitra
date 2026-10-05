import React from "react";
import { UserRound, Scale, Flame, Ruler, Check } from "lucide-react";
import {
  activityLevels,
  calorieInputsNeeded,
  nutritionEstimates,
  type PersonalProfile,
} from "../lib/nutrition";
import type { Store } from "../lib/store";
import { ThemeSettings } from "../theme/ThemeControls";
export function ProfilePanel({
  store,
  fallbackName,
  email,
  onSave,
}: {
  store: Store;
  fallbackName: string;
  email?: string;
  onSave: (profile: PersonalProfile, weight: number | null) => void;
}) {
  const [draft, setDraft] = React.useState<PersonalProfile>({
    ...store.profile,
    fullName: store.profile.fullName || fallbackName,
  });
  const [weight, setWeight] = React.useState(
    store.weights.at(-1)?.value?.toString() || "",
  );
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");
  const latestWeight = store.weights.at(-1)?.value;
  React.useEffect(() => {
    setWeight(latestWeight?.toString() || "");
  }, [latestWeight]);
  const estimates = nutritionEstimates(draft, weight ? Number(weight) : null);
  const needed = calorieInputsNeeded(draft, weight ? Number(weight) : null);
  const change = (patch: Partial<PersonalProfile>) => {
    setDraft((p) => ({ ...p, ...patch }));
    setSaved(false);
    setError("");
  };
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (draft.fullName.trim().length < 2) {
      setError("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    if (draft.calorieMode === "automatic" && !estimates.daily) {
      setError(`Preencha ou corrija: ${needed.join("; ")}.`);
      return;
    }
    onSave(
      { ...draft, fullName: draft.fullName.trim() },
      weight ? Number(weight) : null,
    );
    setSaved(true);
  }
  return (
    <div className="profile-layout">
      <section className="panel profile-editor">
        <div className="section-heading">
          <h2>
            <UserRound size={20} />
            Meu perfil
          </h2>
          <span className="pill">Seus dados, seu ritmo</span>
        </div>
        <p className="sub">Atualize seus dados para acompanhar sua evolução.</p>
        <ThemeSettings />
        <form onSubmit={submit}>
          <label>
            Nome
            <input
              value={draft.fullName}
              onChange={(e) => change({ fullName: e.target.value })}
              minLength={2}
              maxLength={100}
              autoComplete="name"
              required
            />
          </label>
          <label>
            E-mail
            <input readOnly value={email || ""} type="email" />
          </label>
          <div className="profile-form-grid">
            <label>
              Peso atual (kg)
              <input
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  setSaved(false);
                  setError("");
                }}
                type="number"
                min="1"
                max="500"
                step="0.1"
                placeholder="Ex.: 72,5"
              />
            </label>
            <label>
              Altura (cm)
              <input
                value={draft.heightCm ?? ""}
                onChange={(e) =>
                  change({
                    heightCm: e.target.value ? Number(e.target.value) : null,
                  })
                }
                type="number"
                min="100"
                max="250"
                step="0.1"
                placeholder="Ex.: 175"
              />
            </label>
            <label>
              Idade (anos)
              <input
                value={draft.age ?? ""}
                onChange={(e) =>
                  change({
                    age: e.target.value ? Number(e.target.value) : null,
                  })
                }
                type="number"
                min="1"
                max="100"
                placeholder="Ex.: 28"
              />
            </label>
            <label>
              Sexo usado na fórmula
              <select
                value={draft.sex}
                onChange={(e) =>
                  change({ sex: e.target.value as PersonalProfile["sex"] })
                }
              >
                <option value="">Não informado</option>
                <option value="female">Feminino</option>
                <option value="male">Masculino</option>
              </select>
            </label>
          </div>
          <label>
            Nível de atividade
            <select
              value={draft.activity}
              onChange={(e) => change({ activity: Number(e.target.value) })}
            >
              {activityLevels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} · {level.detail}
                </option>
              ))}
            </select>
          </label>
          <div className="calorie-choice">
            <strong>Como definir sua meta de calorias?</strong>
            <label>
              <input
                type="radio"
                name="calorie-mode"
                checked={draft.calorieMode === "manual"}
                onChange={() => change({ calorieMode: "manual" })}
              />
              <span>
                Meta manual
                <small>Você escolhe a meta em Metas e configurações.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="calorie-mode"
                checked={draft.calorieMode === "automatic"}
                onChange={() => change({ calorieMode: "automatic" })}
              />
              <span>
                Manutenção estimada, automática
                <small>Recalcula quando peso ou perfil são atualizados.</small>
              </span>
            </label>
          </div>
          {draft.calorieMode === "automatic" && (
            <div className="calorie-preview" role="status" aria-live="polite">
              {estimates.daily ? (
                <>
                  <strong>
                    Manutenção estimada:{" "}
                    {estimates.daily.toLocaleString("pt-BR")} kcal/dia
                  </strong>
                  <p>
                    Salvar perfil aplica esta meta. Novos registros de peso
                    recalculam o valor.
                  </p>
                </>
              ) : (
                <>
                  <strong>Faltam dados para estimar</strong>
                  <p>Preencha ou corrija: {needed.join("; ")}.</p>
                </>
              )}
            </div>
          )}
          {error && (
            <div className="auth-alert" role="alert">
              {error}
            </div>
          )}
          <button className="primary submit">
            Salvar perfil <Check size={17} />
          </button>
          {saved && (
            <p className="profile-feedback" role="status">
              Perfil atualizado. Acompanhe o salvamento no topo da página.
            </p>
          )}
        </form>
      </section>
      <div className="profile-insights">
        <section className="panel">
          <h2>Seu corpo em números</h2>
          <div className="profile-insight">
            <span className="tile green">
              <Scale size={20} />
            </span>
            <div>
              <span>Peso atual</span>
              <strong>
                {weight ? Number(weight).toLocaleString("pt-BR") : "—"}{" "}
                <small>kg</small>
              </strong>
            </div>
          </div>
          <div className="profile-insight">
            <span className="tile blue">
              <Ruler size={20} />
            </span>
            <div>
              <span>Índice de massa corporal</span>
              <strong>
                {estimates.bmi?.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                }) ?? "—"}
              </strong>
              <small>
                {estimates.bmiLabel || "Preencha peso, altura e idade."}
              </small>
            </div>
          </div>
          <p className="estimate-note">
            O IMC é uma referência para adultos; não distingue músculo de
            gordura nem substitui uma avaliação individual.
          </p>
        </section>
        <section className="panel">
          <h2>Estimativa de energia</h2>
          <div className="profile-insight">
            <span className="tile orange">
              <Flame size={20} />
            </span>
            <div>
              <span>Manutenção diária estimada</span>
              <strong>
                {estimates.daily?.toLocaleString("pt-BR") ?? "—"}{" "}
                <small>kcal/dia</small>
              </strong>
            </div>
          </div>
          <div className="basal-estimate">
            <span>Gasto em repouso estimado</span>
            <strong>
              {estimates.basal?.toLocaleString("pt-BR") ?? "—"} kcal/dia
            </strong>
          </div>
          <p className="estimate-note">
            Fórmula de{" "}
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
              target="_blank"
              rel="noreferrer"
            >
              Mifflin–St Jeor
            </a>{" "}
            com fator aproximado de atividade. Disponível para adultos de 18 a
            100 anos. A manutenção é uma estimativa, não uma prescrição
            alimentar.
          </p>
          <p className="estimate-note">
            O peso mais recente da Evolução mantém este perfil atualizado.
            Alterar o peso aqui também cria um registro na Evolução.
          </p>
        </section>
      </div>
    </div>
  );
}
