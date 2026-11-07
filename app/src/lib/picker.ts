// Picking exercises opens its own screen (pick-exercises.tsx) and resolves
// once that screen closes: the ids picked, or null if it was cancelled.
import { router } from 'expo-router';
import type { Exercise } from '@/data/types';

/** Only family selection returns this sentinel; ordinary picks return exercise ids. */
export const PICK_NONE = '__none';
type Options = { multi?: boolean; title?: string; accepts?: (exercise: Exercise) => boolean; allowCreate?: boolean; currentExerciseId?: string;
  /** Family selection: the current choice (a family id, an exercise id or PICK_NONE) is ticked. */
  familySelection?: boolean; selected?: string };
type Pick = Options & { resolve: (ids: string[] | null) => void };
// A new exercise can open its own family picker while the calling workout's
// picker waits beneath it. Each screen finishes only its own request.
const pending: Pick[] = [];

export function pickExercises(o: Options = {}): Promise<string[] | null> {
  return new Promise((resolve) => {
    pending.push({ ...o, resolve });
    router.push('/pick-exercises');
  });
}

export const currentPick = () => pending[pending.length - 1] || null;

export function finishPick(ids: string[] | null, pick = currentPick()) {
  if (!pick) return;
  const at = pending.indexOf(pick);
  if (at < 0) return;
  pending.splice(at, 1);
  pick.resolve(ids && ids.length ? ids : null);
}
