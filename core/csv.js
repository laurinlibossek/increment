// @ts-check
// Strong CSV: reading Strong's export (both of its layouts) and writing one.
// Plain functions: the app passes in what they need to know about its data.
import {
  uid, slug, parseNum, KG_PER_LB, KM_PER_MI, kgTo, kmTo, roundW, pad2,
} from './units.js';
import { rpeFromRir } from './calc.js';
import { isUnilateral, mergeSidePairs } from './set-sides.js';
import { canMergeExercises } from './editing.js';
import { MUSCLES, CATEGORIES, SEED_EXERCISES, MEASUREMENTS, MEASUREMENT_BY_ID } from './seed.js';
import { strongNameKey, STRONG_EXERCISE_ALIASES, strongExerciseSuggestions, strongExerciseFamily } from './strong-matching.js';

/**
 * @typedef {import('./types.js').SetLike} SetLike
 * @typedef {import('./types.js').ExerciseLike} ExerciseLike
 * @typedef {import('./types.js').Exercises} Exercises
 *
 * A set read from a Strong export: numbers in kg, km and seconds.
 * @typedef {{ id: string, type: 'normal' | 'warmup' | 'drop' | 'failure', w?: number, r?: number, d?: number, t?: number, rpe?: number }} StrongSet
 *
 * One exercise block of a workout in the file, under its Strong name.
 * @typedef {{ name: string, sets: StrongSet[], notes: string, restSec: number | null }} StrongEntry
 *
 * One workout in the file (its date and name).
 * @typedef {{ startedAt: number, name: string, durationSec: number, notes: string, entries: StrongEntry[] }} StrongWorkout
 *
 * A Strong name no exercise matches: the review asks what it is (#40).
 * @typedef {{ name: string, sessions: number, category: string, bodyPart: string, categories: string[],
 *   blocked?: 'negative' | 'mixed', exact?: string, omit: { sets: number, workouts: number },
 *   suggestions: { id: string, score: number, preselect: boolean }[] }} StrongReviewRow
 *
 * What parseStrongCSV read, nothing saved yet: the workouts, the names that
 * matched an exercise (name -> id) and the ones to review.
 * @typedef {{ groups: StrongWorkout[], matches: Record<string, string>, review: StrongReviewRow[],
 *   stats: { workouts: number, sets: number, duplicates: number, matchedExercises: number, skippedRows: number,
 *     restRows: number, hasWeightUnitColumn: boolean, first: number | null, last: number | null } }} StrongPreview
 *
 * What to do with a reviewed name: an existing exercise, a new one, or leave it out (#40).
 * @typedef {{ kind: 'existing', exerciseId: string } | { kind: 'new', name: string, category: string, bodyPart: string }
 *   | { kind: 'skip' }} StrongChoice
 *
 * A workout already in the app, as the import compares with it.
 * @typedef {{ id: string, startedAt: number, name: string, notes?: string, exercises: { exerciseId: string, notes?: string }[] }} KnownWorkout
 */

/** Whether a number of a set is there and above 0. @param {number | undefined} v */
const pos = (v) => (v ?? 0) > 0;

// ---------- CSV ----------
/** The delimiter of a CSV's first line: `;`, a tab or `,`. @param {string} text @returns {string} */
export function detectDelimiter(text) {
  const nl = text.search(/\r?\n/);
  const line = nl >= 0 ? text.slice(0, nl) : text;
  /** @param {string} ch */
  const count = (ch) => {
    let n = 0, q = false;
    for (const c of line) { if (c === '"') q = !q; else if (c === ch && !q) n++; }
    return n;
  };
  const c = count(','), sc = count(';'), tab = count('\t');
  if (sc > c && sc >= tab) return ';';
  if (tab > c) return '\t';
  return ',';
}

