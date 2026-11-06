// Small visible library, distinct variation histories, and two custom names.
import { SEED_EXERCISES, SEED_VERSION, familyOf, DAY } from '../../core/index.js';
export const SQ = 'x-squat-barbell', SMITH = 'x-squat-smith-machine', DB = 'x-squat-dumbbell';
export const FRONT = 'x-front-squat-barbell', FRONT_SMITH = 'x-front-squat-smith-machine';
export const CABLE = 'x-bicep-curl-cable', CURL_DB = 'x-bicep-curl-dumbbell';
export function familiesData(theme = 'light') {
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const at = (days) => now.getTime() - days * DAY;
  const workout = (id, days, exerciseId, weight, reps, name = 'Legs') => ({
    id, name, startedAt: at(days), endedAt: at(days) + 3600000, templateId: null,
    exercises: [{ id: `${id}-entry`, exerciseId, sets: [{ id: `${id}-set`, type: 'normal', w: weight, r: reps }] }],
  });
  const latest = workout('family-smith-new', 1, SMITH, 110, 8, 'Smith practice');
  latest.exercises.push({ id: 'cybex-entry', exerciseId: 'c-cybex', sets: [{ id: 'cybex-set', type: 'normal', w: 75, r: 10 }] });
  return {
    exercises: [
      ...SEED_EXERCISES.map((e) => ({ ...e, hidden: !(familyOf(e) === 'f-squat' || ['x-bicep-curl-barbell', CABLE, CURL_DB, 'x-dead-hang'].includes(e.id)) })),
      { id: 'c-cybex', name: 'Squat (Cybex Machine)', category: 'machine', bodyPart: 'other', family: 'f-squat' },
      { id: 'c-own-row', name: 'My Row (Upper) (Cybex Machine)', category: 'machine', bodyPart: 'back' },
    ],
    workouts: [
      latest,
      workout('family-front-smith', 2, FRONT_SMITH, 60, 6, 'Front squat'),
      workout('family-barbell', 4, SQ, 90, 5),
      workout('family-front', 6, FRONT, 70, 4, 'Front squat'),
      workout('family-smith-old', 7, SMITH, 100, 10),
      workout('family-barbell-old', 10, SQ, 80, 8),
    ],
    templates: [{ id: 'family-routine', name: 'Lower A', createdAt: 1000, exercises: [
      { exerciseId: SMITH, sets: [{ type: 'normal', w: 110, r: 8 }] },
      { exerciseId: CABLE, sets: [{ type: 'normal', w: 20, r: 10 }] },
    ] }], measurements: [],
    kv: { settings: { theme, language: 'en', showExamples: false, unit: 'kg', appKeepAwake: false, historyStart: at(3) },
      meta: { seedVersion: SEED_VERSION, createdAt: 1000 } },
  };
}
