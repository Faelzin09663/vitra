import React from 'react';
import { Camera, Sparkles, X, Check, Utensils } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Meal } from '../lib/store';
import type { MealAnalysis } from '../../supabase/functions/_shared/meal-schema';

async function imageData(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Escolha uma foto de até 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível preparar a foto.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', 0.78);
    if (result.length > 1400000) throw new Error('A foto ficou muito grande. Escolha uma imagem menor.');
    return result;
  } catch (err) { throw new Error(err instanceof Error && /foto|grande|MB/.test(err.message) ? err.message : 'Não foi possível abrir a foto. Use JPEG, PNG ou WebP.'); }
  finally { URL.revokeObjectURL(url); }
}
export function MealAnalyzer({ onSave }: { onSave: (meal: Meal) => void }) {
  const [open, setOpen] = React.useState(false), [description, setDescription] = React.useState(''), [image, setImage] = React.useState(''), [error, setError] = React.useState(''), [busy, setBusy] = React.useState(false), [analysis, setAnalysis] = React.useState<MealAnalysis | null>(null), [model, setModel] = React.useState('');
  async function analyze() {
    if (!supabase || busy) return;
    setBusy(true); setError(''); setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-meal', { body: { description, image } });
      if (error) {
        let message = 'Não foi possível analisar. Confira a conexão e a ativação da IA no Supabase.';
        if ('context' in error && error.context instanceof Response) { const body = await error.context.json().catch(() => null); if (body?.error) message = body.error; }
        throw new Error(message);
      }
      if (!data?.analysis) throw new Error('A IA não retornou uma estimativa.');
      setAnalysis(data.analysis); setModel(data.model);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível analisar.'); }
    finally { setBusy(false); }
  }
  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!analysis) return;
    const f = new FormData(e.currentTarget);
    onSave({ name: String(f.get('name')), calories: Number(f.get('calories')), protein: Number(f.get('protein')), carbs: Number(f.get('carbs')), fat: Number(f.get('fat')), estimated: true, notes: analysis.notes, analyzedBy: model });
    setOpen(false); setAnalysis(null); setDescription(''); setImage('');
  }
  return <><button className="ai-launch" onClick={() => setOpen(true)}><span className="tile purple"><Sparkles size={21}/></span><div><strong>Analisar refeição com IA</strong><span>Foto ou descrição · NVIDIA Nemotron</span></div><Camera size={22}/></button>{open && <div className="overlay"><section className="modal ai-modal" role="dialog" aria-modal="true" aria-label="Analisar refeição"><div className="section-heading"><h2><Sparkles size={19}/>Sua refeição, mais fácil de registrar</h2><button aria-label="Fechar análise" disabled={busy} onClick={() => setOpen(false)}><X size={20}/></button></div>{analysis ? <><div className="analysis-summary"><span className="tile orange"><Utensils size={20}/></span><p>{analysis.notes}</p></div><div className="food-chips">{analysis.foods.map((food, i) => <span key={i}>{food.name} · {food.portion}</span>)}</div><p className="estimate-note">Estimativa por IA · Revise alimentos, porções e valores antes de salvar.</p><form onSubmit={save}><label>Nome da refeição<input name="name" defaultValue={analysis.name} required maxLength={120}/></label><label>Calorias (kcal)<input name="calories" type="number" min="0" max="10000" defaultValue={analysis.calories} required/></label><div className="form-grid">{(['protein', 'carbs', 'fat'] as const).map((key, i) => <label key={key}>{['Proteínas', 'Carboidratos', 'Gorduras'][i]} (g)<input name={key} type="number" min="0" max="2000" defaultValue={analysis[key]} required/></label>)}</div><button className="primary submit">Confirmar e salvar refeição <Check size={17}/></button><button type="button" className="text" onClick={() => setAnalysis(null)}>Voltar para a análise</button></form></> : <><label>Descreva os alimentos e as porções<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={3} placeholder="Ex.: 150 g de arroz, 100 g de feijão e um filé de frango grelhado" disabled={busy}/></label><label className="photo-input"><Camera size={24}/><span>{image ? 'Trocar foto da refeição' : 'Escolher ou tirar uma foto'}</span><input type="file" accept="image/*" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { setImage(await imageData(file)); setAnalysis(null); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'Foto inválida.'); } }}/></label>{image && <div className="meal-photo"><img src={image} alt="Foto da refeição para análise"/><button disabled={busy} aria-label="Remover foto" onClick={() => setImage('')}><X size={16}/></button></div>}<p className="estimate-note">Ao analisar, a foto e a descrição são enviadas à NVIDIA. A foto não fica salva no Vitra. Os valores são estimativas que você confirma.</p>{error && <div role="alert" className="auth-alert">{error}</div>}<button className="primary submit" disabled={busy || (!description.trim() && !image)} onClick={analyze}>{busy ? 'Analisando sua refeição…' : 'Analisar refeição'}<Sparkles size={17}/></button></>}</section></div>}</>;
}
