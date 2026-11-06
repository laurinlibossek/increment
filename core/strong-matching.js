// Conservative Strong-name matching. Search can match fragments; import
// suggestions must account for every word of the movement's name.
import { canMergeExercises } from './editing.js';
import { EXERCISE_SEARCH_SHORTCUTS, exerciseBaseName } from './search.js';
import { familyOf } from './exercise-families.js';
import { EXERCISE_EQUIPMENT_ORDER } from './exercise-equipment.js';

/** Exact import identity ignores case and whitespace, as before. */
export const strongNameKey = (name) => String(name).trim().toLowerCase().replace(/\s+/g, ' ');

export const STRONG_EXERCISE_ALIASES = Object.freeze({
  'Bench Press - Close Grip (Barbell)': 'x-close-grip-bench-press-barbell',
  'Cable Crossover': 'x-cable-crossover-cable',
  'Cable Crunch': 'x-cable-crunch-cable',
  'Calf Press on Leg Press': 'x-calf-press-on-leg-press-machine',
  'Hip Abductor (Machine)': 'x-hip-abduction-machine',
  'Hip Adductor (Machine)': 'x-hip-adduction-machine',
});

const words = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/['’]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
  .map((w) => w.length > 3 && !/ss$/.test(w) ? w.replace(/ies$/, 'y').replace(/s$/, '') : w)
  .flatMap((w, i, tokens) => ['db', 'bb', 'ez', 'kb', 'pullup', 'pushup', 'chinup', 'situp'].includes(w) && !(w === 'ez' && tokens[i + 1] === 'bar') ? EXERCISE_SEARCH_SHORTCUTS[w].split(' ') : [w]);

function nameParts(name) {
  const bracket = /\s*\(([^()]*)\)\s*$/.exec(name);
  let base = words(bracket ? name.slice(0, bracket.index) : name);
  let equipment = words(bracket?.[1] || '');
  // Search shortcuts also occur outside brackets: "DB Bench Press".
  if (!bracket) {
    for (const label of EXERCISE_EQUIPMENT_ORDER) {
      const tokens = words(label);
      const i = base.findIndex((_, at) => tokens.every((t, n) => base[at + n] === t));
      if (i >= 0 && base.length > tokens.length) {
        equipment = tokens; base = [...base.slice(0, i), ...base.slice(i + tokens.length)]; break;
      }
    }
  }
  return { base, equipment };
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

function wordDistance(a, b) {
  if (!a.length || a.length !== b.length) return null;
  let score = 0;
  for (let i = 0; i < a.length; i++) {
    const d = distance(a[i], b[i]), len = Math.max(a[i].length, b[i].length);
    const allowed = len >= 8 ? 2 : len >= 4 ? 1 : 0;
    if (d > allowed || d / len > 0.25) return null;
    score += d / len;
  }
  return score / a.length;
}

/** At most three compatible candidates, closest first; no partial-word overlap. */
export function strongExerciseSuggestions(name, category, exercises) {
  const source = nameParts(name);
  const candidates = [];
  for (const ex of exercises instanceof Map ? exercises.values() : exercises) {
    if (!canMergeExercises({ id: null, category }, ex)) continue;
    const target = nameParts(ex.name);
    const base = wordDistance(source.base, target.base);
    if (base === null) continue;
    const sameEquipment = source.equipment.join(' ') === target.equipment.join(' ');
    const equipmentDistance = wordDistance(source.equipment, target.equipment);
    const missingEquipment = !source.equipment.length;
    const equipment = sameEquipment ? 0 : missingEquipment ? 0.08 : equipmentDistance !== null ? equipmentDistance : 0.4;
    candidates.push({ id: ex.id, score: base + equipment, preselect: sameEquipment || missingEquipment || equipmentDistance !== null, base: target.base.join(' ') });
  }
  candidates.sort((a, b) => a.score - b.score); // stable: the catalogue's usual version wins a tie
  const top = candidates[0], next = candidates[1];
  // Two equally plausible spellings of different movements need a decision.
  if (top && next && top.score === next.score && top.base !== next.base) top.preselect = false;
  return candidates.slice(0, 3).map(({ id, score, preselect }, i) => ({ id, score, preselect: i === 0 && preselect }));
}

/** Only an exact base name joins a family. No spelling, plural or word guesses. */
export function strongExerciseFamily(name, exercises) {
  const base = strongNameKey(exerciseBaseName({ name }, 'en'));
  const families = new Set();
  for (const ex of exercises instanceof Map ? exercises.values() : exercises) {
    const family = familyOf(ex);
    if (family && strongNameKey(exerciseBaseName(ex, 'en')) === base) families.add(family);
  }
  return families.size === 1 ? [...families][0] : undefined;
}
