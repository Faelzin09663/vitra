import { normalizeText } from '../data/exercises';
import type { Exercise,SetRecord,Store,WorkoutLog } from './store';
import {effective} from './analytics';
export {estimate1RM,effective,setVolume} from './analytics';
export function sameExercise(a:Exercise,b:Exercise){return a.exerciseId&&b.exerciseId?a.exerciseId===b.exerciseId:normalizeText(a.name)===normalizeText(b.name);}
export function historySets(logs:WorkoutLog[],exercise:Exercise,workoutId?:string){return logs.filter(log=>!workoutId||log.workoutId===workoutId||!log.workoutId).flatMap(log=>log.exercises.flatMap((ex,i)=>sameExercise(ex,exercise)?Object.entries(log.sets).filter(([key,set])=>key.startsWith(`${i}-`)&&effective(set)).map(([,set])=>set):[]));}
export function suggestSet(store:Store,index:number,series:number):SetRecord {
 const key=`${index}-${series}`;if(store.sets[key])return {...store.sets[key]};
 const exercise=store.activeWorkout?.exercises?.[index];if(!exercise)return {load:0,reps:10,done:false,type:'normal'};
 const previous=historySets(store.workoutLogs,exercise,store.activeWorkout?.workoutId).at(-1);
 const current=Object.entries(store.sets).filter(([key,set])=>key.startsWith(`${index}-`)&&effective(set)).at(-1)?.[1];
 return {...(current||previous||{load:0,reps:Number(exercise.reps.match(/\d+/)?.[0]||10)}),done:false,type:'normal'};
}
export function completeSet(store:Store,index:number,series:number,set:SetRecord,now=Date.now()):Partial<Store>{if(!store.activeWorkout||store.activeWorkout.pausedAt)return {};if(!Number.isFinite(set.load)||set.load<0||set.load>2000||!Number.isInteger(set.reps)||set.reps<1||set.reps>500)throw new Error('Confira a carga e as repetições.');return {sets:{...store.sets,[`${index}-${series}`]:{...set,done:true}},activeWorkout:{...store.activeWorkout,restUntil:new Date(now+(store.activeWorkout.exercises?.[index]?.restSeconds??60)*1000).toISOString()}};}
export function undoSet(store:Store,key:string,previous:SetRecord|undefined,restUntil:string|null):Partial<Store>{const sets={...store.sets};if(previous)sets[key]={...previous};else delete sets[key];return {sets,...(store.activeWorkout?{activeWorkout:{...store.activeWorkout,restUntil}}:{})};}
export function adjustRest(store:Store,seconds:number,now=Date.now()):Partial<Store>{return store.activeWorkout?{activeWorkout:{...store.activeWorkout,restUntil:new Date(Math.max(now,Date.parse(store.activeWorkout.restUntil||new Date(now).toISOString())+seconds*1000)).toISOString()}}:{};}
