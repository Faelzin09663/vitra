import React from "react";
import { supabase } from "../lib/supabase";
import { useRecords } from "../lib/useRecords";
import { uid } from "../lib/uid";
import { localDateKey, type Store } from "../lib/store";
import {
  measurementFields,
  measurementTrend,
  navyBodyFat,
  waistHeightRatio,
  type Measurement,
  type MeasureKey,
} from "../lib/measurements";
import { photoPath, prepareProgressImage } from "../lib/progressImage";
import {
  parseBodyAnalysis,
  type BodyAnalysis,
} from "../../supabase/functions/_shared/body-schema";
import {
  hasBodyConsent,
  type AIConsent,
} from "../../supabase/functions/_shared/ai-consent";
import { TrendChart } from "./TrendChart";
import { ModalDialog } from "./ModalDialog";
type Photo = {
  id: string;
  user_id: string;
  date: string;
  angle: string;
  storage_path: string;
  note: string;
};
type Analysis = {
  id: string;
  user_id: string;
  photo_ids: string[];
  created_at: string;
  result: BodyAnalysis;
  model: string;
};
function PrivatePhoto({ photo }: { photo: Photo }) {
  const [url, setURL] = React.useState(""),
    [error, setError] = React.useState("");
  React.useEffect(() => {
    let current = true;
    const sign = async () => {
      const r = await supabase?.storage
        .from("progress-photos")
        .createSignedUrl(photo.storage_path, 300);
      if (!current) return;
      if (r?.error || !r?.data) {
        setError("Foto indisponível.");
        setURL("");
      } else {
        setURL(r.data.signedUrl);
        setError("");
      }
    };
    void sign();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void sign();
    }, 240000);
    return () => {
      current = false;
      clearInterval(id);
    };
  }, [photo.storage_path]);
  return url ? (
    <img
      src={url}
      alt={`Progresso: ${photo.angle}, ${new Date(photo.date + "T12:00:00").toLocaleDateString("pt-BR")}`}
      loading="lazy"
    />
  ) : (
    <p role="status">{error || "Carregando foto privada…"}</p>
  );
}
export function BodyProgress({
  userId,
  store,
  onConsent,
  beforeAnalyze,
  initialTab = "Medidas",
}: {
  userId: string;
  initialTab?: "Medidas" | "Fotos";
  store: Store;
  onConsent: (consent: AIConsent | null) => Promise<void>;
  beforeAnalyze: () => Promise<void>;
}) {
  const measures = useRecords<Measurement>("body_measurements", userId),
    photos = useRecords<Photo>("progress_photos", userId),
    saved = useRecords<Analysis>("photo_analyses", userId, "created_at");
  const [tab, setTab] = React.useState<string>(initialTab),
    [edit, setEdit] = React.useState<Partial<Measurement> | null>(null),
    [key, setKey] = React.useState<MeasureKey>("waist"),
    [message, setMessage] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [selected, setSelected] = React.useState<string[]>([]),
    [slider, setSlider] = React.useState(50),
    [authorized, setAuthorized] = React.useState(false),
    [result, setResult] = React.useState<{
      analysis: BodyAnalysis;
      model: string;
      ids: string[];
    } | null>(null),
    [deleteId, setDeleteId] = React.useState("");
  const generation = React.useRef(0);
  React.useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const trend = measurementTrend(measures.rows, key),
    latest = measures.rows.at(-1),
    fat = navyBodyFat(
      store.profile.age !== null && store.profile.age >= 18
        ? store.profile.sex
        : "",
      store.profile.heightCm,
      latest?.neck,
      latest?.waist,
      latest?.hips,
    ),
    ratio = waistHeightRatio(latest?.waist, store.profile.heightCm);
  const chosen = selected
      .map((id) => photos.rows.find((p) => p.id === id))
      .filter((p): p is Photo => Boolean(p))
      .sort((a, b) => a.date.localeCompare(b.date)),
    adult = store.profile.age !== null && store.profile.age >= 18,
    consent = hasBodyConsent(store.preferences.body_consent);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveMeasure(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row: Partial<Measurement> = {
      date: String(f.get("date")),
      note: String(f.get("note")),
    };
    for (const k of Object.keys(measurementFields) as MeasureKey[])
      row[k] = f.get(k) ? Number(f.get(k)) : null;
    await run(async () => {
      await measures.save(row, "user_id,date");
      setEdit(null);
      setMessage("Medidas salvas.");
    });
  }
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form),
      file = f.get("photo") as File;
    await run(async () => {
      if (!supabase) throw new Error("Conexão indisponível.");
      const image = await prepareProgressImage(file),
        id = uid(),
        path = photoPath(userId, id);
      const sent = await supabase.storage
        .from("progress-photos")
        .upload(path, image, { contentType: "image/jpeg", upsert: false });
      if (sent.error)
        throw new Error(
          "Não foi possível enviar a foto. Confira o bucket privado e a conexão.",
        );
      try {
        await photos.save({
          id,
          date: String(f.get("date")),
          angle: String(f.get("angle")),
          note: String(f.get("note")),
          storage_path: path,
        });
      } catch (err) {
        await supabase.storage.from("progress-photos").remove([path]);
        throw err;
      }
      form.reset();
      setMessage("Foto privada salva.");
    });
  }
  async function analyze() {
    const version = ++generation.current;
    const ids = [...selected];
    setResult(null);
    await run(async () => {
      await beforeAnalyze();
      const response = await supabase!.functions.invoke("analyze-body-photos", {
        body: { photoIds: ids },
      });
      if (response.error)
        throw new Error(
          "Análise indisponível. Verifique consentimento, limite diário e publicação da função.",
        );
      const analysis = parseBodyAnalysis(
        JSON.stringify(response.data?.analysis),
      );
      if (
        version === generation.current &&
        hasBodyConsent(store.preferences.body_consent)
      )
        setResult({ analysis, model: response.data.model, ids });
    });
  }
  return (
    <section className="feature-panel">
      <h2>Medidas e fotos de progresso</h2>
      <div className="feature-tabs">
        {["Medidas", "Fotos"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {message && <p role="status">{message}</p>}
      {[measures.error, photos.error, saved.error]
        .filter(Boolean)
        .map((err, i) => (
          <p key={i} role="alert">
            {err}
          </p>
        ))}
      {tab === "Medidas" ? (
        <>
          <button
            className="primary"
            onClick={() => setEdit({ date: localDateKey() })}
          >
            Registrar medidas
          </button>
          <label>
            Medida do gráfico
            <select
              value={key}
              onChange={(e) => setKey(e.target.value as MeasureKey)}
            >
              {Object.entries(measurementFields).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <TrendChart
            points={trend.points}
            label={`${measurementFields[key]} (cm)`}
          />
          <p>
            Variação desde o primeiro: {trend.firstDelta?.toFixed(1) ?? "—"} cm
            · desde o anterior: {trend.previousDelta?.toFixed(1) ?? "—"} cm
          </p>
          <p>
            Gordura corporal estimada por medidas (Marinha dos EUA):{" "}
            {fat === null ? "dados incompletos ou fora de faixa" : `${fat}%`}.
            Relação cintura/altura: {ratio?.toFixed(2) ?? "—"}.
          </p>
          <p className="sub">
            São estimativas com limitações; fotos não estimam peso ou gordura.
            Use medidas consistentes e orientação profissional.
          </p>
          {measures.rows.length === 0 && !measures.loading && (
            <p>
              Sem medidas ainda. Registre somente os campos que quiser
              acompanhar.
            </p>
          )}
          {measures.rows.map((row) => (
            <div className="session-tools-row" key={row.date}>
              <span>
                {new Date(row.date + "T12:00:00").toLocaleDateString("pt-BR")} ·{" "}
                {measurementFields[key]}: {row[key] ?? "—"} cm
              </span>
              <button onClick={() => setEdit(row)}>Editar</button>
            </div>
          ))}
        </>
      ) : (
        <>
          <form onSubmit={upload}>
            <label>
              Foto (JPEG, PNG ou WebP)
              <input
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <div className="feature-filters">
              <label>
                Data
                <input
                  name="date"
                  type="date"
                  defaultValue={localDateKey()}
                  max={localDateKey()}
                  required
                />
              </label>
              <label>
                Ângulo
                <select name="angle">
                  {["frente", "lado", "costas", "outro"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Nota
              <textarea name="note" maxLength={1000} />
            </label>
            <button className="primary" disabled={busy}>
              Salvar foto privada
            </button>
          </form>
          <p>
            Fotos privadas, sem metadados de localização. Selecione até duas do
            mesmo ângulo para comparar. Links temporários expiram em 5 minutos.
          </p>
          <div className="feature-grid photo-grid">
            {photos.rows.map((p) => (
              <article key={p.id}>
                <PrivatePhoto photo={p} />
                <p>
                  {new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR")} ·{" "}
                  {p.angle}
                </p>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    disabled={
                      !selected.includes(p.id) &&
                      (selected.length === 2 ||
                        Boolean(chosen[0] && chosen[0].angle !== p.angle))
                    }
                    onChange={() => {
                      generation.current++;
                      setResult(null);
                      setSelected(
                        selected.includes(p.id)
                          ? selected.filter((id) => id !== p.id)
                          : [...selected, p.id],
                      );
                    }}
                  />
                  Selecionar
                </label>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await supabase!.storage
                        .from("progress-photos")
                        .download(p.storage_path);
                      if (r.error || !r.data)
                        throw new Error("Falha ao baixar a foto.");
                      const url = URL.createObjectURL(r.data),
                        link = document.createElement("a");
                      link.href = url;
                      link.download = `vitra-${p.date}-${p.angle}.jpg`;
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    })
                  }
                >
                  Baixar foto
                </button>
                <button disabled={busy} onClick={() => setDeleteId(p.id)}>
                  Excluir foto
                </button>
              </article>
            ))}
          </div>
          {photos.rows.length === 0 && !photos.loading && (
            <p>
              Nenhuma foto salva. O registro por medidas continua disponível.
            </p>
          )}
          {chosen.length === 2 && (
            <>
              <div className="photo-compare">
                {chosen.map((p) => (
                  <PrivatePhoto key={p.id} photo={p} />
                ))}
              </div>
              <label>
                Comparador antes / depois
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={slider}
                  onChange={(e) => setSlider(Number(e.target.value))}
                />
              </label>
              <div className="photo-slider">
                <PrivatePhoto photo={chosen[0]} />
                <div style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}>
                  <PrivatePhoto photo={chosen[1]} />
                </div>
              </div>
            </>
          )}
          <h3>Analisar fotos com IA (opcional)</h3>
          <p>
            Somente no clique em Analisar, as fotos selecionadas e suas notas
            serão enviadas ao Google (Gemini), no plano pago. É preciso ter 18
            anos ou mais. Não há nota do corpo, estimativa de peso/gordura ou
            diagnóstico. Você pode desativar e apagar análises.
          </p>
          {consent ? (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  generation.current++;
                  setResult(null);
                  await onConsent(null);
                })
              }
            >
              Desativar análise de fotos
            </button>
          ) : (
            <>
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={authorized}
                  disabled={!adult || busy}
                  onChange={(e) => setAuthorized(e.target.checked)}
                />
                Autorizo o envio das fotos selecionadas ao Google para análise.
              </label>
              <button
                disabled={!authorized || !adult || busy}
                onClick={() =>
                  void run(() =>
                    onConsent({
                      version: 1,
                      grantedAt: new Date().toISOString(),
                    }),
                  )
                }
              >
                Salvar consentimento de fotos
              </button>
            </>
          )}
          {!adult && (
            <p>Complete e salve seu perfil com idade de 18 anos ou mais.</p>
          )}
          <button
            className="primary"
            disabled={busy || !consent || !adult || chosen.length === 0}
            onClick={() => void analyze()}
          >
            {busy ? "Aguarde…" : "Analisar fotos selecionadas"}
          </button>
          {result && (
            <article>
              <h3>
                {result.analysis.status === "analyzed"
                  ? "Observações da comparação"
                  : "Seu bem-estar"}
              </h3>
              <p>{result.analysis.reason}</p>
              {Object.entries(result.analysis.quality)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <p key={k}>{v}</p>
                ))}
              {[...result.analysis.changes, ...result.analysis.suggestions].map(
                (v, i) => (
                  <p key={i}>{v}</p>
                ),
              )}
              <p>{result.analysis.limitations}</p>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await saved.save({
                      id: uid(),
                      photo_ids: result.ids,
                      result: result.analysis,
                      model: result.model,
                    });
                    setResult(null);
                    setMessage("Análise salva.");
                  })
                }
              >
                Salvar texto da análise
              </button>
              <button onClick={() => setResult(null)}>Descartar</button>
            </article>
          )}
          {saved.rows.map((a) => (
            <article key={a.id}>
              <h3>
                Análise de {new Date(a.created_at).toLocaleDateString("pt-BR")}
              </h3>
              <p>{a.result.reason}</p>
              {[...a.result.changes, ...a.result.suggestions].map((v, i) => (
                <p key={i}>{v}</p>
              ))}
              <button
                disabled={busy}
                onClick={() => void run(() => saved.remove(a.id))}
              >
                Apagar análise
              </button>
            </article>
          ))}
        </>
      )}
      {edit && (
        <ModalDialog label="Registrar medidas" onClose={() => setEdit(null)}>
          <h2>Medidas em centímetros</h2>
          <form onSubmit={saveMeasure}>
            <label>
              Data
              <input
                name="date"
                type="date"
                defaultValue={edit.date}
                max={localDateKey()}
                required
                readOnly={Boolean(edit.user_id)}
              />
            </label>
            <div className="feature-filters">
              {Object.entries(measurementFields).map(([k, v]) => (
                <label key={k}>
                  {v} (cm)
                  <input
                    name={k}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={300}
                    step="0.1"
                    defaultValue={edit[k as MeasureKey] ?? ""}
                  />
                </label>
              ))}
            </div>
            <label>
              Nota
              <textarea name="note" defaultValue={edit.note} maxLength={1000} />
            </label>
            <button className="primary" disabled={busy}>
              Salvar medidas
            </button>
          </form>
          <button onClick={() => setEdit(null)}>Cancelar</button>
        </ModalDialog>
      )}
      {deleteId && (
        <ModalDialog
          label="Excluir foto privada"
          onClose={() => setDeleteId("")}
        >
          <h2>Excluir foto e análises relacionadas?</h2>
          <button
            disabled={busy}
            className="primary"
            onClick={() =>
              void run(async () => {
                const photo = photos.rows.find((p) => p.id === deleteId)!;
                const r = await supabase!.storage
                  .from("progress-photos")
                  .remove([photo.storage_path]);
                if (r.error)
                  throw new Error("Falha ao apagar arquivo. Tente novamente.");
                await photos.remove(photo.id);
                await saved.reload();
                setSelected(selected.filter((id) => id !== photo.id));
                generation.current++;
                setResult(null);
                setDeleteId("");
              })
            }
          >
            Confirmar exclusão
          </button>
          <button onClick={() => setDeleteId("")}>Cancelar</button>
        </ModalDialog>
      )}
    </section>
  );
}
