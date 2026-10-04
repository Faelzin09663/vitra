import { describe,it,expect } from 'vitest';
import { exercises } from '../src/data/exercises';
import { programs,importProgram } from '../src/data/programs';
import { searchExercises,matchExercise,linkLegacyExercise } from '../src/lib/exerciseCatalog';
import { createInitialStore } from '../src/lib/store';
describe('biblioteca e programas',()=>{
 it('tem pelo menos 120 exercícios completos e IDs únicos',()=>{expect(exercises.length).toBeGreaterThanOrEqual(120);expect(new Set(exercises.map(e=>e.id)).size).toBe(exercises.length);exercises.forEach(e=>expect(e.instructions.length).toBeGreaterThanOrEqual(3));});
 it('busca sem acentos e combina filtros',()=>{expect(searchExercises(exercises,'triceps',{equipment:'polia',muscle:'tríceps',pattern:'isolado'}).map(e=>e.name)).toContain('Tríceps corda');expect(searchExercises(exercises,'bench press')[0].name).toBe('Supino reto');});
 it('associa legado sem modificar nome ou logs',()=>{const old={name:'Supino réto',sets:3,reps:'10'};expect(linkLegacyExercise(old).exerciseId).toBe('supino-reto');expect(old).not.toHaveProperty('exerciseId');expect(matchExercise('Supino ret')).not.toBeNull();expect(matchExercise('Minha invenção')).toBeNull();});
 it('importa sem sobrescrever e renomeia colisões',()=>{const old=createInitialStore().workouts;const once=importProgram(programs[0],old,[[1],[3],[5]]);const twice=importProgram(programs[0],once.workouts,[]);expect(twice.workouts.slice(0,old.length)).toEqual(old);expect(twice.renamed).toHaveLength(3);expect(once.workouts.at(-1)?.weekdays).toEqual([5]);expect(new Set(twice.workouts.map(w=>w.id)).size).toBe(twice.workouts.length);});
});
