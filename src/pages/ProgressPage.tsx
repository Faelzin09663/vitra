import React from "react";
import type { Store, Workout } from "../lib/store";
import type { AIConsent } from "../../supabase/functions/_shared/ai-consent";
import { FeatureSkeleton } from "../components/FeatureSkeleton";
import { WeightProgress } from "../components/WeightProgress";
import { CloudHistory } from "../components/CloudHistory";
import { StepsPanel } from "../components/StepsPanel";
const BodyProgress = React.lazy(() =>
  import("../components/BodyProgress").then((m) => ({
    default: m.BodyProgress,
  })),
);
const DailyWellbeing = React.lazy(() =>
  import("../components/DailyWellbeing").then((m) => ({
    default: m.DailyWellbeing,
  })),
);
const TrainingAnalytics = React.lazy(() =>
  import("../components/TrainingAnalytics").then((m) => ({
    default: m.TrainingAnalytics,
  })),
);
const CoachPanel = React.lazy(() =>
  import("../components/CoachPanel").then((m) => ({ default: m.CoachPanel })),
);
export default function ProgressPage({
  store,
  userId,
  status,
  onRegister,
  onExport,
  onChange,
  onConsent,
  beforeAsk,
  onSave,
}: {
  store: Store;
  userId: string;
  status: string;
  onRegister: () => void;
  onExport: () => void;
  onChange: (patch: Partial<Store>) => void;
  onConsent: (
    kind: "ai_consent" | "body_consent",
    value: AIConsent | null,
  ) => Promise<void>;
  beforeAsk: () => Promise<void>;
  onSave: (workout: Workout) => void;
}) {
  const [tab, setTab] = React.useState("Peso e histórico");
  return (
    <>
      <div className="feature-tabs" aria-label="Áreas da evolução">
        {[
          "Peso e histórico",
          "Análises",
          "Medidas",
          "Fotos",
          "Bem-estar",
          "Coach e chat",
        ].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <React.Suspense fallback={<FeatureSkeleton />}>
        {tab === "Peso e histórico" && (
          <>
            <WeightProgress store={store} onRegister={onRegister} />
            <button className="text export" onClick={onExport}>
              Exportar meus dados
            </button>
            <StepsPanel userId={userId} />
            <CloudHistory userId={userId} status={status} store={store} />
          </>
        )}
        {tab === "Análises" && (
          <TrainingAnalytics
            store={store}
            userId={userId}
            onChange={onChange}
          />
        )}{" "}
        {["Medidas", "Fotos"].includes(tab) && (
          <BodyProgress
            key={tab}
            initialTab={tab as "Medidas" | "Fotos"}
            userId={userId}
            store={store}
            onConsent={(value) => onConsent("body_consent", value)}
            beforeAnalyze={beforeAsk}
          />
        )}{" "}
        {tab === "Bem-estar" && (
          <DailyWellbeing userId={userId} store={store} history />
        )}
        {tab === "Coach e chat" && (
          <CoachPanel
            store={store}
            onConsent={(value) => onConsent("ai_consent", value)}
            beforeAsk={beforeAsk}
            onSave={onSave}
          />
        )}
      </React.Suspense>
    </>
  );
}
