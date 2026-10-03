export type PersonalProfile = { fullName: string; age: number | null; heightCm: number | null; sex: 'male' | 'female' | ''; activity: number; calorieMode: 'manual' | 'automatic' };
export const emptyProfile: PersonalProfile = { fullName: '', age: null, heightCm: null, sex: '', activity: 1.2, calorieMode: 'manual' };
export const activityLevels = [{ value: 1.2, label: 'Sedentário', detail: 'Pouca atividade física' }, { value: 1.375, label: 'Levemente ativo', detail: 'Atividade leve, 1–3 dias/semana' }, { value: 1.55, label: 'Moderadamente ativo', detail: 'Atividade moderada, 3–5 dias/semana' }, { value: 1.725, label: 'Muito ativo', detail: 'Atividade intensa, 6–7 dias/semana' }];
export function nutritionEstimates(profile: PersonalProfile, weight: number | null) {
  const validWeight = weight !== null && Number.isFinite(weight) && weight > 0 && weight <= 500;
  const validHeight = profile.heightCm !== null && Number.isFinite(profile.heightCm) && profile.heightCm >= 100 && profile.heightCm <= 250;
  const adult = profile.age !== null && Number.isInteger(profile.age) && profile.age >= 18 && profile.age <= 100;
  const bmi = validWeight && validHeight ? weight! / ((profile.heightCm! / 100) ** 2) : null;
  const bmiLabel = !adult || bmi === null ? null : bmi < 18.5 ? 'Abaixo da faixa de referência' : bmi < 25 ? 'Faixa de referência' : bmi < 30 ? 'Acima da faixa de referência' : 'IMC elevado';
  const canCalculate = validWeight && validHeight && adult && ['male', 'female'].includes(profile.sex) && activityLevels.some(l => l.value === profile.activity);
  const basal = canCalculate ? 10 * weight! + 6.25 * profile.heightCm! - 5 * profile.age! + (profile.sex === 'male' ? 5 : -161) : null;
  return { bmi, bmiLabel, basal: basal !== null && basal > 0 ? Math.round(basal) : null, daily: basal !== null && basal > 0 ? Math.round(basal * profile.activity) : null };
}
