// Picking exercises opens its own screen (pick-exercises.tsx) and resolves
// once that screen closes: the ids picked, or null if it was cancelled.
import { router } from 'expo-router';
import type { Exercise } from '@/data/types';

type Options = { multi?: boolean; title?: string; accepts?: (exercise: Exercise) => boolean; allowCreate?: boolean; currentExerciseId?: string };
type Pick = Options & { resolve: (ids: string[] | null) => void };
let pending: Pick | null = null;

export function pickExercises(o: Options = {}): Promise<string[] | null> {
  pending?.resolve(null);
  return new Promise((resolve) => {
    pending = { ...o, resolve };
    router.push('/pick-exercises');
  });
}

export const currentPick = () => pending;

export function finishPick(ids: string[] | null) {
  const p = pending;
  pending = null;
  p?.resolve(ids && ids.length ? ids : null);
}
