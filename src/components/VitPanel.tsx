import React from "react";
import { Bot, Brain, Camera, Plus, Send, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useRecords } from "../lib/useRecords";
import { invokeAPI } from "../lib/api";
import { uid } from "../lib/uid";
import { localDateKey, type Store } from "../lib/store";
import { photoPath, prepareProgressImage } from "../lib/progressImage";
import {
  type AIConsent,
  hasBodyConsent,
  hasVitConsent,
} from "../../supabase/functions/_shared/ai-consent";
import type { SavedVitResponse } from "../../supabase/functions/_shared/vit-handler";
import { VitConsentSettings } from "./VitConsentSettings";
import { ModalDialog } from "./ModalDialog";
type Conversation = {
  id: string;
  user_id: string;
  title: string;
  updated_at: string;
};
type Memory = {
  id: string;
  user_id: string;
  content: string;
  active: boolean;
  updated_at: string;
};
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sequence: number;
  photo_id: string | null;
  metadata: Partial<SavedVitResponse>;
};
export function VitPanel({
  store,
  userId,
  beforeAsk,
  onConsent,
  onBodyConsent,
}: {
  store: Store;
  userId: string;
  beforeAsk: () => Promise<void>;
  onConsent: (value: AIConsent | null) => Promise<void>;
  onBodyConsent: (value: AIConsent | null) => Promise<void>;
}) {
  const conversations = useRecords<Conversation>(
      "vit_conversations",
      userId,
      "updated_at",
    ),
    memories = useRecords<Memory>("vit_memories", userId, "updated_at");
  const [conversation, setConversation] = React.useState(""),
    [messages, setMessages] = React.useState<Message[]>([]),
    [older, setOlder] = React.useState(false),
    [loading, setLoading] = React.useState(false),
    [question, setQuestion] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [preparing, setPreparing] = React.useState(false),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState(""),
    [memory, setMemory] = React.useState(""),
    [editing, setEditing] = React.useState<string | null>(null),
    [confirmDelete, setConfirmDelete] = React.useState(false),
    [image, setImage] = React.useState<Blob | null>(null),
    [preview, setPreview] = React.useState(""),
    [photoId, setPhotoId] = React.useState<string | null>(null),
    [angle, setAngle] = React.useState("frente");
  const generation = React.useRef(0),
    alive = React.useRef(true),
    sending = React.useRef(false),
    pending = React.useRef<{ key: string; id: string } | null>(null);
  const adult = store.profile.age !== null &&
    Number.isInteger(store.profile.age) && store.profile.age >= 18 &&
    store.profile.age <= 100;
  const enabled = adult && hasVitConsent(store.preferences.vit_consent),
    photosEnabled = enabled && hasBodyConsent(store.preferences.body_consent);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  React.useEffect(() => {
    if (!conversations.loading && !conversation && conversations.rows.length) {
      setConversation(conversations.rows.at(-1)!.id);
    }
  }, [conversations.rows, conversations.loading, conversation]);
  React.useEffect(() => {
    if (!image) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  React.useEffect(() => {
    if (!photosEnabled) {
      setImage(null);
      setPhotoId(null);
    }
  }, [photosEnabled]);
  async function load(id: string, append = false) {
    const version = ++generation.current;
    setLoading(true);
    try {
      if (!supabase) throw new Error("Conexão indisponível.");
      let query = supabase.from("vit_messages").select(
        "id,role,content,sequence,photo_id,metadata",
      ).eq("user_id", userId).eq("conversation_id", id).order("sequence", {
        ascending: false,
      }).limit(100);
      if (append && messages.length) {
        query = query.lt("sequence", messages[0].sequence);
      }
      const r = await query;
      if (r.error) {
        throw new Error(
          "Não foi possível carregar a conversa. Execute a migração do VIT e confira a conexão.",
        );
      }
      if (version !== generation.current || !alive.current) return;
      const rows = [...(r.data || [])].reverse() as Message[];
      setMessages((old) => append ? [...rows, ...old] : rows);
      setOlder(rows.length === 100);
    } catch (err) {
      if (version === generation.current && alive.current) {
        setError((err as Error).message);
      }
    } finally {
      if (version === generation.current && alive.current) setLoading(false);
    }
  }
  React.useEffect(() => {
    setMessages([]);
    setOlder(false);
    setError("");
    if (conversation) void load(conversation);
    return () => {
      generation.current++;
    };
  }, [conversation, userId]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function createConversation(title = "Conversa com VIT") {
    const id = uid();
    await conversations.save({
      id,
      title: title.slice(0, 100),
      updated_at: new Date().toISOString(),
    });
    setConversation(id);
    return id;
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!enabled || busy || preparing || sending.current || !question.trim()) {
      return;
    }
    sending.current = true;
    const prompt = question.trim();
    await run(async () => {
      await beforeAsk();
      const id = conversation || await createConversation(prompt.slice(0, 80));
      let attached = photoId;
      if (image && !attached) {
        if (!photosEnabled || !supabase) {
          throw new Error("Autorize a análise de fotos antes de enviar.");
        }
        const photo = uid(), path = photoPath(userId, photo);
        const sent = await supabase.storage.from("progress-photos").upload(
          path,
          image,
          { contentType: "image/jpeg", upsert: false },
        );
        if (sent.error) {
          throw new Error("Não foi possível enviar a foto privada.");
        }
        const row = await supabase.from("progress_photos").insert({
          id: photo,
          user_id: userId,
          date: localDateKey(),
          angle,
          note: "Enviada ao VIT",
          storage_path: path,
        });
        if (row.error) {
          await supabase.storage.from("progress-photos").remove([path]);
          throw new Error(
            "Não foi possível salvar a foto. Confira a migração e tente novamente.",
          );
        }
        attached = photo;
        setPhotoId(photo);
      }
      const key = JSON.stringify([id, prompt, attached]);
      if (pending.current?.key !== key) pending.current = { key, id: uid() };
      const response = await invokeAPI("vit", {
        body: {
          conversationId: id,
          requestId: pending.current.id,
          message: prompt,
          photoId: attached,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (!alive.current) return;
      setQuestion("");
      setImage(null);
      setPhotoId(null);
      pending.current = null;
      await load(id);
      await conversations.reload();
      setNotice("Conversa salva na sua conta.");
    });
    sending.current = false;
  }
  async function prepare(file: File) {
    setPreparing(true);
    setError("");
    try {
      const blob = await prepareProgressImage(file);
      if (alive.current) {
        setImage(blob);
        setPhotoId(null);
      }
    } catch (err) {
      if (alive.current) setError((err as Error).message);
    } finally {
      if (alive.current) setPreparing(false);
    }
  }
  async function saveMemory(text: string, id = editing) {
    if (!text.trim()) return;
    await run(async () => {
      if (!id && memories.rows.length >= 100) {
        throw new Error(
          "Limite de 100 memórias. Apague uma para adicionar outra.",
        );
      }
      await memories.save({
        id: id || uid(),
        content: text.trim(),
        active: true,
        updated_at: new Date().toISOString(),
      });
      setMemory("");
      setEditing(null);
      setNotice(
        "Memória salva. O VIT usa até as 20 memórias ativas mais recentes.",
      );
    });
  }
  return (
    <div className="vit-layout">
      <section className="panel vit-chat">
        <div className="section-heading">
          <h2>
            <Bot size={22} />VIT · seu assistente pessoal
          </h2>
          <button
            disabled={busy || loading || conversations.loading}
            onClick={() =>
              void run(async () => {
                await createConversation();
                setQuestion("");
                setImage(null);
                setPhotoId(null);
                pending.current = null;
              })}
          >
            <Plus size={16} />Nova conversa
          </button>
        </div>
        <p className="sub">
          Planeje refeições, revise seu treino e acompanhe seu objetivo com
          contexto dos seus registros.
        </p>
        <div className="vit-conversation-tools">
          <label>
            Conversa<select
              value={conversation}
              disabled={busy || conversations.loading}
              onChange={(e) => {
                setConversation(e.target.value);
                setImage(null);
                setPhotoId(null);
                pending.current = null;
              }}
            >
              <option value="">Escolha ou crie uma conversa</option>
              {[...conversations.rows].reverse().map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </label>
          {conversation && (
            <button
              disabled={busy || loading}
              onClick={() => setConfirmDelete(true)}
              aria-label="Excluir conversa"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
        {!enabled && (
          <VitConsentSettings
            consent={store.preferences.vit_consent}
            bodyConsent={store.preferences.body_consent}
            age={store.profile.age}
            onConsent={onConsent}
            onBodyConsent={onBodyConsent}
          />
        )}
        <div className="feature-tabs">
          {[
            "O que posso comer hoje dentro da minha meta?",
            "Como melhorar meu treino desta semana?",
            "Me ajude a manter meus hábitos.",
          ].map((q) => (
            <button
              key={q}
              disabled={busy || !enabled}
              onClick={() => setQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>
        {older && (
          <button
            disabled={loading || busy}
            onClick={() => void load(conversation, true)}
          >
            Carregar mensagens anteriores
          </button>
        )}
        <div className="vit-messages" aria-label="Histórico da conversa">
          {!messages.length && !loading && (
            <p className="sub">
              Comece com seu objetivo ou uma dúvida. Você decide o que vira
              memória.
            </p>
          )}
          {messages.map((m) => (
            <article key={m.id} className={`vit-message ${m.role}`}>
              <strong>{m.role === "user" ? "Você" : "VIT"}</strong>
              <p>{m.content}</p>
              {m.photo_id && (
                <small>
                  Foto própria anexada · acervo privado em Evolução → Fotos
                </small>
              )}
              {m.role === "assistant" &&
                m.metadata.memorySuggestions?.map((text, i) => (
                  <div className="vit-memory-proposal" key={i}>
                    <p>
                      <Brain size={14} />Lembrar: {text}
                    </p>
                    <button
                      disabled={busy ||
                        memories.rows.some((x) =>
                          x.content === text
                        )}
                      onClick={() => void saveMemory(text, null)}
                    >
                      Confirmar memória
                    </button>
                  </div>
                ))}
              {m.metadata.photoAnalysis && (
                <details>
                  <summary>Observações da foto</summary>
                  <p>{m.metadata.photoAnalysis.reason}</p>
                  {Object.values(m.metadata.photoAnalysis.quality).filter(
                    Boolean,
                  ).map((text, i) => <p key={i}>{text}</p>)}
                  <p>{m.metadata.photoAnalysis.limitations}</p>
                </details>
              )}
            </article>
          ))}
        </div>
        {(loading || busy) && (
          <p role="status">
            {busy
              ? "VIT está preparando sua resposta…"
              : "Carregando conversa…"}
          </p>
        )}
        {[error, conversations.error, memories.error].filter(Boolean).map((
          message,
          i,
        ) => <p key={i} className="inline-error" role="alert">{message}</p>)}
        {notice && <p role="status">{notice}</p>}
        <form onSubmit={send} className="vit-composer">
          <label>
            Converse com o VIT<textarea
              value={question}
              maxLength={1500}
              rows={3}
              disabled={busy || !enabled}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Conte seu objetivo, preferências ou uma dúvida sobre alimentação e treino."
              required
            />
          </label>
          {enabled && (
            <label className="vit-photo-input">
              <Camera size={18} />
              {preparing ? "Preparando foto…" : "Anexar foto própria"}
              <input
                aria-label="Foto própria para o VIT"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || preparing || !photosEnabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void prepare(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {enabled && !photosEnabled && (
            <p className="estimate-note">
              Abra Autorizações abaixo para habilitar fotos.
            </p>
          )}
          {preview && (
            <div className="vit-attachment">
              <img src={preview} alt="Foto própria selecionada para o VIT" />
              <label>
                Ângulo<select
                  value={angle}
                  disabled={busy || Boolean(photoId)}
                  onChange={(e) => setAngle(e.target.value)}
                >
                  <option value="frente">Frente</option>
                  <option value="lado">Lado</option>
                  <option value="costas">Costas</option>
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setImage(null);
                  setPhotoId(null);
                }}
              >
                <X size={15} />Remover anexo
              </button>
              <p>
                Ao enviar, a foto ficará no acervo privado em Evolução → Fotos.
                Remover este anexo não apaga uma foto já salva.
              </p>
            </div>
          )}
          <button
            className="primary"
            disabled={busy || loading || preparing || !enabled ||
              !question.trim()}
          >
            <Send size={16} />Enviar ao VIT
          </button>
        </form>
        {enabled && (
          <details>
            <summary>Autorizações e privacidade</summary>
            <VitConsentSettings
              consent={store.preferences.vit_consent}
              bodyConsent={store.preferences.body_consent}
              age={store.profile.age}
              onConsent={onConsent}
              onBodyConsent={onBodyConsent}
            />
          </details>
        )}
      </section>
      <section className="panel vit-memory">
        <h2>
          <Brain size={20} />Memórias que você escolheu
        </h2>
        <p className="estimate-note">
          Preferências e objetivos persistem entre conversas. O VIT usa até 20
          memórias ativas mais recentes; desative, edite ou apague quando
          quiser.
        </p>
        <ul>
          {memories.rows.map((m) => (
            <li key={m.id}>
              <p>{m.content}</p>
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={m.active}
                  disabled={busy}
                  onChange={(e) =>
                    void run(async () => {
                      await memories.save({
                        ...m,
                        active: e.target.checked,
                        updated_at: new Date().toISOString(),
                      });
                    })}
                />Usar esta memória
              </label>
              <div>
                <button
                  disabled={busy}
                  onClick={() => {
                    setEditing(m.id);
                    setMemory(m.content);
                  }}
                >
                  Editar
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await memories.remove(m.id);
                      if (editing === m.id) {
                        setEditing(null);
                        setMemory("");
                      }
                    })}
                >
                  Apagar memória
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveMemory(memory);
          }}
        >
          <label>
            Texto da memória<textarea
              maxLength={500}
              rows={3}
              required
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              placeholder="Ex.: Prefiro refeições simples e treino às segundas, quartas e sextas."
            />
          </label>
          <button disabled={busy || !memory.trim()}>
            {editing ? "Atualizar memória" : "Salvar memória"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setMemory("");
              }}
            >
              Cancelar edição
            </button>
          )}
        </form>
      </section>
      {confirmDelete && (
        <ModalDialog
          label="Excluir conversa do VIT"
          onClose={() => {
            if (!busy) setConfirmDelete(false);
          }}
        >
          <h2>Excluir esta conversa?</h2>
          <p>
            As mensagens serão apagadas. Suas memórias e fotos privadas
            continuam disponíveis; apague-as separadamente quando desejar.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await conversations.remove(conversation);
                setConversation("");
                setMessages([]);
                setConfirmDelete(false);
              })}
          >
            Confirmar exclusão
          </button>
          <button disabled={busy} onClick={() => setConfirmDelete(false)}>
            Cancelar
          </button>
        </ModalDialog>
      )}
    </div>
  );
}
