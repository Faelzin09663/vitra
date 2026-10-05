import { invokeAPI } from "../lib/api";
import React from "react";
import { Camera, Sparkles, X, Check, Utensils } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Meal } from "../lib/store";
import {
  parseMealAnalysis,
  type MealAnalysis,
} from "../../supabase/functions/_shared/meal-schema";
import {
  hasAIConsent,
  type AIConsent,
} from "../../supabase/functions/_shared/ai-consent";
import { prepareMealImage } from "../lib/mealImage";
import { AIConsentSettings } from "./AIConsentSettings";
import { ModalDialog } from "./ModalDialog";

type Props = {
  onSave: (meal: Meal) => void;
  consent: AIConsent | null;
  age: number | null;
  onConsentChange: (consent: AIConsent | null) => Promise<void>;
  beforeAnalyze: () => Promise<void>;
};
export function MealAnalyzer({
  onSave,
  consent,
  age,
  onConsentChange,
  beforeAnalyze,
}: Props) {
  const [open, setOpen] = React.useState(false),
    [description, setDescription] = React.useState(""),
    [image, setImage] = React.useState(""),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [preparing, setPreparing] = React.useState(false);
  const [mode, setMode] = React.useState<"text" | "photo">("text");
  const [analysis, setAnalysis] = React.useState<MealAnalysis | null>(null),
    [model, setModel] = React.useState("");
  const sequence = React.useRef(0);
  const enabled =
    hasAIConsent(consent) &&
    age !== null &&
    Number.isInteger(age) &&
    age >= 18 &&
    age <= 100;
  React.useEffect(() => {
    if (!enabled) {
      sequence.current++;
      setAnalysis(null);
      setBusy(false);
    }
  }, [enabled]);
  React.useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  function close() {
    sequence.current++;
    setMode("text");
    setOpen(false);
    setAnalysis(null);
    setImage("");
    setDescription("");
    setError("");
    setBusy(false);
    setPreparing(false);
  }
  async function analyze() {
    if (!supabase || busy || preparing || !enabled) return;
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    setAnalysis(null);
    try {
      await beforeAnalyze(); // Consent/preferences must already exist on the server.
      if (id !== sequence.current) return;
      const { data, error } = await invokeAPI("analyze-meal", {
        body: { description, image },
      });
      if (id !== sequence.current) return;
      if (error) {
        let message =
          "Não foi possível analisar. Confira a conexão e a configuração do servidor Vitra.";
        if ("context" in error && error.context instanceof Response) {
          const body = await error.context.json().catch(() => null);
          if (typeof body?.error === "string") message = body.error;
        }
        throw new Error(message);
      }
      if (!data?.analysis || typeof data.model !== "string")
        throw new Error("A IA não retornou uma estimativa.");
      const result = parseMealAnalysis(JSON.stringify(data.analysis));
      if (result.needsClarification) {
        setError(result.notes);
        return;
      }
      setAnalysis(result);
      setModel(data.model);
    } catch (err) {
      if (id === sequence.current)
        setError(
          err instanceof Error ? err.message : "Não foi possível analisar.",
        );
    } finally {
      if (id === sequence.current) setBusy(false);
    }
  }
  async function photo(file: File) {
    const id = ++sequence.current;
    setPreparing(true);
    setError("");
    setAnalysis(null);
    try {
      const prepared = await prepareMealImage(file);
      if (id === sequence.current) setImage(prepared);
    } catch (err) {
      if (id === sequence.current)
        setError(err instanceof Error ? err.message : "Foto inválida.");
    } finally {
      if (id === sequence.current) setPreparing(false);
    }
  }
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!analysis || !enabled) return;
    try {
      const checked = parseMealAnalysis(JSON.stringify(analysis));
      onSave({
        name: checked.name,
        calories: checked.calories,
        protein: checked.protein,
        carbs: checked.carbs,
        fat: checked.fat,
        estimated: true,
        notes: checked.notes,
        analyzedBy: model,
        foods: checked.foods,
        confidence: checked.confidence,
      });
      close();
    } catch {
      setError("Revise o nome, as porções e os valores antes de salvar.");
    }
  }
  return (
    <>
      <button
        className="ai-launch"
        aria-label="Analisar refeição com IA"
        onClick={() => setOpen(true)}
      >
        <span className="tile purple">
          <Sparkles size={21} />
        </span>
        <div>
          <strong>Analisar refeição com IA</strong>
          <span>Texto, porções ou foto · Google Gemini</span>
        </div>
        <Camera size={22} />
      </button>
      {open && (
        <ModalDialog label="Analisar refeição" onClose={close}>
          <div className="section-heading">
            <h2>
              <Sparkles size={19} />
              Sua refeição, mais fácil de registrar
            </h2>
            <button aria-label="Fechar análise" onClick={close}>
              <X size={20} />
            </button>
          </div>
          {!enabled ? (
            <AIConsentSettings
              consent={consent}
              age={age}
              onChange={onConsentChange}
            />
          ) : (
            <>
              {analysis ? (
                <>
                  <div className="analysis-summary">
                    <span className="tile orange">
                      <Utensils size={20} />
                    </span>
                    <p>
                      Revise os alimentos, porções e todos os valores antes de
                      confirmar.
                    </p>
                  </div>
                  <p className="estimate-note">
                    Estimativa por IA. Não substitui um profissional de saúde.
                  </p>
                  <form onSubmit={save}>
                    <label>
                      Nome da refeição
                      <input
                        name="name"
                        value={analysis.name}
                        onChange={(e) =>
                          setAnalysis({ ...analysis, name: e.target.value })
                        }
                        required
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Calorias (kcal)
                      <input
                        name="calories"
                        type="number"
                        min="0"
                        max="10000"
                        value={analysis.calories}
                        onChange={(e) =>
                          setAnalysis({
                            ...analysis,
                            calories: Number(e.target.value),
                          })
                        }
                        required
                      />
                    </label>
                    <div className="form-grid">
                      {(["protein", "carbs", "fat"] as const).map((key, i) => (
                        <label key={key}>
                          {["Proteínas", "Carboidratos", "Gorduras"][i]} (g)
                          <input
                            name={key}
                            type="number"
                            min="0"
                            max={key === "carbs" ? 2000 : 1000}
                            value={analysis[key]}
                            onChange={(e) =>
                              setAnalysis({
                                ...analysis,
                                [key]: Number(e.target.value),
                              })
                            }
                            required
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Observações e suposições
                      <textarea
                        value={analysis.notes}
                        onChange={(e) =>
                          setAnalysis({ ...analysis, notes: e.target.value })
                        }
                        maxLength={1200}
                        required
                        rows={3}
                      />
                    </label>
                    <label>
                      Confiança da estimativa
                      <select
                        value={analysis.confidence}
                        onChange={(e) =>
                          setAnalysis({
                            ...analysis,
                            confidence: e.target
                              .value as MealAnalysis["confidence"],
                          })
                        }
                      >
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                      </select>
                    </label>
                    <fieldset className="meal-food-editor">
                      <legend>Alimentos e porções assumidas</legend>
                      {analysis.foods.map((food, i) => (
                        <div className="form-grid" key={i}>
                          <label>
                            Alimento {i + 1}
                            <input
                              value={food.name}
                              onChange={(e) =>
                                setAnalysis({
                                  ...analysis,
                                  foods: analysis.foods.map((f, j) =>
                                    j === i
                                      ? { ...f, name: e.target.value }
                                      : f,
                                  ),
                                })
                              }
                              maxLength={120}
                              required
                            />
                          </label>
                          <label>
                            Porção {i + 1}
                            <input
                              value={food.portion}
                              onChange={(e) =>
                                setAnalysis({
                                  ...analysis,
                                  foods: analysis.foods.map((f, j) =>
                                    j === i
                                      ? { ...f, portion: e.target.value }
                                      : f,
                                  ),
                                })
                              }
                              maxLength={120}
                              required
                            />
                          </label>
                          <button
                            type="button"
                            className="text"
                            aria-label={"Remover alimento " + (i + 1)}
                            onClick={() =>
                              setAnalysis({
                                ...analysis,
                                foods: analysis.foods.filter((_, j) => j !== i),
                              })
                            }
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text"
                        disabled={analysis.foods.length >= 20}
                        onClick={() =>
                          setAnalysis({
                            ...analysis,
                            foods: [
                              ...analysis.foods,
                              { name: "", portion: "" },
                            ],
                          })
                        }
                      >
                        Adicionar alimento
                      </button>
                    </fieldset>
                    <button className="primary submit">
                      Confirmar e salvar refeição <Check size={17} />
                    </button>
                    <button
                      type="button"
                      className="text"
                      onClick={() => {
                        setAnalysis(null);
                        setError("");
                      }}
                    >
                      Voltar para a análise
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div
                    className="feature-tabs"
                    aria-label="Como informar a refeição"
                  >
                    <button
                      disabled={busy || preparing}
                      aria-pressed={mode === "text"}
                      onClick={() => {
                        setMode("text");
                        setImage("");
                      }}
                    >
                      Texto e porções
                    </button>
                    <button
                      disabled={busy || preparing}
                      aria-pressed={mode === "photo"}
                      onClick={() => setMode("photo")}
                    >
                      Foto e detalhes
                    </button>
                  </div>
                  <p className="estimate-note">
                    Escreva o que comeu e quanto: gramas, unidades, colheres ou
                    xícaras. Informe se foi pesado cru ou cozido e inclua
                    óleo/molhos. Nenhuma foto é obrigatória.
                  </p>
                  <label>
                    Descreva os alimentos e as porções
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Ex.: 150 g de arroz, 100 g de feijão e um filé de frango grelhado"
                      disabled={busy}
                    />
                  </label>
                  {mode === "photo" && (
                    <label className="photo-input">
                      <Camera size={24} />
                      <span>
                        {preparing
                          ? "Preparando foto…"
                          : image
                            ? "Trocar foto da refeição"
                            : "Escolher ou tirar uma foto"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy || preparing}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void photo(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  {image && (
                    <div className="meal-photo">
                      <img src={image} alt="Foto da refeição para análise" />
                      <button
                        disabled={busy || preparing}
                        aria-label="Remover foto"
                        onClick={() => setImage("")}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <p className="estimate-note">
                    Somente ao clicar em Analisar, a refeição será enviada ao
                    Google (Gemini). A foto não fica salva no Vitra.
                  </p>
                  <button
                    className="primary submit"
                    disabled={
                      busy || preparing || (!description.trim() && !image)
                    }
                    onClick={analyze}
                  >
                    {busy ? "Analisando sua refeição…" : "Analisar refeição"}
                    <Sparkles size={17} />
                  </button>
                </>
              )}
              <button
                type="button"
                className="text"
                disabled={busy}
                onClick={async () => {
                  sequence.current++;
                  setAnalysis(null);
                  setImage("");
                  try {
                    await onConsentChange(null);
                  } catch {
                    setError(
                      "A desativação ainda não foi salva na conta. Verifique a conexão e tente novamente.",
                    );
                  }
                }}
              >
                Desativar IA
              </button>
            </>
          )}
          {error && (
            <div role="alert" className="auth-alert">
              {error}
            </div>
          )}
        </ModalDialog>
      )}
    </>
  );
}
