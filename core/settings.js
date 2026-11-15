// Default settings, shared by every app. Stored settings are merged over these,
// so a backup from an older version gets new settings at their defaults, and a
// stored value of the wrong type (null, a number as text) gets the default too.
import { DEFAULT_WARMUP } from './calc.js';
import { parseNum } from './units.js';

export const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

export const DEFAULT_SETTINGS = {
  unit: 'kg',
  distUnit: 'km',
  defaultRest: 120,
  sound: true,
  restAlert: true, // iPhone/Android app: a notification when rest is over and the app isn't open
  keepAwake: true, // web app: iOS pauses web apps, so the screen stays on during a workout
  appKeepAwake: false, // iPhone/Android app: off, the rest notification says when rest is over (its own key, so backups don't carry one app's choice into the other)
  showExamples: true,
  askTemplateUpdate: true,
  language: 'auto', // 'auto' | 'en' | 'de'
  templateSort: 'name',
  formula: 'epley',
  dumbbellTwice: false,
  pairSides: true, // set totals of routines and workouts count left/right pairs of one-side exercises (#54)
  bwWeighted: false,
  bwAssisted: false,
  historyStart: null, // ms; workouts before it are ignored for previous values, records and charts
  prevSource: 'any', // 'any' | 'template'
  warmup: DEFAULT_WARMUP,
  bodyUnit: null, // null = same as the lifting unit
  sizeUnit: null, // null = cm with km, in with mi
  weekStart: 1,
  weeklyGoal: 3,
  theme: 'system', // 'system' | 'light' | 'dark' | 'strawberry-matcha' | 'intense-red'
  bar: 20,
  plates: KG_PLATES,
};

/** Settings whose default is null ("not set"): null or a value of this type. */
const NULLABLE = { historyStart: 'number', bodyUnit: 'string', sizeUnit: 'string' };

/** Whether a stored value can stand in for the default of `key`. */
function fits(key, value) {
  const d = DEFAULT_SETTINGS[key];
  if (key in NULLABLE) return value === null || (NULLABLE[key] === 'number' ? Number.isFinite(value) : typeof value === NULLABLE[key]);
  if (Array.isArray(d)) return Array.isArray(value);
  if (typeof d === 'object') return !!value && typeof value === 'object' && !Array.isArray(value);
  if (typeof d === 'number') return Number.isFinite(value);
  return typeof value === typeof d;
}

/**
 * The stored settings over the defaults (#98): a stored value is kept when it
 * has the default's type, so every screen can read every setting as it is,
 * without a fallback of its own. Keys without a default are kept as they are
 * (a newer version's settings survive a round trip through this one).
 */
export function withDefaults(stored) {
  const own = (k) => Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k);
  const kept = stored && typeof stored === 'object' && !Array.isArray(stored)
    ? Object.entries(stored).filter(([k, v]) => !own(k) || fits(k, v)) : [];
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(kept) };
}

/**
 * Settings after changing one. Switching the lifting unit swaps the default
 * plates and bar for the other unit's (custom plates are kept).
 * @param {any} settings
 * @param {string} key
 * @param {any} value
 */
export function changeSetting(settings, key, value) {
  const next = { ...settings, [key]: value };
  if (key === 'unit' && settings.unit !== value) {
    const plates = JSON.stringify(settings.plates);
    if (value === 'lb' && plates === JSON.stringify(KG_PLATES)) { next.plates = LB_PLATES; next.bar = 45; }
    if (value === 'kg' && plates === JSON.stringify(LB_PLATES)) { next.plates = KG_PLATES; next.bar = 20; }
  }
  return next;
}

/**
 * The warm-up scheme from what was typed in its editor: reps with the empty
 * bar, and [percent, reps] rows. Rows without a percent between 0 and 100 or
 * without reps are dropped; the rest are sorted by percent.
 */
export function warmupFromInput(barReps, steps) {
  const clean = (steps || []).map(([p, r]) => [parseNum(p), Math.round(parseNum(r) || 0)])
    .filter(([p, r]) => p > 0 && p < 100 && r > 0).sort((a, b) => a[0] - b[0]);
  return { barReps: Math.max(0, Math.round(parseNum(barReps) || 0)), steps: clean };
}
