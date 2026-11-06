// Generated review material, written to stdout so the catalogue stays the source.
// node scripts/exercise-review.mjs > docs/dev/review-YYYY-MM-DD-exercises/catalogue.md
import fs from 'node:fs';
import { EXERCISE_CATALOGUE, EXERCISE_NAMES_DE, loggedFields, BODY_PART_LABEL } from '../core/index.js';
const v1 = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/exercises-v1.json', import.meta.url), 'utf8'));
const oldIds = new Set(v1.exercises.map((e) => e.id));
const notes = {
  'x-close-grip-bench-press-barbell': 'Rename proposal: Bench Press - Close Grip (Barbell), matching exported Strong spelling; keep existing id/name here.',
  'x-cable-crossover-cable': 'Rename proposal: Cable Crossover (Strong export spelling); keep here.',
  'x-cable-crunch-cable': 'Rename proposal: Cable Crunch (Strong export spelling); keep here.',
  'x-calf-press-on-leg-press-machine': 'Rename proposal: Calf Press on Leg Press (Strong export spelling); keep here.',
  'x-hip-abduction-machine': 'Rename proposal: Hip Abductor (Machine) (Strong export spelling); keep here.',
  'x-hip-adduction-machine': 'Rename proposal: Hip Adductor (Machine) (Strong export spelling); keep here.',
  'x-farmer-s-walk-dumbbell': 'Logging proposal: load + distance/time, which needs a new category/migration; current one stays.',
  'x-sled-push': 'Logging proposal: load + distance/time, which needs a new category/migration; current one stays.',
  'x-pullover-dumbbell': 'Body part proposal: Back (currently Chest); needs Laurin’s decision; current one stays.',
};
const count = EXERCISE_CATALOGUE.reduce((n, f) => n + f.members.length, 0);
console.log(`# Exercise catalogue review\n\nGenerated with \`node scripts/exercise-review.mjs\`. ${EXERCISE_CATALOGUE.length} families, ${count} exercises (${count - oldIds.size} new). All original ids/names/categories/body parts and example routines are unchanged.\n\nMember order is the catalogue order (main version first). **New** marks additions; proposals are review questions, not changes. Logging letters: w = load/assistance, r = reps, d = distance, t = time. Category determines the meaning of w.\n`);
for (const f of EXERCISE_CATALOGUE) {
  console.log(`## ${f.name} · ${f.nameDe}\n\n\`${f.id}\`\n\n| English | German | Logs | Category | Body part | Status / proposal | Id |\n|---|---|---|---|---|---|---|`);
  for (const e of f.members) {
    console.log(`| ${e.name} | ${EXERCISE_NAMES_DE[e.name]} | ${loggedFields(e.category).join(' × ')} | ${e.category} | ${BODY_PART_LABEL[e.bodyPart]} | ${[oldIds.has(e.id) ? '' : '**New**', notes[e.id] || ''].filter(Boolean).join('; ')} | ${e.id} |`);
  }
  if (f !== EXERCISE_CATALOGUE.at(-1)) console.log('');
}
