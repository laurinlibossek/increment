// The app's data, in the same shape the Setlog web app stores and backs up:
// weights in kg, distances in km, times in seconds, timestamps in ms.

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type SetSide = 'left' | 'right';
export type Category =
  | 'barbell' | 'dumbbell' | 'machine' | 'weighted_bw' | 'assisted_bw' | 'reps' | 'cardio' | 'duration';

export interface WorkSet {
  id: string;
  type: SetType;
  side?: SetSide;
  w?: number;
  r?: number;
  d?: number;
  t?: number;
  rpe?: number;
  /** reps left in reserve: 0–3 (3 = "3+"); older sets may have RPE instead */
  rir?: number;
  /** when the person logged it (ms; #43): set by the tick, Log or Next, gone on uncheck; older and imported sets have none */
  doneAt?: number;
}

export interface Entry {
  id: string;
  exerciseId: string;
  sets: WorkSet[];
  notes?: string;
  supersetId?: string;
  restSec?: number;
  focus?: string;
}

export interface Workout {
  id: string;
  name: string;
  notes?: string;
  startedAt: number;
  endedAt: number;
  templateId: string | null;
  exercises: Entry[];
  source?: string;
}

/** A routine's set: a target, so nothing that only a performed set has (id, logging time). */
export type TemplateSet = Omit<WorkSet, 'id' | 'doneAt'> & {
  /** a rep range's fixed bounds (#44, core/rep-range.js): whole numbers, rMin < rMax; `r` is the current target inside them */
  rMin?: number;
  rMax?: number;
};
export interface TemplateEntry extends Omit<Entry, 'id' | 'sets'> {
  sets: TemplateSet[];
}

export interface Template {
  id: string;
  name: string;
  folder?: string;
  notes?: string;
  /** a note for next time, shown on the routine and its running workout until changed (#33) */
  pinnedNote?: string;
  exercises: TemplateEntry[];
  archived?: boolean;
  lastUsedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  example?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  /** Explicit family id for custom exercises; built-ins resolve by catalogue id. */
  family?: string | null;
  category: Category;
  bodyPart: string;
  builtin?: boolean;
  hidden?: boolean;
  notes?: string;
  pinnedNote?: string;
  restSec?: number;
  /** Turned unilateral by the person (#54); the unilateral exercises we ship are always so (isUnilateral in core). */
  unilateral?: boolean;
  imported?: boolean;
  createdAt?: number;
}

export interface Measurement {
  id: string;
  type: string;
  value: number;
  at: number;
}

export type ThemeSetting = 'system' | 'light' | 'dark' | 'strawberry-matcha' | 'intense-red';
export type LanguageSetting = 'auto' | 'en' | 'de';

export interface Settings {
  unit: 'kg' | 'lb';
  distUnit: 'km' | 'mi';
  theme: ThemeSetting;
  language: LanguageSetting;
  showExamples: boolean;
  weeklyGoal: number;
  weekStart: number;
  formula: string;
  historyStart: number | null;
  dumbbellTwice: boolean;
  /** Routine and workout set totals count left/right pairs of one-side exercises (#54). */
  pairSides: boolean;
  bwWeighted: boolean;
  bwAssisted: boolean;
  bodyUnit: 'kg' | 'lb' | null;
  sizeUnit: 'cm' | 'in' | null;
  defaultRest: number;
  askTemplateUpdate: boolean;
  prevSource: 'any' | 'template';
  bar: number;
  plates: number[];
  warmup: { barReps: number; steps: [number, number][] };
  [key: string]: unknown;
}

// ---------- the running workout ----------
// The editable form (see core/drafts.js): numbers are the strings the user
// typed, in display units, so "62," survives while typing.
export interface SetDraft {
  id: string;
  type: SetType;
  side?: SetSide;
  w: string;
  r: string;
  d: string;
  t: string;
  rpe: string;
  /** reps left in reserve, rated after the set (0–3) */
  rir?: number;
  done: boolean;
  /** when it was logged (ms; #43) */
  doneAt?: number;
  /** template target, shown as the placeholder */
  tpl?: { w: number | null; r: number | null; d: number | null; t: number | null };
  /** running workout: the routine's rep range for this set, shown beside it (#44) */
  range?: [number, number];
  /** routine editor: the current target behind a range typed as "8–10" (#44) */
  rNow?: number;
  /** stored numbers behind untouched text */
  orig?: Record<string, [string, number]>;
}

export interface EntryDraft {
  id: string;
  exerciseId: string;
  notes: string;
  showNotes: boolean;
  supersetId: string | null;
  restSec: number | null;
  focus?: string | null;
  sets: SetDraft[];
}

export interface Rest {
  start: number;
  end: number;
  total: number;
  label: string;
  /** the set it follows (the one "Reps left?" rates) */
  entryId?: string;
  setId?: string;
}

export interface ActiveWorkout {
  id: string;
  kind: 'workout';
  name: string;
  notes: string;
  showNotes?: boolean;
  startedAt: number;
  templateId: string | null;
  templateNotes: string;
  exercises: EntryDraft[];
  rest: Rest | null;
  /** the exercise switched to ("Up next"), or none: the session's order */
  current?: string | null;
  updatedAt: number;
}

// ---------- drafts outside the running workout ----------
// The template editor and "Edit workout" (see core/editing.js). Exercise
// changes made there (rest timer, pinned note) wait in exPatches until Save.
interface DraftBase {
  id: string;
  name: string;
  notes: string;
  exercises: EntryDraft[];
  exPatches?: Record<string, Partial<Exercise>>;
  /** changed since it was opened */
  dirty?: boolean;
}
export interface TemplateDraft extends DraftBase {
  kind: 'template';
  folder: string;
  /** the routine's pinned note for next time (#33) */
  pinnedNote: string;
}
export interface WorkoutEditDraft extends DraftBase {
  kind: 'edit';
  startedAt: number;
  durationMin: string;
  templateId: string | null;
  source?: string;
  /** the routine's pinned note for next time, when the workout's routine still exists (#33) */
  pinnedNote?: string;
}
export type EditDraft = TemplateDraft | WorkoutEditDraft;
export type AnyDraft = ActiveWorkout | EditDraft;
/** Which draft an editor works on: the running workout or the one being edited. */
export type DraftKey = 'active' | 'edit';

export interface Profile {
  name: string;
}

export type Meta = Record<string, unknown> & { seedVersion?: number; lastBackupAt?: number; folders?: string[]; createdAt?: number };

export interface Kv {
  settings?: Partial<Settings>;
  profile?: Partial<Profile>;
  meta?: Meta;
  active?: ActiveWorkout | null;
  strongAliases?: Record<string, string>;
  /** Names of this person’s custom exercise families, keyed by fc- id. */
  customFamilies?: Record<string, string>;
  /** The chart each exercise page shows, when the person chose one: exercise id → metric id (#27). */
  chartMetrics?: Record<string, string>;
}

/** Everything that is stored; also the `data` part of a backup file. */
export interface Data {
  exercises: Exercise[];
  workouts: Workout[];
  templates: Template[];
  measurements: Measurement[];
  kv: Kv;
}

export type StoreName = 'exercises' | 'workouts' | 'templates' | 'measurements';
export const STORES: StoreName[] = ['exercises', 'workouts', 'templates', 'measurements'];
