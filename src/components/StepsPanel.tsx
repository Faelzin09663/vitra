import React from 'react';
import { Footprints, Plus, RefreshCw, Smartphone, Copy, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { localDateKey } from '../lib/store';
type StepDay = { recorded_on: string; steps: number; source: string };
export function StepsPanel({ userId }: { userId: string }) {
  const [rows, setRows] = React.useState<StepDay[]>([]), [error, setError] = React.useState(''), [loading, setLoading] = React.useState(true), [attempt, setAttempt] = React.useState(0), [open, setOpen] = React.useState(false), [manual, setManual] = React.useState(false), [busy, setBusy] = React.useState(false), [token, setToken] = React.useState(''), [copyMessage, setCopyMessage] = React.useState('');
  const today = localDateKey();
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-steps`;
  React.useEffect(() => {
    let active = true;
    if (!supabase) return;
    setLoading(true);
    supabase.from('daily_steps').select('recorded_on,steps,source').eq('user_id', userId).order('recorded_on', { ascending: false }).limit(7).then(({ data, error }) => {
      if (!active) return;
      if (error) setError('Aplique a migração de integrações para habilitar os passos.');
      else { setRows(data || []); setError(''); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId, attempt]);
  const current = rows.find(r => r.recorded_on === today);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setError('');
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from('daily_steps').upsert({ user_id: userId, recorded_on: String(f.get('date')), steps: Number(f.get('steps')), source: 'manual', updated_at: new Date().toISOString() }, { onConflict: 'user_id,recorded_on' });
    if (error) setError('Não foi possível salvar os passos. Confira a conexão e a migração.');
    else { setManual(false); setAttempt(v => v + 1); }
    setBusy(false);
  }
  async function generateToken() {
    if (!supabase) return; setBusy(true); setError(''); setCopyMessage('');
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const raw = `vitra_health_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const { error } = await supabase.from('health_connections').upsert({ user_id: userId, token_hash: hash, expires_at: new Date(Date.now() + 90 * 86400000).toISOString() });
      if (error) throw error; setToken(raw);
    } catch { setError('Não foi possível gerar o token. Confira a conexão e a migração.'); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!supabase) return; setBusy(true);
    const { error } = await supabase.from('health_connections').delete().eq('user_id', userId);
    if (error) setError('Não foi possível desconectar. Tente novamente.');
    else { setToken(''); setCopyMessage('Sincronização desconectada.'); }
    setBusy(false);
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setCopyMessage('Copiado.'); } catch { setCopyMessage('Selecione e copie o texto manualmente.'); } }
  return <section className="panel steps-panel"><div className="section-heading"><h2><Footprints size={19}/>Passos do dia</h2><button className="text" onClick={() => setAttempt(v => v + 1)}><RefreshCw size={14}/>Atualizar</button></div><div className="steps-total">{loading ? '…' : (current?.steps ?? 0).toLocaleString('pt-BR')} <small>passos</small></div><p className="sub">{current ? current.source === 'manual' ? 'Registrado manualmente' : 'Enviado pelo Saúde via Atalhos' : 'Nenhum registro de hoje. Conecte o Saúde ou registre manualmente.'}</p><div className="steps-actions"><button className="text" onClick={() => { setOpen(true); setCopyMessage(''); }}><Smartphone size={15}/>Conectar Saúde pelo Atalhos</button><button className="text" onClick={() => setManual(true)}><Plus size={15}/>Registrar passos</button></div>{error && <p className="inline-error" role="alert">{error}</p>}{rows.length > 0 && <div className="steps-history">{rows.map(r => <div key={r.recorded_on}><span>{new Date(`${r.recorded_on}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span><strong>{r.steps.toLocaleString('pt-BR')}</strong></div>)}</div>}
    {manual && <div className="overlay"><section className="modal" role="dialog" aria-modal="true" aria-label="Registrar passos"><div className="section-heading"><h2>Registrar passos</h2><button aria-label="Fechar" onClick={() => setManual(false)}><X size={20}/></button></div><form onSubmit={save}><label>Dia<input name="date" type="date" defaultValue={today} max={today} required/></label><label>Total de passos<input name="steps" type="number" min="0" max="300000" defaultValue={current?.steps || 0} required/></label><p className="estimate-note">Este total substitui o registro do dia, evitando duplicações.</p>{error && <p className="inline-error" role="alert">{error}</p>}<button className="primary submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar passos'}</button></form></section></div>}
    {open && <div className="overlay"><section className="modal health-modal" role="dialog" aria-modal="true" aria-label="Conectar Apple Saúde"><div className="section-heading"><h2><Smartphone size={18}/>Saúde → Vitra</h2><button aria-label="Fechar" disabled={busy} onClick={() => { setOpen(false); setToken(''); }}><X size={20}/></button></div><p className="estimate-note">O Safari não acessa o Saúde diretamente. Você autoriza o app Atalhos a buscar passos e enviar apenas o total diário ao Vitra.</p><ol className="shortcut-guide"><li>Gere o token abaixo. Ele permite apenas enviar passos e expira em 90 dias.</li><li>No app Atalhos, crie um atalho com <strong>Buscar Amostras de Saúde</strong>: tipo Passos, data de início de hoje e sem limite. Escolha uma única origem (iPhone ou Apple Watch) para evitar somar registros sobrepostos.</li><li>Obtenha os valores das amostras e use <strong>Calcular Estatísticas → Soma</strong>. Formate a data como <strong>yyyy-MM-dd</strong>.</li><li>Use <strong>Obter Conteúdo de URL</strong>, método POST e corpo JSON com <strong>date</strong> (data formatada) e <strong>steps</strong> (soma numérica).</li><li>No cabeçalho, use <strong>Authorization: Bearer SEU_TOKEN</strong>. Adicione também <strong>Content-Type: application/json</strong>.</li><li>Execute o atalho e toque em Atualizar no Vitra. Você pode criar uma automação pessoal diária no Atalhos.</li></ol><label>URL de sincronização<input readOnly value={endpoint}/></label><button className="text" onClick={() => copy(endpoint)}><Copy size={14}/>Copiar URL</button>{token ? <><label className="token-label">Token (copie agora; não será mostrado novamente)<input readOnly value={token}/></label><button className="text" onClick={() => copy(`Bearer ${token}`)}><Copy size={14}/>Copiar Authorization</button></> : <button className="primary submit" disabled={busy} onClick={generateToken}>{busy ? 'Gerando…' : 'Gerar ou substituir token'}</button>}<button className="text disconnect" disabled={busy} onClick={revoke}>Revogar sincronização</button>{copyMessage && <p className="estimate-note" role="status">{copyMessage}</p>}{error && <p className="inline-error" role="alert">{error}</p>}<p className="estimate-note">A função health-steps precisa estar publicada no Supabase. O envio repete o total do dia sem duplicá-lo. Mantenha o token privado.</p></section></div>}
  </section>;
}
