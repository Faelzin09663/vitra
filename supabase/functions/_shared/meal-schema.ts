export type MealAnalysis = { name: string; calories: number; protein: number; carbs: number; fat: number; confidence: 'low' | 'medium' | 'high'; notes: string; foods: { name: string; portion: string }[] };
export function parseMealAnalysis(raw: string): MealAnalysis {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('A IA não retornou uma estimativa válida.');
  const data = JSON.parse(cleaned.slice(start, end + 1));
  if (!data || typeof data !== 'object' || typeof data.name !== 'string' || !data.name.trim()) throw new Error('Estimativa sem nome de refeição.');
  for (const [key, max] of [['calories', 10000], ['protein', 1000], ['carbs', 2000], ['fat', 1000]] as const) {
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] < 0 || data[key] > max) throw new Error('A IA retornou valores nutricionais inválidos.');
  }
  return { name: data.name.trim().slice(0, 120), calories: Math.round(data.calories), protein: Math.round(data.protein), carbs: Math.round(data.carbs), fat: Math.round(data.fat), confidence: ['low', 'medium', 'high'].includes(data.confidence) ? data.confidence : 'low', notes: typeof data.notes === 'string' ? data.notes.slice(0, 1200) : 'Revise as porções antes de registrar.', foods: Array.isArray(data.foods) ? data.foods.slice(0, 20).filter((f: { name?: unknown; portion?: unknown }) => typeof f?.name === 'string' && typeof f?.portion === 'string').map((f: { name: string; portion: string }) => ({ name: f.name.slice(0, 120), portion: f.portion.slice(0, 120) })) : [] };
}
