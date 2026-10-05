import React from "react";
import {
  ArrowUp,
  Bot,
  Brain,
  Camera,
  Dumbbell,
  MessageSquare,
  PanelLeft,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
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
    [angle, setAngle] = React.useState("frente"),
    [historyOpen, setHistoryOpen] = React.useState(false),
    [settingsOpen, setSettingsOpen] = React.useState(false),
    [memoryOpen, setMemoryOpen] = React.useState(false),
    [inflight, setInflight] = React.useState<string | null>(null);
  const generation = React.useRef(0),
    alive = React.useRef(true),
    sending = React.useRef(false),
    pending = React.useRef<{ key: string; id: string } | null>(null),
    restored = React.useRef(false),
    scrollAfterLoad = React.useRef(true),
    thread = React.useRef<HTMLDivElement>(null),
    composer = React.useRef<HTMLTextAreaElement>(null);
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
    if (!conversations.loading && !restored.current) {
      restored.current = true;
      if (conversations.rows.length) {
        setConversation(conversations.rows.at(-1)!.id);
      }
    }
  }, [conversations.rows, conversations.loading, conversation]);
  React.useEffect(() => {
    if (scrollAfterLoad.current && thread.current) {
      thread.current.scrollTop = thread.current.scrollHeight;
    }
  }, [messages, inflight]);
  React.useEffect(() => {
    if (composer.current) {
      composer.current.style.height = "auto";
      composer.current.style.height = `${
        Math.min(composer.current.scrollHeight || 52, 160)
      }px`;
    }
  }, [question, enabled]);
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
      scrollAfterLoad.current = !append;
      const previousHeight = thread.current?.scrollHeight || 0;
      const previousTop = thread.current?.scrollTop || 0;
      setMessages((old) => append ? [...rows, ...old] : rows);
      if (append) {
        requestAnimationFrame(() => {
          if (version === generation.current && thread.current) {
            thread.current.scrollTop = previousTop +
              thread.current.scrollHeight - previousHeight;
          }
        });
      }
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
    else setLoading(false);
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
    if (
      !enabled || busy || loading || conversations.loading || preparing ||
      sending.current || !question.trim()
    ) {
      return;
    }
    sending.current = true;
    const prompt = question.trim();
    scrollAfterLoad.current = true;
    setInflight(prompt);
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
    if (alive.current) setInflight(null);
    sending.current = false;
  }
  function chooseConversation(id: string) {
    if (id && id === conversation) {
      setHistoryOpen(false);
      return;
    }
    setConversation(id);
    setQuestion("");
    setImage(null);
    setPhotoId(null);
    setHistoryOpen(false);
    setNotice("");
    setError("");
    pending.current = null;
    scrollAfterLoad.current = true;
  }
  function newConversation() {
    restored.current = true;
    chooseConversation("");
    requestAnimationFrame(() => composer.current?.focus());
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
  const memoryControls = (
    <section className="vit-memory">
      <h2>
        <Brain size={20} />Memórias que você escolheu
      </h2>
      <p className="estimate-note">
        Preferências e objetivos persistem entre conversas. O VIT usa até 20
        memórias ativas mais recentes; desative, edite ou apague quando quiser.
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
  );
  const currentTitle =
    conversations.rows.find((c) => c.id === conversation)?.title ||
    "Nova conversa";
  const suggestions = [
    {
      icon: Utensils,
      title: "Planejar uma refeição",
      detail: "Ideias que combinam com sua meta",
      question: "O que posso comer hoje dentro da minha meta?",
    },
    {
      icon: Dumbbell,
      title: "Revisar meu treino",
      detail: "Um próximo passo para evoluir",
      question: "Como melhorar meu treino desta semana?",
    },
    {
      icon: Sparkles,
      title: "Manter a constância",
      detail: "Hábitos possíveis para o seu dia",
      question: "Me ajude a manter meus hábitos.",
    },
  ];
  const historyControls = (
    <>
      <div className="vit-history-heading">
        <MessageSquare size={19} />
        <strong>Suas conversas</strong>
      </div>
      <button
        className="vit-new-chat"
        disabled={busy || preparing || conversations.loading}
        onClick={newConversation}
      >
        <Plus size={18} />Nova conversa
      </button>
      <nav className="vit-history-list" aria-label="Conversas do VIT">
        {conversations.loading && <p role="status">Carregando histórico…</p>}
        {!conversations.loading && !conversations.rows.length && (
          <p>Suas conversas aparecerão aqui.</p>
        )}
        {[...conversations.rows].reverse().map((c) => (
          <button
            key={c.id}
            className={conversation === c.id ? "selected" : ""}
            aria-current={conversation === c.id ? "page" : undefined}
            disabled={busy || preparing}
            title={c.title}
            onClick={() => chooseConversation(c.id)}
          >
            <MessageSquare size={16} />
            <span>{c.title}</span>
          </button>
        ))}
      </nav>
      {conversations.error && (
        <p className="inline-error" role="alert">{conversations.error}</p>
      )}
      <div className="vit-history-bottom">
        <span>
          <Brain size={16} />
          {memories.rows.filter((m) => m.active).length} memórias ativas
        </span>
        <p>Seu objetivo, uma conversa de cada vez.</p>
      </div>
    </>
  );
  return (
    <div className="vit-shell">
      <div className="vit-history">{historyControls}</div>
      <section className="vit-chat" aria-label="Chat com o VIT">
        <div className="vit-topbar">
          <button
            className="vit-icon-button vit-history-toggle"
            aria-label="Abrir histórico de conversas"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen(true)}
          >
            <PanelLeft size={20} />
          </button>
          <div className="vit-chat-title">
            <strong>
              <Sparkles size={19} />VIT
            </strong>
            <span title={currentTitle}>{currentTitle}</span>
          </div>
          <div className="vit-topbar-actions">
            <button
              className="vit-icon-button"
              aria-label="Nova conversa"
              title="Nova conversa"
              disabled={busy || preparing || conversations.loading}
              onClick={newConversation}
            >
              <Plus size={20} />
            </button>
            <button
              className="vit-icon-button"
              aria-label="Gerenciar memórias"
              title="Memórias"
              onClick={() => setMemoryOpen(true)}
            >
              <Brain size={20} />
            </button>
            <button
              className="vit-icon-button"
              aria-label="Autorizações e privacidade"
              title="Autorizações e privacidade"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={20} />
            </button>
            {conversation && (
              <button
                className="vit-icon-button"
                disabled={busy || loading}
                onClick={() => setConfirmDelete(true)}
                aria-label="Excluir conversa"
                title="Excluir conversa"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
        <div
          className="vit-thread"
          ref={thread}
          aria-label="Histórico da conversa"
          tabIndex={0}
        >
          <div className="vit-thread-inner">
            {older && (
              <button
                className="vit-load-older"
                disabled={loading || busy}
                onClick={() => void load(conversation, true)}
              >
                Carregar mensagens anteriores
              </button>
            )}
            {!messages.length && !loading && !inflight && (
              <div className="vit-welcome">
                <div className="vit-welcome-icon">
                  <Sparkles size={30} />
                </div>
                <p className="vit-welcome-kicker">SEU ASSISTENTE PESSOAL</p>
                <h2>Como posso ajudar hoje?</h2>
                <p>
                  Vamos cuidar do seu treino, da sua alimentação e dos pequenos
                  passos que fazem diferença.
                </p>
                {!enabled && (
                  <button
                    className="vit-enable"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings2 size={17} />Autorizar o VIT para começar
                  </button>
                )}
                <div className="vit-suggestions">
                  {suggestions.map((
                    { icon: Icon, title, detail, question: prompt },
                  ) => (
                    <button
                      key={title}
                      disabled={!enabled || busy}
                      onClick={() => {
                        setQuestion(prompt);
                        composer.current?.focus();
                      }}
                    >
                      <Icon size={20} />
                      <strong>{title}</strong>
                      <span>{detail}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <article key={m.id} className={`vit-message ${m.role}`}>
                {m.role === "assistant" && (
                  <span className="vit-assistant-avatar" aria-hidden="true">
                    <Sparkles size={18} />
                  </span>
                )}
                <div className="vit-message-body">
                  <strong className="vit-speaker">
                    {m.role === "user" ? "Você" : "VIT"}
                  </strong>
                  <p>{m.content}</p>
                  {m.photo_id && (
                    <small>
                      <Camera size={14} />Foto própria anexada · acervo privado
                      em Evolução → Fotos
                    </small>
                  )}
                  {m.role === "assistant" &&
                    m.metadata.memorySuggestions?.map((text, i) => (
                      <div className="vit-memory-proposal" key={i}>
                        <p>
                          <Brain size={15} />Lembrar: {text}
                        </p>
                        <button
                          disabled={busy ||
                            memories.rows.some((x) =>
                              x.content === text
                            )}
                          onClick={() => void saveMemory(text, null)}
                        >
                          {memories.rows.some((x) =>
                              x.content === text
                            )
                            ? "Memória salva"
                            : "Confirmar memória"}
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
                </div>
              </article>
            ))}
            {inflight && (
              <article
                className="vit-message user"
                aria-label="Mensagem em envio"
              >
                <div className="vit-message-body">
                  <strong className="vit-speaker">Você</strong>
                  <p>{inflight}</p>
                  <small>Enviando…</small>
                </div>
              </article>
            )}
            {(inflight || loading) && (
              <div className="vit-thinking" role="status">
                <span className="vit-assistant-avatar" aria-hidden="true">
                  <Bot size={18} />
                </span>
                <span>
                  {inflight ? "VIT está pensando…" : "Carregando conversa…"}
                </span>
                <i aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
        <div className="vit-composer-dock">
          {[error, conversations.error, memories.error].filter(Boolean).map((
            message,
            i,
          ) => <p key={i} className="inline-error" role="alert">{message}</p>)}
          {notice && <p className="vit-notice" role="status">{notice}</p>}
          {!enabled && (
            <p className="vit-composer-hint">
              Para conversar,{" "}
              <button onClick={() => setSettingsOpen(true)}>
                abra as autorizações do VIT
              </button>.
            </p>
          )}
          <form onSubmit={send} className="vit-composer">
            {preview && (
              <div className="vit-attachment">
                <img src={preview} alt="Foto própria selecionada para o VIT" />
                <div>
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
                </div>
                <p>
                  Ao enviar, a foto fica no acervo privado de Evolução. Remover
                  o anexo não apaga uma foto já salva.
                </p>
              </div>
            )}
            <label className="vit-composer-label">
              <span className="vit-sr-only">Converse com o VIT</span>
              <textarea
                ref={composer}
                value={question}
                maxLength={1500}
                rows={1}
                disabled={busy || !enabled}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" && !e.shiftKey &&
                    !e.nativeEvent.isComposing && !e.repeat &&
                    window.matchMedia?.("(min-width: 768px)").matches
                  ) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Pergunte ao VIT…"
                required
              />
            </label>
            <div className="vit-composer-toolbar">
              <label
                className={`vit-attach-button ${
                  !photosEnabled ? "disabled" : ""
                }`}
                title={photosEnabled
                  ? "Anexar foto própria"
                  : "Autorize fotos nas configurações"}
              >
                <Camera size={20} />
                <span>{preparing ? "Preparando…" : "Foto"}</span>
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
              {!photosEnabled && enabled && (
                <button
                  type="button"
                  className="vit-photo-authorize"
                  onClick={() => setSettingsOpen(true)}
                >
                  Autorizar fotos
                </button>
              )}
              <span className="vit-character-count">
                {question.length}/1500
              </span>
              <button
                type="submit"
                className="vit-send"
                aria-label="Enviar ao VIT"
                title="Enviar ao VIT"
                disabled={busy || loading || preparing ||
                  conversations.loading || !enabled || !question.trim()}
              >
                <ArrowUp size={21} />
              </button>
            </div>
          </form>
          <p className="vit-composer-note">
            O VIT pode errar. Revise as sugestões antes de aplicar.<span>
              Enter envia · Shift + Enter quebra a linha
            </span>
          </p>
        </div>
      </section>
      {historyOpen && (
        <ModalDialog
          label="Histórico de conversas do VIT"
          className="vit-history-dialog"
          onClose={() => setHistoryOpen(false)}
        >
          <div className="vit-dialog-heading">
            <h2>Histórico</h2>
            <button
              className="vit-icon-button"
              aria-label="Fechar histórico"
              onClick={() => setHistoryOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          {historyControls}
        </ModalDialog>
      )}
      {memoryOpen && (
        <ModalDialog
          label="Memórias do VIT"
          onClose={() => setMemoryOpen(false)}
        >
          <div className="vit-dialog-heading">
            <h2>Memórias</h2>
            <button
              className="vit-icon-button"
              aria-label="Fechar memórias"
              onClick={() => setMemoryOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
          {memoryControls}
        </ModalDialog>
      )}
      {settingsOpen && (
        <ModalDialog
          label="Autorizações e privacidade do VIT"
          onClose={() => setSettingsOpen(false)}
        >
          <div className="vit-dialog-heading">
            <h2>Autorizações e privacidade</h2>
            <button
              className="vit-icon-button"
              aria-label="Fechar autorizações"
              onClick={() => setSettingsOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <VitConsentSettings
            consent={store.preferences.vit_consent}
            bodyConsent={store.preferences.body_consent}
            age={store.profile.age}
            onConsent={onConsent}
            onBodyConsent={onBodyConsent}
          />
        </ModalDialog>
      )}
      {confirmDelete && (
        <ModalDialog
          label="Excluir conversa do VIT"
          onClose={() => {
            if (!busy) setConfirmDelete(false);
          }}
        >
          <h2>Excluir esta conversa?</h2>
          {error && <p className="inline-error" role="alert">{error}</p>}
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
                chooseConversation("");
                setConfirmDelete(false);
              })}
          >
            Confirmar exclusão
          </button>
          <button
            disabled={busy}
            onClick={() =>
              setConfirmDelete(false)}
          >
            Cancelar
          </button>
        </ModalDialog>
      )}
    </div>
  );
}