/** A CSV's rows of cells; blank rows are left out. @param {string} text @param {string} [delim] @returns {string[][]} */
export function parseCSV(text, delim) {
  text = String(text).replace(/^\uFEFF/, '');
  delim = delim || detectDelimiter(text);
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = '', q = false, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** @param {unknown} v */
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// ---------- dates & durations ----------
/** @param {string[]} samples @returns {(str: unknown) => number | null} */
function parseDateFactory(samples) {
  // decide day-first vs month-first for slash dates from the data itself
  /** @type {boolean | null} */
  let dayFirst = null;
  for (const s of samples) {
    const m = /^(\d{1,2})\/(\d{1,2})\/\d{2,4}/.exec(s.trim());
    if (!m) continue;
    if (+m[1] > 12) { dayFirst = true; break; }
    if (+m[2] > 12) { dayFirst = false; break; }
  }
  return (str) => {
    const s = String(str || '').trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0), +(m[6] || 0)).getTime();
    m = /^(\d{1,2})([./])(\d{1,2})\2(\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?/.exec(s);
    if (m) {
      let a = +m[1], b = +m[3], y = +m[4];
      if (y < 100) y += 2000;
      const df = m[2] === '.' ? true : (dayFirst ?? false);
      const day = df ? a : b, month = df ? b : a;
      let h = +(m[5] || 12);
      const ap = (m[8] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return new Date(y, month - 1, day, h, +(m[6] || 0), +(m[7] || 0)).getTime();
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  };
}

/** A Strong duration ("1:05", "1h 5m", "45m", or minutes) in seconds; 0 when there's none. @param {unknown} str @returns {number} */
export function parseDuration(str) {
  const s = String(str || '').trim().toLowerCase();
  if (!s) return 0;
  let m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  // "1:02:03" = h:mm:ss; "1:05" = h:mm (workout durations are hours + minutes)
  if (m) return m[3] !== undefined ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : (+m[1] * 3600 + +m[2] * 60);
  let total = 0, found = false;
  for (const [, num, u] of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(h|m|s)/g)) {
    const v = parseFloat(num.replace(',', '.'));
    total += u === 'h' ? v * 3600 : u === 'm' ? v * 60 : v;
    found = true;
  }
  if (found) return Math.round(total);
  const n = parseNum(s);
  if (n === null) return 0;
  return n > 300 ? Math.round(n) : Math.round(n * 60);
}

// ---------- category / body part inference ----------
/** @param {string} name @param {StrongSet[]} rows */
function inferCategory(name, rows) {
  const n = name.toLowerCase();
  const anyDist = rows.some((r) => pos(r.d));
  const anyW = rows.some((r) => r.w != null && r.w !== 0);
  const anyR = rows.some((r) => pos(r.r));
  const anyT = rows.some((r) => pos(r.t));
  if (anyDist) return 'cardio';
  if (anyW) {
    if (n.includes('(assisted)')) return 'assisted_bw';
    if (n.includes('(weighted)')) return 'weighted_bw';
    if (n.includes('(barbell)') || n.includes('(ez bar)') || n.includes('(trap bar)')) return 'barbell';
    if (n.includes('(dumbbell)')) return 'dumbbell';
    if (!n.includes('(') && /clean|snatch|jerk|deadlift|squat|bench press|overhead press/.test(n)) return 'barbell';
    return 'machine';
  }
  if (anyR) return 'reps';
  if (anyT) return 'duration';
  return 'machine';
}

// Specific movements precede broad words (leg curl before curl, RDL before deadlift).
/** @type {[string, RegExp][]} */
const BODY_RULES = [
  ['other', /tibialis|external rotation|rotator cuff|neck/],
  ['forearms', /reverse (grip bicep )?curl|wrist curl|farmer|dead hang/],
  ['adductors', /adduct|copenhagen/],
  ['calves', /calf|calves/],
  ['hamstrings', /leg curl|hamstring|romanian|\brdl\b|stiff.?leg|good morning|glute ham raise|nordic hamstring/],
  ['lower_back', /back extension \(machine\)/],
  ['glutes', /reverse hyper|deadlift|rack pull|glute|hip thrust|hip abduct|pull through|kettlebell swing/],
  ['hamstrings', /back ext|hyperext/],
  ['quads', /squat|lunge|leg press|leg extension|step.?up|reverse nordic|quad/],
  ['cardio', /running|jog|cycling|bike|biking|rowing|swim|walk|elliptical|stair|ski erg|aerobic|cardio|hiking|treadmill|spinning|jump rope/],
  ['core', /crunch|plank|sit ?up|leg raise|knee raise|\bab\b|abs|twist|hollow|l-sit|toes to bar|dead bug|pallof|wood ?chop|v-up|flutter|side bend/],
  ['full', /clean|snatch|jerk|thruster|burpee|get ?up|sled|battle rope/],
  ['rear_delts', /face pull|rear delt|reverse fly/],
  ['side_delts', /lateral raise|upright row|y.?raise|lu raise/],
  ['front_delts', /overhead press|shoulder press|military press|arnold press|z press|push press|landmine press|front raise|handstand push/],
  ['triceps', /tricep|skull|kickback|pushdown|jm press/],
  ['lats', /high row/],
  ['upper_back', /row\b|rows\b|shrug/],
  ['chest', /spoto press|larsen press|bench|chest|\bfly\b|flye|crossover|push ?up|pec|dip|pullover \(dumbbell\)|floor press/],
  ['lats', /pull ?up|chin ?up|pulldown|pull-down|\blat\b|pullover|keenan flap/],
  ['biceps', /curl|bicep/],
];
/** @param {string} name @returns {string} */
function inferBodyPart(name) {
  const n = name.toLowerCase();
  for (const [part, re] of BODY_RULES) if (re.test(n)) return part;
  return 'other';
}

// ---------- Strong import ----------
/**
 * Notes a stored workout lacks but the import has. Exercises pair by id and
 * occurrence. Returns { id, notes?, entries: [[index, note]] } or null.
 * @param {KnownWorkout} w
 * @param {string} notes
 * @param {{ exerciseId: string, notes?: string }[]} entries
 * @returns {{ id: string, notes?: string, entries: [number, string][] } | null}
 */
function missingNotes(w, notes, entries) {
  /** @type {{ id: string, notes?: string, entries: [number, string][] }} */
  const u = { id: w.id, entries: [] };
  if (notes && !w.notes) u.notes = notes;
  /** @type {Map<string, number>} */
  const seen = new Map();
  /** @type {Map<string, number>} */
  const at = new Map();
  w.exercises.forEach((e, i) => {
    const n = seen.get(e.exerciseId) || 0;
    seen.set(e.exerciseId, n + 1);
    at.set(`${e.exerciseId}#${n}`, i);
  });
  /** @type {Map<string, number>} */
  const seen2 = new Map();
  for (const e of entries) {
    const n = seen2.get(e.exerciseId) || 0;
    seen2.set(e.exerciseId, n + 1);
    const i = at.get(`${e.exerciseId}#${n}`);
    if (e.notes && i !== undefined && !w.exercises[i].notes) u.entries.push([i, e.notes]);
  }
  return u.notes || u.entries.length ? u : null;
}

const HEADER_ALIASES = {
  date: ['date'],
  workout: ['workout name', 'workout'],
  duration: ['duration', 'workout duration'],
  exercise: ['exercise name', 'exercise'],
  order: ['set order', 'set', 'set #'],
  weight: ['weight'],
  weightUnit: ['weight unit'],
  reps: ['reps'],
  distance: ['distance'],
  distanceUnit: ['distance unit'],
  seconds: ['seconds', 'time'],
  notes: ['notes'],
  workoutNotes: ['workout notes'],
  rpe: ['rpe'],
};

/**
 * Parse a Strong export into an unsaved review. Unmatched names never create
 * exercises here. resolveStrongImport requires a decision for each of them.
 * opts:
 *  - weightUnit / distUnit: units the Strong app was set to (used when the file doesn't say)
 *  - exercises: the app's exercises (array or Map)
 *  - aliases: remembered Strong name → exercise id choices
 *  - workouts: workouts already in the app, to skip duplicates
 *  - defaultName: name for rows without a workout name
 * Errors carry English messages that double as translation keys.
 * @param {string} text
 * @param {{ weightUnit?: string, distUnit?: string, exercises?: Exercises, aliases?: Record<string, string>,
 *   workouts?: { startedAt: number, name: string }[], defaultName?: string }} [opts]
 * @returns {StrongPreview}
 */
export function parseStrongCSV(text, opts = {}) {
  const { workouts: known = [], defaultName = 'Workout' } = opts;
  const exercises = [...(opts.exercises instanceof Map ? opts.exercises.values() : opts.exercises || [])];
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('The file is empty or not a CSV export.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  /** @type {Record<string, number>} */
  const col = {};
  for (const [key, names] of Object.entries(HEADER_ALIASES)) {
    col[key] = header.findIndex((h) => names.includes(h));
  }
  if (col.date < 0 || col.exercise < 0) {
    throw new Error('This doesn’t look like a Strong export — it needs “Date” and “Exercise Name” columns.');
  }
  /** @param {string[]} r @param {string} key */
  const get = (r, key) => (col[key] >= 0 ? (r[col[key]] ?? '').trim() : '');
  const parseDate = parseDateFactory(rows.slice(1, 200).map((r) => get(r, 'date')));
  const defW = opts.weightUnit || 'kg';
  const defD = opts.distUnit || 'km';

  /** @type {Map<string, StrongWorkout>} */
  const groups = new Map();
  let skippedRows = 0;
  let restRows = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const dateStr = get(r, 'date');
    const exName = get(r, 'exercise');
    const startedAt = parseDate(dateStr);
    if (!startedAt || !exName) { skippedRows++; continue; }
    const wName = get(r, 'workout') || defaultName;
    const key = dateStr + '|' + wName;
    let g = groups.get(key);
    if (!g) {
      g = {
        startedAt, name: wName, durationSec: parseDuration(get(r, 'duration')),
        notes: get(r, 'workoutNotes'), entries: [],
      };
      groups.set(key, g);
    }
    if (!g.notes && get(r, 'workoutNotes')) g.notes = get(r, 'workoutNotes');

    let last = g.entries[g.entries.length - 1];
    const orderRaw = get(r, 'order');
    const order = orderRaw.toLowerCase();
    if (!last || last.name !== exName) {
      last = { name: exName, sets: [], notes: '', restSec: null };
      g.entries.push(last);
    }
    // an exercise note can sit on any of its rows, including rest-timer rows
    const note = get(r, 'notes');
    if (note && !last.notes) last.notes = note;
    if (order.includes('rest')) {
      const sec = parseNum(get(r, 'seconds'));
      if (sec !== null && sec > 0) last.restSec = Math.round(sec);
      restRows++;
      continue;
    }
    /** @type {StrongSet['type']} */
    let type = 'normal';
    if (order === 'w') type = 'warmup';
    else if (order === 'd') type = 'drop';
    else if (order === 'f') type = 'failure';
    else if (order && !/^\d+$/.test(order)) { skippedRows++; continue; }

    let w = parseNum(get(r, 'weight'));
    const wu = get(r, 'weightUnit').toLowerCase() || defW;
    if (w !== null && /^lb/.test(wu)) w *= KG_PER_LB;
    let d = parseNum(get(r, 'distance'));
    const du = get(r, 'distanceUnit').toLowerCase() || defD;
    if (d !== null && /^mi/.test(du)) d *= KM_PER_MI;
    else if (d !== null && (du === 'm' || du === 'meters')) d /= 1000;
    const reps = parseNum(get(r, 'reps'));
    const t = parseNum(get(r, 'seconds'));
    const rpe = parseNum(get(r, 'rpe'));
    /** @type {StrongSet} */
    const set = { id: uid(), type };
    if (w !== null && w !== 0) set.w = Math.round(w * 10000) / 10000;
    if (reps !== null && reps > 0) set.r = Math.round(reps);
    if (d !== null && d > 0) set.d = Math.round(d * 100000) / 100000;
    if (t !== null && t > 0) set.t = Math.round(t);
    if (rpe !== null && rpe > 0) set.rpe = rpe;
    if (pos(set.r) && set.w === undefined) set.w = 0;
    if (!(pos(set.r) || pos(set.d) || pos(set.t))) { skippedRows++; continue; }
    last.sets.push(set);
  }

  // One review row per Strong name, counting distinct sessions, not sets or
  // repeated exercise blocks in the same session. Rest-only rows don't count.
  /** @type {Map<string, { name: string, sets: StrongSet[], sessions: Set<string> }>} */
  const rowsByName = new Map();
  for (const g of groups.values()) {
    for (const e of g.entries.filter((e) => e.sets.length)) {
      const key = strongNameKey(e.name);
      let item = rowsByName.get(key);
      if (!item) rowsByName.set(key, item = { name: e.name, sets: [], sessions: new Set() });
      item.sets.push(...e.sets);
      item.sessions.add(workoutKey(g.startedAt, g.name));
    }
  }
  const nonempty = [...groups.values()].filter((g) => g.entries.some((e) => e.sets.length));
  const existing = new Set(known.map((w) => workoutKey(w.startedAt, w.name)));
  const fresh = nonempty.filter((g) => {
    const key = workoutKey(g.startedAt, g.name);
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  // what leaving an exercise out would leave out: its sets in the workouts that are new
  /** @type {Map<string, { sets: number, workouts: Set<StrongWorkout> }>} */
  const freshCounts = new Map();
  for (const g of fresh) {
    for (const e of g.entries.filter((x) => x.sets.length)) {
      const key = strongNameKey(e.name);
      const c = freshCounts.get(key) || { sets: 0, workouts: new Set() };
      c.sets += e.sets.length;
      c.workouts.add(g);
      freshCounts.set(key, c);
    }
  }
  const byName = new Map(exercises.map((e) => [strongNameKey(e.name), e]));
  const byId = new Map(exercises.map((e) => [e.id, e]));
  /** @type {Map<string, string>} */
  const shippedAliases = new Map(Object.entries(STRONG_EXERCISE_ALIASES).map(([name, id]) => [strongNameKey(name), id]));
  const aliases = new Map(shippedAliases);
  for (const [name, id] of Object.entries(opts.aliases || {})) aliases.set(strongNameKey(name), id);
  /** @type {Record<string, string>} */
  const matches = {};
  /** @type {StrongReviewRow[]} */
  const review = [];
  for (const { name, sets, sessions } of rowsByName.values()) {
    const category = inferCategory(name, sets);
    const categories = strongImportCategories(sets);
    // every match, the exact name included, has to log the fields these sets have (#40)
    /** @param {ExerciseLike | false | undefined} ex */
    const fits = (ex) => !!ex && categories.includes(ex.category) && canMergeExercises({ id: null, category }, ex);
    const exact = byName.get(strongNameKey(name));
    const aliasId = aliases.get(strongNameKey(name));
    // A catalogue upgrade can preserve a same-name custom instead of adding
    // the built-in id. Its existing identity is the alias target in that case.
    const seedTarget = shippedAliases.get(strongNameKey(name)) === aliasId && SEED_EXERCISES.find((e) => e.id === aliasId);
    const target = (aliasId && byId.get(aliasId)) || (seedTarget && byName.get(strongNameKey(seedTarget.name)));
    const match = fits(exact) ? exact : fits(target) ? target : null;
    if (match) { Object.defineProperty(matches, name, { value: match.id, enumerable: true }); continue; }
    const part = inferBodyPart(name);
    const counts = freshCounts.get(strongNameKey(name));
    review.push({
      name, sessions: sessions.size, category, bodyPart: part === 'other' ? '' : part, categories,
      // nothing can import these sets as they are: the only way on is leaving the exercise out
      ...(categories.length ? {} : { blocked: sets.some((x) => (x.w ?? 0) < 0) ? /** @type {const} */ ('negative') : /** @type {const} */ ('mixed') }),
      // an exercise with this exact name logs other fields
      ...(exact ? { exact: exact.id } : {}),
      omit: { sets: counts?.sets || 0, workouts: counts?.workouts.size || 0 },
      suggestions: categories.length ? strongExerciseSuggestions(name, category, exercises) : [],
    });
  }
  return {
    groups: nonempty, matches, review,
    stats: {
      workouts: fresh.length, sets: fresh.reduce((n, g) => n + g.entries.reduce((m, e) => m + e.sets.length, 0), 0),
      duplicates: nonempty.length - fresh.length, matchedExercises: Object.keys(matches).length,
      skippedRows, restRows, hasWeightUnitColumn: col.weightUnit >= 0,
      first: fresh.length ? Math.min(...fresh.map((g) => g.startedAt)) : null,
      last: fresh.length ? Math.max(...fresh.map((g) => g.startedAt)) : null,
    },
  };
}

/**
 * Categories that retain the fields actually logged. None for a negative load (#40: never its absolute value) or a mixture.
 * @param {{ w?: number, r?: number, d?: number, t?: number }[]} sets
 * @returns {string[]}
 */
export function strongImportCategories(sets) {
  if (sets.some((s) => (s.w ?? 0) < 0)) return [];
  const w = sets.some((s) => s.w != null && s.w !== 0), r = sets.some((s) => pos(s.r));
  const d = sets.some((s) => pos(s.d)), t = sets.some((s) => pos(s.t));
  if ((r || w) && (d || t)) return []; // no supported category logs this mixture
  const category = d ? 'cardio' : t ? 'duration' : w ? 'machine' : 'reps';
  return CATEGORIES.filter((c) => canMergeExercises({ id: null, category }, { id: c.id, category: c.id })).map((c) => c.id);
}
/** @param {number} at @param {string} name */
const workoutKey = (at, name) => Math.floor(at / 1000) + '|' + name;

/**
 * What still has to be decided before the import, per reviewed name. Validation
 * also runs at import, so bypassing a disabled button cannot save guesses.
 * @param {{ review: StrongReviewRow[] }} preview
 * @param {Record<string, StrongChoice | undefined>} choices
 * @param {Exercises} exercises
 * @returns {{ name: string, problem: string }[]}
 */
export function strongImportProblems(preview, choices, exercises) {
  const all = [...(exercises instanceof Map ? exercises.values() : exercises)];
  const names = new Set(all.map((e) => strongNameKey(e.name)));
  /** @type {{ name: string, problem: string }[]} */
  const problems = [];
  for (const row of preview.review) {
    const choice = choices[row.name];
    let problem;
    if (choice?.kind === 'skip') problem = undefined;
    else if (row.blocked === 'negative') problem = 'Some sets have a negative weight. Leave the exercise out, or cancel and fix the file.';
    else if (!row.categories.length) problem = 'These sets combine fields no exercise can log. Leave the exercise out, or cancel and fix the file.';
    else if (choice?.kind === 'existing') {
      const target = all.find((e) => e.id === choice.exerciseId);
      if (!target || !row.categories.includes(target.category) || !canMergeExercises({ id: null, category: row.category }, target)) problem = 'Choose an exercise that logs the same fields';
    } else if (choice?.kind === 'new') {
      if (!choice.name?.trim()) problem = 'Give the exercise a name';
      else if (names.has(strongNameKey(choice.name))) problem = 'An exercise with this name already exists';
      else if (!row.categories.includes(choice.category)) problem = 'Choose what this exercise logs';
      else if (!MUSCLES.some((b) => b.id === choice.bodyPart)) problem = 'Choose a muscle';
      names.add(strongNameKey(choice.name || ''));
    } else problem = 'Choose an exercise or create a new one';
    if (problem) problems.push({ name: row.name, problem });
  }
  return problems;
}

/**
 * Turn a fully decided review into records to save together. Never mutates the preview or stored data.
 * @param {StrongPreview} preview
 * @param {Record<string, StrongChoice | undefined>} choices
 * @param {{ exercises?: Exercises, workouts?: KnownWorkout[], aliases?: Record<string, string> }} [opts]
 */
export function resolveStrongImport(preview, choices, opts = {}) {
  const { exercises = [], workouts: known = [], aliases = {} } = opts;
  const problems = strongImportProblems(preview, choices, exercises);
  if (problems.length) throw new Error(problems[0].problem);
  const all = [...(exercises instanceof Map ? exercises.values() : exercises)];
  const ids = new Set(all.map((e) => e.id));
  const byName = new Map(Object.entries(preview.matches).map(([name, id]) => [strongNameKey(name), id]));
  if ([...byName.values()].some((id) => !ids.has(id))) throw new Error('The exercise library changed. Pick the file again.');
  /** @type {{ id: string, name: string, category: string, bodyPart: string, family?: string, imported: true, createdAt: number }[]} */
  const newExercises = [];
  /** @type {Map<string, string>} */
  const remembered = new Map(Object.entries({ ...STRONG_EXERCISE_ALIASES, ...aliases }));
  // left out: not imported, and not remembered, so the file can be imported again once fixed
  const skipped = new Set(preview.review.filter((row) => choices[row.name]?.kind === 'skip').map((row) => strongNameKey(row.name)));
  for (const row of preview.review) {
    // strongImportProblems above refused a row without a choice
    const choice = /** @type {StrongChoice} */ (choices[row.name]);
    if (choice.kind === 'skip') continue;
    let id = choice.kind === 'existing' ? choice.exerciseId : '';
    if (choice.kind === 'new') {
      id = 'c-' + slug(choice.name);
      if (!slug(choice.name) || ids.has(id)) id = 'c-' + uid();
      ids.add(id);
      const family = strongExerciseFamily(choice.name, all);
      newExercises.push({ id, name: choice.name.trim(), category: choice.category, bodyPart: choice.bodyPart,
        ...(family ? { family } : {}), imported: true, createdAt: Date.now() });
    }
    byName.set(strongNameKey(row.name), id);
    remembered.set(row.name, id);
  }

  // build workouts, skip ones already present. CSV times have whole seconds while
  // workouts logged in Setlog keep milliseconds, so compare by the second.
  const keyOf = workoutKey;
  const existing = new Map(known.map((w) => [keyOf(w.startedAt, w.name), w]));
  const existingKeys = new Set(existing.keys());
  /** @type {{ id: string, name: string, notes: string, startedAt: number, endedAt: number, templateId: null,
   *   exercises: { id: string, exerciseId: string, sets: StrongSet[], notes?: string, restSec?: number }[], source: 'strong' }[]} */
  const workouts = [];
  /** @type {NonNullable<ReturnType<typeof missingNotes>>[]} */
  const noteUpdates = [];
  let duplicates = 0;
  let setCount = 0;
  const omitted = { sets: 0, workouts: 0, exercises: preview.review.filter((row) => skipped.has(strongNameKey(row.name))).map((row) => row.name) };
  for (const g of preview.groups) {
    const kept = g.entries.filter((e) => e.sets.length && !skipped.has(strongNameKey(e.name)));
    const left = g.entries.filter((e) => e.sets.length && skipped.has(strongNameKey(e.name)));
    const fresh = !existingKeys.has(keyOf(g.startedAt, g.name));
    if (fresh && left.length) {
      omitted.sets += left.reduce((n, e) => n + e.sets.length, 0);
      // a workout with nothing else in it isn't made at all
      if (!kept.length) omitted.workouts++;
    }
    const entries = kept.map((e) => {
      // every name kept matched an exercise or was decided above
      /** @type {(typeof workouts)[number]['exercises'][number]} */
      const entry = { id: uid(), exerciseId: /** @type {string} */ (byName.get(strongNameKey(e.name))), sets: e.sets };
      if (e.notes) entry.notes = e.notes;
      if (e.restSec) entry.restSec = e.restSec;
      return entry;
    });
    if (!entries.length) continue;
    const key = keyOf(g.startedAt, g.name);
    if (existingKeys.has(key)) {
      duplicates++;
      // already imported (maybe by an older version that dropped notes): fill in missing notes
      const w = existing.get(key);
      const u = w && missingNotes(w, g.notes, entries);
      if (u) noteUpdates.push(u);
      continue;
    }
    existingKeys.add(key);
    setCount += entries.reduce((a, e) => a + e.sets.length, 0);
    workouts.push({
      id: 's-' + g.startedAt + '-' + (slug(g.name) || 'workout'),
      name: g.name,
      notes: g.notes || '',
      startedAt: g.startedAt,
      endedAt: g.startedAt + Math.max(60, g.durationSec || 0) * 1000,
      templateId: null,
      exercises: entries,
      source: /** @type {const} */ ('strong'),
    });
  }
  workouts.sort((a, b) => a.startedAt - b.startedAt);
  return {
    workouts,
    exercises: newExercises,
    aliases: Object.fromEntries(remembered),
    noteUpdates,
    stats: {
      ...preview.stats,
      workouts: workouts.length,
      notesAdded: noteUpdates.length,
      sets: setCount,
      duplicates,
      omitted,
      newExercises: newExercises.map((e) => e.name),
      first: workouts[0]?.startedAt || null,
      last: workouts[workouts.length - 1]?.startedAt || null,
    },
  };
}

// ---------- CSV export (Strong-compatible) ----------
/** Workout duration the way Strong writes it ("1h 5m", "45m"), whatever the app language. @param {number} [ms] */
export function strongDuration(ms) {
  const min = Math.max(0, Math.round((ms || 0) / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
/** @param {number} t */
function isoLocal(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
/** A number as Strong writes it: always with a decimal point (20.0, 8.0, 62.5), never fewer decimals than it has. */
/** @param {number} n */
const strongNumber = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
/** A text cell Strong always quotes (names, the first row's notes), even empty. */
/** @param {unknown} v */
const quoted = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

/**
 * All workouts as a Strong-style CSV: weights in `unit` (kg | lb), distances in
 * `distUnit` (km | mi). `exercises` maps id -> exercise. The style is Strong's own
 * export (#28, pinned by tests/fixtures/strong-export-*.csv): local date and
 * time; workout and exercise names quoted; weight, reps and seconds as decimals
 * (20.0, 8.0, 0.0); distance 0 when there is none, else a decimal; W, D, F or
 * the working set's number; the notes quoted on an exercise's first row, the
 * workout notes on the workout's first row, both empty elsewhere; RPE as it is
 * (from reps in reserve: 10 − RIR); one newline at the end.
 */
/**
 * `pairSides` (Account → "Count left/right sets together", #54): a unilateral
 * exercise's left and right sets go out as one row each pair, as Strong logs
 * them (mergeSidePairs); off, every side is its own row.
 * @param {{ workouts: { startedAt: number, endedAt?: number, name: string, notes?: string,
 *   exercises: { exerciseId: string, notes?: string, sets: SetLike[] }[] }[], exercises: Map<string, ExerciseLike>,
 *   unit?: string, distUnit?: string, unknownName?: string, pairSides?: boolean }} o
 * @returns {string}
 */
export function exportCSV({ workouts, exercises, unit = 'kg', distUnit = 'km', unknownName = 'Unknown exercise', pairSides = false }) {
  const st = { unit, distUnit };
  const lines = [['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Distance', 'Seconds', 'Notes', 'Workout Notes', 'RPE'].join(',')];
  const asc = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of asc) {
    const dur = strongDuration((w.endedAt || w.startedAt) - w.startedAt);
    let firstOfWorkout = true;
    for (const e of w.exercises) {
      const ex = exercises.get(e.exerciseId);
      const name = ex?.name || unknownName;
      const rows = pairSides && isUnilateral(ex) ? mergeSidePairs(e.sets) : e.sets;
      let n = 0;
      rows.forEach((s, i) => {
        /** @type {string} */
        let order;
        if (s.type === 'warmup') order = 'W';
        else if (s.type === 'drop') order = 'D';
        else if (s.type === 'failure') order = 'F';
        else order = String(++n);
        const d = s.d ? Math.round(kmTo(s.d, st.distUnit) * 1000) / 1000 : 0;
        lines.push([
          csvCell(isoLocal(w.startedAt)), quoted(w.name), csvCell(dur), quoted(name), order,
          strongNumber(s.w !== undefined && s.w !== null ? roundW(kgTo(s.w, st.unit), st.unit) : 0),
          strongNumber(s.r || 0),
          d ? strongNumber(d) : '0',
          strongNumber(s.t || 0),
          i === 0 ? quoted(e.notes || '') : '',
          firstOfWorkout ? quoted(w.notes || '') : '',
          csvCell(s.rpe || rpeFromRir(s.rir) || ''),
        ].join(','));
        firstOfWorkout = false;
      });
    }
  }
  return lines.join('\n') + '\n';
}


// ---------- measurements CSV (#29) ----------
/**
 * The Measurement Type each measurement goes out as. Strong's export shows `Weight`
 * and `Body Fat` (Laurin's sample, 14 Nov 2026); the rest are only in Strong's paid
 * tier, so they are the app's English names in the same capitalisation. A sample of
 * that tier's export corrects them here, in one place. English in every language,
 * like the stored exercise names.
 */
/** @type {Record<string, string>} */
export const MEASUREMENT_CSV_NAMES = {
  bodyweight: 'Weight', bodyfat: 'Body Fat', calories: 'Calorie Intake',
  neck: 'Neck', shoulders: 'Shoulders', chest: 'Chest',
  bicep_l: 'Left Biceps', bicep_r: 'Right Biceps', forearm_l: 'Left Forearm', forearm_r: 'Right Forearm',
  waist: 'Waist', hips: 'Hips', thigh_l: 'Left Thigh', thigh_r: 'Right Thigh', calf_l: 'Left Calf', calf_r: 'Right Calf',
};
const CM_PER_IN = 2.54;
const MEASUREMENT_ORDER = Object.fromEntries(MEASUREMENTS.map((m, i) => [m.id, i]));

/**
 * One stored measurement value (kg, cm, % or kcal) in the units of the export:
 * body weight in `bodyUnit` (kg to 0.01, lb to 0.1, like the app), sizes in
 * `sizeUnit` to 0.1, calories whole. Body fat is a fraction with the unit %,
 * as Strong writes it, but not cut to one decimal the way Strong's file is
 * (14% → 0.1 there): 14% → 0.14, 14.5% → 0.145 (Laurin, 14 Nov 2026, #29).
 * @param {string} kind
 * @param {number} value
 * @param {{ bodyUnit?: string, sizeUnit?: string }} [o]
 * @returns {{ value: number, unit: string }}
 */
export function measurementCsvValue(kind, value, { bodyUnit = 'kg', sizeUnit = 'cm' } = {}) {
  if (kind === 'weight') return { value: roundW(kgTo(value, bodyUnit), bodyUnit), unit: bodyUnit };
  if (kind === 'length') return { value: Math.round((sizeUnit === 'in' ? value / CM_PER_IN : value) * 10) / 10, unit: sizeUnit };
  if (kind === 'kcal') return { value: Math.round(value), unit: 'kcal' };
  return { value: Math.round(value * 100) / 10000, unit: '%' }; // the stored percent to 0.01, as a fraction
}

/**
 * Every measurement as one CSV in the columns of Strong's measurement export
 * (#29, pinned by tests/fixtures/measurements-*.csv): Date (local time, as the
 * workout CSV), Measurement Type, Value (a decimal point, no forced .0: 93,
 * 81.4), Unit, Source (`Increment`). Strong writes a file per measurement; this
 * is one file, oldest first, so the type column tells them apart (Laurin, 14 Nov
 * 2026). Nothing is quoted: no cell can hold a comma. Types the app doesn't
 * know and values that aren't numbers are left out. One newline at the end,
 * like the workout CSV.
 * @param {{ measurements?: { type: string, value: number, at: number }[] | null, bodyUnit?: string, sizeUnit?: string }} o
 * @returns {string}
 */
export function exportMeasurementsCSV({ measurements, bodyUnit = 'kg', sizeUnit = 'cm' }) {
  const lines = ['Date,Measurement Type,Value,Unit,Source'];
  const rows = (measurements || [])
    .filter((m) => MEASUREMENT_BY_ID[m.type] && MEASUREMENT_CSV_NAMES[m.type] && Number.isFinite(m.value) && Number.isFinite(m.at))
    .sort((a, b) => a.at - b.at || MEASUREMENT_ORDER[a.type] - MEASUREMENT_ORDER[b.type]);
  for (const m of rows) {
    const { value, unit } = measurementCsvValue(MEASUREMENT_BY_ID[m.type].kind, m.value, { bodyUnit, sizeUnit });
    lines.push([isoLocal(m.at), MEASUREMENT_CSV_NAMES[m.type], String(value), unit, 'Increment'].join(','));
  }
  return lines.join('\n') + '\n';
}
