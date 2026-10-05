import React from "react";
import {
  type AIConsent,
  BODY_CONSENT_VERSION,
  hasBodyConsent,
  hasVitConsent,
  VIT_CONSENT_VERSION,
} from "../../supabase/functions/_shared/ai-consent";
export function VitConsentSettings({
  consent,
  bodyConsent,
  age,
  onConsent,
  onBodyConsent,
}: {
  consent?: AIConsent | null;
  bodyConsent?: AIConsent | null;
  age: number | null;
  onConsent: (value: AIConsent | null) => Promise<void>;
  onBodyConsent: (value: AIConsent | null) => Promise<void>;
}) {
  const [checked, setChecked] = React.useState(false),
    [photoChecked, setPhotoChecked] = React.useState(false),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  const adult = age !== null && Number.isInteger(age) && age >= 18 &&
    age <= 100;
  async function change(kind: "vit" | "body", enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      await (kind === "vit" ? onConsent : onBodyConsent)(
        enabled ? null : {
          version: kind === "vit" ? VIT_CONSENT_VERSION : BODY_CONSENT_VERSION,
          grantedAt: new Date().toISOString(),
        },
      );
    } catch {
      setError("Não foi possível salvar a autorização. Confira a conexão.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="vit-consent">
      <h3>Você controla o VIT</h3>
      <p>
        Ao enviar uma mensagem, o Google recebe sua pergunta, um resumo dos
        registros, até 16 mensagens recentes e até 20 memórias ativas. Conversas
        e memórias ficam salvas na sua conta Supabase; você pode apagá-las.
        Memórias sugeridas só são salvas ao confirmar. Evite incluir contatos,
        credenciais ou dados de terceiros.
      </p>
      <p>
        Fotos têm autorização separada. Só ao enviar, a foto será salva no seu
        acervo privado e analisada pelo Google, sem EXIF. O VIT recebe as
        observações validadas dessa análise, sem avaliar saúde, gordura ou
        atratividade pela imagem. Use fotos próprias e adequadamente vestidas.
      </p>
      <p>
        O serviço usa Gemini pago. Sugestões são informativas e não alteram seus
        registros automaticamente.
      </p>
      {!adult && (
        <p>Complete e salve sua idade adulta no Perfil para conversar.</p>
      )}
      {!hasVitConsent(consent) && (
        <label className="consent-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={!adult || busy}
          />Autorizo o VIT a usar conversa, memórias e resumo dos meus
          registros.
        </label>
      )}
      <button
        type="button"
        disabled={busy || !adult || (!hasVitConsent(consent) && !checked)}
        onClick={() => void change("vit", hasVitConsent(consent))}
      >
        {hasVitConsent(consent) ? "Desativar VIT" : "Autorizar VIT"}
      </button>
      {!hasBodyConsent(bodyConsent) && (
        <label className="consent-check">
          <input
            type="checkbox"
            checked={photoChecked}
            onChange={(e) => setPhotoChecked(e.target.checked)}
            disabled={!adult || busy}
          />Autorizo separadamente o envio de fotos próprias para análise.
        </label>
      )}
      <button
        type="button"
        disabled={busy || !adult ||
          (!hasBodyConsent(bodyConsent) && !photoChecked)}
        onClick={() => void change("body", hasBodyConsent(bodyConsent))}
      >
        {hasBodyConsent(bodyConsent)
          ? "Desativar análise de fotos"
          : "Autorizar análise de fotos"}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
