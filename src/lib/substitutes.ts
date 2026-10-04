import { exercises, type CatalogExercise, type Equipment, type Muscle } from '../data/exercises';
import { matchExercise } from './exerciseCatalog';
import type { Store } from './store';
export function suggestSubstitutes(exercise:CatalogExercise,{equipmentAvailable,avoidMuscles=[]}:{equipmentAvailable:Equipment[];avoidMuscles?:Muscle[]},catalog=exercises) {
 const eligible=catalog.filter(ex=>ex.id!==exercise.id&&ex.muscleGroup===exercise.muscleGroup&&equipmentAvailable.includes(ex.equipment)&&![ex.primaryMuscle,...ex.secondaryMuscles].some(m=>avoidMuscles.includes(m)));
 const strict=eligible.filter(ex=>ex.movementPattern===exercise.movementPattern),relaxed=strict.length===0;
 const candidates=relaxed?eligible:strict;
 return candidates.map(ex=>({exercise:ex,relaxed,score:2*Number(ex.primaryMuscle===exercise.primaryMuscle)+Number(ex.difficulty===exercise.difficulty)+Number(ex.equipment!==exercise.equipment)+ex.secondaryMuscles.filter(m=>exercise.secondaryMuscles.includes(m)).length*.5})).sort((a,b)=>b.score-a.score||a.exercise.name.localeCompare(b.exercise.name,'pt-BR')).slice(0,5);
}
export function replaceSessionExercise(store:Store,index:number,replacement:CatalogExercise,reason:string,alsoModel=false):Partial<Store> {
 if(!store.activeWorkout)return {};
 const original=store.activeWorkout.exercises?.[index];if(!original)return {};
 const entry={...original,name:replacement.name,exerciseId:replacement.id,replacedFrom:original.replacedFrom||original.exerciseId||matchExercise(original.name)?.id||original.name,replaceReason:reason};
 const exercises=store.activeWorkout.exercises!.map((ex,i)=>i===index?entry:ex);
 // A completed set belongs to the original exercise; disallow changing its identity.
 if(Object.entries(store.sets).some(([key,set])=>key.startsWith(`${index}-`)&&set.done))throw new Error('Substitua antes de concluir séries deste exercício.');
 const sets=Object.fromEntries(Object.entries(store.sets).filter(([key])=>!key.startsWith(`${index}-`)));
 return {activeWorkout:{...store.activeWorkout,exercises},sets,...(alsoModel?{workouts:store.workouts.map(w=>w.id===store.activeWorkout!.workoutId?{...w,exercises:w.exercises.map((ex,i)=>i===index?{...ex,name:replacement.name,exerciseId:replacement.id}:ex)}:w)}:{})};
}
export type PainReport={id:string;user_id:string;date:string;region:string;exercise_id:string|null;intensity:number;note:string};
export function recurringPain(reports:Pick<PainReport,'date'|'region'>[],today:string){const end=Date.parse(`${today}T00:00:00Z`),start=end-13*86400000;const counts:Record<string,number>={};for(const r of reports){const time=Date.parse(`${r.date}T00:00:00Z`);if(time>=start&&time<=end)counts[r.region]=(counts[r.region]||0)+1;}return Object.entries(counts).filter(([,n])=>n>=3).map(([region,count])=>({region,count}));}
