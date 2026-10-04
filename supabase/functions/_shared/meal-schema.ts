export type MealAnalysis = {
  name: string; calories: number; protein: number; carbs: number; fat: number;
  confidence: 'low' | 'medium' | 'high'; notes: string;
  foods: { name: string; portion: string }[];
  needsClarification: boolean;
};
export const MEAL_SCHEMA: Record<string, unknown> = {
  type: 'object', additionalProperties: false,
  required: ['name', 'calories', 'protein', 'carbs', 'fat', 'confidence', 'notes', 'foods', 'needsClarification'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    calories: { type: 'number', minimum: 0, maximum: 10000 },
    protein: { type: 'number', minimum: 0, maximum: 1000 },
    carbs: { type: 'number', minimum: 0, maximum: 2000 },
    fat: { type: 'number', minimum: 0, maximum: 1000 },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    notes: { type: 'string', minLength: 1, maxLength: 1200 },
    needsClarification: { type: 'boolean' },
    foods: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['name', 'portion'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, portion: { type: 'string', minLength: 1, maxLength: 120 } } } },
  },
};
function text(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}
export function parseMealAnalysis(raw: string): MealAnalysis {
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Estimativa inválida.');
  const fields = Object.keys(MEAL_SCHEMA.properties as object);
  if (Object.keys(data).some(key => !fields.includes(key))) throw new Error('Campo inesperado.');
  if (!text(data.name, 120) || !text(data.notes, 1200) || !['low', 'medium', 'high'].includes(data.confidence) || typeof data.needsClarification !== 'boolean' || !Array.isArray(data.foods) || data.foods.length > 20) throw new Error('Estimativa incompleta.');
  for (const [key, max] of [['calories', 10000], ['protein', 1000], ['carbs', 2000], ['fat', 1000]] as const) {
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key]) || data[key] < 0 || data[key] > max) throw new Error('Valores nutricionais inválidos.');
  }
  const foods = data.foods.map((food: unknown) => {
    if (!food || typeof food !== 'object' || Array.isArray(food)) throw new Error('Alimento inválido.');
    const f = food as Record<string, unknown>;
    if (Object.keys(f).some(key => !['name', 'portion'].includes(key)) || !text(f.name, 120) || !text(f.portion, 120)) throw new Error('Porção inválida.');
    return { name: f.name.trim(), portion: f.portion.trim() };
  });
  return { name: data.name.trim(), calories: Math.round(data.calories), protein: Math.round(data.protein), carbs: Math.round(data.carbs), fat: Math.round(data.fat), confidence: data.confidence, notes: data.notes.trim(), foods, needsClarification: data.needsClarification };
}