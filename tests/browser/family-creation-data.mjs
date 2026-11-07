// A custom-only Kelso library represents exercises made before catalogue families.
import { SEED_EXERCISES, SEED_VERSION, familyOf } from '../../core/index.js';

export function familyCreationData(theme) {
  return {
    // No catalogue Kelso members: this represents the person's old custom-only library.
    exercises: [
      ...SEED_EXERCISES.filter((e) => familyOf(e) !== 'f-kelso-shrug').map((e) => ({ ...e, hidden: familyOf(e) !== 'f-squat' })),
      { id: 'c-kelso-cable', name: 'Kelso Shrug (Cable)', category: 'machine', bodyPart: 'back', family: null },
    ],
    workouts: [{ id: 'kelso-history', name: 'Pull', startedAt: Date.now() - 86400000, endedAt: Date.now() - 82800000,
      exercises: [{ id: 'kelso-entry', exerciseId: 'c-kelso-cable', sets: [{ id: 'kelso-set', type: 'normal', w: 40, r: 8 }] }] }],
    templates: [], measurements: [],
    kv: { settings: { theme, language: 'en', showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION } },
  };
}
