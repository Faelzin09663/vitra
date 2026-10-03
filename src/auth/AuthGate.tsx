import React from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Check, Eye, EyeOff, Leaf, LockKeyhole, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ThemeToggle } from '../theme/ThemeControls';

type Mode = 'login' | 'signup' | 'forgot' | 'recovery';
export function authMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar.';
  if (/already registered|already been registered/i.test(message)) return 'Este e-mail já tem uma conta. Entre com sua senha.';
  if (/rate limit|too many requests|after .* seconds/i.test(message)) return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  if (/password.*(least|short|weak)/i.test(message)) return 'Use uma senha de pelo menos 8 caracteres.';
  if (/fetch|network/i.test(message)) return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
  return 'Não foi possível concluir. Confira seus dados e tente novamente.';
}

export function AuthGate({ children }: { children: (user: User, signOut: () => Promise<void>) => React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(Boolean(supabase));
  const [mode, setMode] = React.useState<Mode>('login');
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!supabase) return;
    let active = true;
    // Subscribe before reading the session so confirmation/recovery redirects are handled.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setMode('recovery');
      if (event === 'SIGNED_OUT') setMode('login');
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError('Não foi possível verificar sua sessão. Tente novamente.');
      else setUser(data.session?.user ?? null);
      setLoading(false);
    }).catch(() => { if (active) { setError('Não foi possível verificar sua sessão. Tente novamente.'); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, [attempt]);

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Não foi possível sair. Tente novamente.');
    setUser(null);
    setMode('login');
    setMessage('');
  };
  function switchMode(next: Mode) { setMode(next); setError(''); setMessage(''); setVisible(false); }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || busy) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const email = String(f.get('email') || '').trim();
    const password = String(f.get('password') || '');
    const name = String(f.get('name') || '').trim();
    if (mode === 'signup' && name.length < 2) { setError('Informe seu nome com pelo menos 2 caracteres.'); return; }
    if ((mode === 'signup' || mode === 'recovery') && password !== f.get('confirm')) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) { setMessage('Confira seu e-mail para confirmar o cadastro. Se já possui uma conta, entre com sua senha.'); form.reset(); }
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage('Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.'); form.reset();
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMode('login'); setMessage('Senha atualizada.');
      }
    } catch (err) { setError(authMessage(err instanceof Error ? err.message : '')); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="auth-loading" role="status"><span className="spinner"/>Abrindo seu espaço…</div>;
  if (user && mode !== 'recovery') return children(user, signOut);
  return <div className="auth-layout"><ThemeToggle className="auth-theme-toggle"/><section className="auth-story"><a className="brand" href="/">vitra<span>.</span></a><div className="auth-story-content"><span className="auth-kicker"><Leaf size={17}/>SEU ESPAÇO DE BEM-ESTAR</span><h1>Sua melhor versão.<br/>Um dia de cada vez.</h1><p>Seu treino, sua alimentação e sua evolução em um só lugar. Agora com um espaço só seu.</p><div className="auth-benefits">{['Treine no seu ritmo', 'Construa hábitos que fazem sentido', 'Acompanhe cada conquista'].map(t => <div key={t}><Check size={17}/>{t}</div>)}</div></div><span className="auth-story-footer">Pequenos hábitos. Grandes mudanças.</span></section><section className="auth-form-section"><div className="auth-card"><span className="tile blue"><LockKeyhole size={23}/></span><h2>{mode === 'signup' ? 'Seu próximo passo começa aqui.' : mode === 'forgot' ? 'Vamos recuperar seu acesso.' : mode === 'recovery' ? 'Escolha sua nova senha.' : 'Que bom ter você aqui.'}</h2><p>{mode === 'signup' ? 'Crie sua conta e comece a cuidar de você.' : mode === 'forgot' ? 'Enviaremos um link de recuperação para seu e-mail.' : mode === 'recovery' ? 'Use uma senha de pelo menos 8 caracteres.' : 'Entre para continuar sua jornada com o Vitra.'}</p>{!supabase ? <div className="auth-alert" role="status">A conexão com o Supabase ainda precisa ser configurada. Preencha as variáveis do arquivo .env.local para habilitar o cadastro.</div> : <><form key={mode} onSubmit={submit}><fieldset disabled={busy}>{mode === 'signup' && <label>Nome<input name="name" autoComplete="name" placeholder="Como você se chama?" minLength={2} maxLength={100} required/></label>}{mode !== 'recovery' && <label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" maxLength={254} required/></label>}{mode !== 'forgot' && <label>Senha<div className="password-field"><input name="password" type={visible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={128} placeholder={mode === 'login' ? 'Sua senha' : 'Pelo menos 8 caracteres'} required/><button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>}{(mode === 'signup' || mode === 'recovery') && <label>Confirmar senha<input name="confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} placeholder="Repita sua senha" required/></label>}{mode === 'login' && <button type="button" className="text forgot-link" onClick={() => switchMode('forgot')}>Esqueci minha senha</button>}{error && <div className="auth-alert" role="alert">{error}</div>}{message && <div className="auth-success" role="status"><Mail size={18}/>{message}</div>}<button className="primary auth-submit" type="submit">{busy ? 'Aguarde…' : mode === 'signup' ? 'Criar minha conta' : mode === 'forgot' ? 'Enviar link de recuperação' : mode === 'recovery' ? 'Salvar nova senha' : 'Entrar'}{!busy && <ArrowRight size={18}/>}</button></fieldset></form>{mode !== 'recovery' && <div className="auth-switch">{mode === 'login' ? 'Ainda não tem uma conta?' : mode === 'signup' ? 'Já tem uma conta?' : 'Lembrou sua senha?'}<button disabled={busy} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Cadastre-se' : 'Entrar'}</button></div>}{error && mode === 'login' && <button className="text" onClick={() => { setError(''); setLoading(true); setAttempt(a => a + 1); }}>Verificar sessão novamente</button>}</>}<div className="auth-footnote">Feito para o seu ritmo.</div></div></section></div>;
}
