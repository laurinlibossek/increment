// Generated review material, written to stdout so the catalogue stays the source.
// node scripts/exercise-review.mjs > docs/dev/review-YYYY-MM-DD-exercises/catalogue.md
import fs from 'node:fs';
import { EXERCISE_CATALOGUE, EXERCISE_NAMES_DE, loggedFields, BODY_PART_LABEL } from '../core/index.js';
const v1 = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/exercises-v1.json', import.meta.url), 'utf8'));
const oldIds = new Set(v1.exercises.map((e) => e.id));
const notes = {
  'x-close-grip-bench-press-barbell': 'Preserved name; future Strong import alias: Bench Press - Close Grip (Barbell).',
  'x-cable-crossover-cable': 'Preserved name; future Strong import alias: Cable Crossover.',
  'x-cable-crunch-cable': 'Preserved name; future Strong import alias: Cable Crunch.',
  'x-calf-press-on-leg-press-machine': 'Preserved name; future Strong import alias: Calf Press on Leg Press.',
  'x-hip-abduction-machine': 'Preserved name; future Strong import alias: Hip Abductor (Machine).',
  'x-hip-adduction-machine': 'Preserved name; future Strong import alias: Hip Adductor (Machine).',
  'x-farmer-s-walk-dumbbell': 'Preserved fields: load × reps. Load + distance/time is deferred to a later PR.',
  'x-sled-push': 'Preserved fields: load × reps. Load + distance/time is deferred to a later PR.',
  'x-pullover-dumbbell': 'Preserved body part: Chest, as confirmed in review.',
};
const count = EXERCISE_CATALOGUE.reduce((n, f) => n + f.members.length, 0);
console.log(`# Exercise catalogue review\n\nGenerated with \`node scripts/exercise-review.mjs\`. ${EXERCISE_CATALOGUE.length} families, ${count} exercises (${count - oldIds.size} new). All original ids/names/categories/body parts and example routines are unchanged.\n\nMember order is the tab order: main movement first, related movements adjacent, equipment in the shared core order. **New** marks additions. Compatibility notes record Laurin’s decisions and future import aliases; stored names and fields stay. Logging letters: w = load/assistance, r = reps, d = distance, t = time. Category determines the meaning of w.\n`);
for (const f of EXERCISE_CATALOGUE) {
  console.log(`## ${f.name} · ${f.nameDe}\n\n\`${f.id}\`\n\n| English | German | Logs | Category | Body part | Status / compatibility | Id |\n|---|---|---|---|---|---|---|`);
  for (const e of f.members) {
    console.log(`| ${e.name} | ${EXERCISE_NAMES_DE[e.name]} | ${loggedFields(e.category).join(' × ')} | ${e.category} | ${BODY_PART_LABEL[e.bodyPart]} | ${[oldIds.has(e.id) ? '' : '**New**', notes[e.id] || ''].filter(Boolean).join('; ')} | ${e.id} |`);
  }
  if (f !== EXERCISE_CATALOGUE.at(-1)) console.log('');
}
