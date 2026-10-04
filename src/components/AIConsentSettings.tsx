import React from 'react';
import { AI_CONSENT_VERSION, hasAIConsent, type AIConsent } from '../../supabase/functions/_shared/ai-consent';
export function AIConsentSettings({ consent, age, onChange }: { consent: AIConsent | null; age: number | null; onChange: (value: AIConsent | null) => Promise<void> }) {
  const [checked, setChecked] = React.useState(false), [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
  const enabled = hasAIConsent(consent), adult = age !== null && Number.isInteger(age) && age >= 18 && age <= 100;
  async function change() {
    setBusy(true); setError('');
    try { await onChange(enabled ? null : { version: AI_CONSENT_VERSION, grantedAt: new Date().toISOString() }); }
    catch { setError('Não foi possível salvar sua escolha. Verifique a conexão e tente novamente antes de analisar.'); }
    finally { setBusy(false); }
  }
  return <section className="ai-consent" aria-label="Privacidade da inteligência artificial">
    <h2>Você escolhe usar IA</h2>
    <p>Coach e chat enviam um resumo de treino, alimentação, peso, check-ins, hábitos e desconforto ao Google, somente quando você solicitar. Nome, e-mail e fotos não entram nesse resumo. Este termo atualizado também abrange análise de refeições.</p><p>Ao clicar em Analisar, a descrição e a foto da refeição serão enviadas ao Google (Gemini). A foto fica somente na memória desta página até o envio e não é salva no Vitra.</p>
    <p>O serviço deve usar o plano pago, que não usa esse conteúdo para melhorar produtos. O Google pode retê-lo por um período limitado para segurança. Evite fotos com pessoas ou informações pessoais.</p>
    <p>Os resultados são estimativas e não substituem um profissional de saúde. Você pode desativar a IA aqui ou no Perfil a qualquer momento. Registros manuais continuam disponíveis.</p>
    {!adult && <p role="status">Para usar IA, complete e salve seu perfil com idade de 18 anos ou mais.</p>}
    {enabled ? <p role="status">IA autorizada em {new Date(consent!.grantedAt).toLocaleDateString('pt-BR')}.</p> : <label className="consent-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} disabled={busy || !adult}/>Autorizo o envio do resumo e da refeição ao Google para análise.</label>}
    {error && <p role="alert" className="auth-alert">{error}</p>}
    <button type="button" className={enabled ? 'text' : 'primary'} disabled={busy || (!enabled && (!checked || !adult))} onClick={change}>{busy ? 'Salvando sua escolha…' : enabled ? 'Desativar IA' : 'Autorizar IA'}</button>
  </section>;
}
