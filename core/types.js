// The shapes core's functions read and return, as JSDoc types (#102), so the
// apps' TypeScript checks their calls and needs no casts. Core stays plain
// JavaScript; a file that starts with `// @ts-check` is checked against these
// by the app's type check (`cd app && npx tsc --noEmit`). A shape names only
// what core reads, so a stored record, a draft (typed text) and a test's
// object all fit.

/**
 * @typedef {'left' | 'right'} Side
 *
 * A set as stored (numbers) or in a draft (typed text). Core reads its type,
 * side and whether it's logged; the values pass through.
 * @typedef {{ id?: string, type?: string, side?: string, done?: boolean,
 *   w?: any, r?: any, d?: any, t?: any, rir?: any, rpe?: any }} SetLike
 *
 * A logged set (a finished or running workout's): it has an id, which records point to.
 * @typedef {SetLike & { id: string }} LoggedSet
 *
 * An exercise in a workout, a routine or a draft.
 * @typedef {{ id?: string, exerciseId: string, sets: SetLike[], restSec?: number | null }} EntryLike
 *
 * An exercise in a workout: its sets are logged sets.
 * @typedef {{ id?: string, exerciseId: string, sets: LoggedSet[] }} LoggedEntry
 *
 * An exercise of the library.
 * @typedef {{ id: string, name?: string, category: string, bodyPart?: string,
 *   unilateral?: boolean, restSec?: number | null }} ExerciseLike
 *
 * The library: the Map by id the apps keep, or a list (a backup's).
 * @typedef {Map<string, ExerciseLike> | ExerciseLike[]} Exercises
 *
 * A finished workout.
 * @typedef {{ id: string, name?: string, startedAt: number, templateId?: string | null, exercises: LoggedEntry[] }} WorkoutLike
 *
 * A routine (stored as a template).
 * @typedef {{ exercises: EntryLike[] }} RoutineLike
 *
 * A set total: complete sets and the rows a left/right pairing leaves out (#54).
 * @typedef {{ sets: number, unpaired: number }} SetCount
 */

export {};
