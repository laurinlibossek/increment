// A small review library: three drafts, undrawn siblings and custom names.
import { SEED_EXERCISES, SEED_VERSION, DAY } from '../../core/index.js';
export const BAR = 'x-bent-over-row-barbell', CABLE = 'x-seated-row-cable', ONE = 'x-bent-over-one-arm-row-dumbbell';
export const UNDRAWN = 'x-bent-over-row-dumbbell', CUSTOM = 'c-own-row', SAME_NAME = 'c-same-name';
export function thumbnailsData(theme = 'light', language = 'en', long = false) {
  const visible = [BAR, CABLE, ONE, UNDRAWN, 'x-single-arm-overhead-triceps-extension-cable'];
  const exercises = [
    ...SEED_EXERCISES.map(e => ({ ...e, hidden: !long && !visible.includes(e.id) })),
    { id: CUSTOM, name: language === 'de' ? 'Äußeres Rudern an der selbstgebauten Kabelzugmaschine' : 'My Row (Home Cable Machine)', category: 'machine', bodyPart: 'back', family: 'f-row' },
    { id: SAME_NAME, name: 'Bent Over Row (Barbell)', category: 'barbell', bodyPart: 'back', family: null },
  ];
  if (long) for (let i = 0; i < 100; i++) exercises.push({ id: `c-long-${i}`, name: `Row practice ${i}`, category: 'barbell', bodyPart: 'back' });
  const trained = long ? exercises : [ONE, BAR, CABLE, CUSTOM, SAME_NAME].map(id => exercises.find(e => e.id === id));
  return { exercises, workouts: trained.map((e, i) => ({ id: `w-${i}`, name: 'Pull', startedAt: Date.now() - (i + 1) * DAY,
    endedAt: Date.now() - (i + 1) * DAY + 3600000, exercises: [{ id: `entry-${i}`, exerciseId: e.id, sets: [{ id: `s-${i}`, type: 'normal', w: 40, r: 8 }] }] })),
    templates: [], measurements: [], kv: { settings: { theme, language, showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000 } } };
}
