import { SEED_EXERCISES, SEED_VERSION, DAY } from '../../core/index.js';
export const CURL = 'x-concentration-curl-dumbbell', PLANK = 'x-side-plank', CARDIO = 'x-running';
export const ROUTINE = 'side-routine';
export function setSidesData(theme = 'light', language = 'en') {
  const at = Date.now() - 2 * DAY;
  return {
    exercises: SEED_EXERCISES,
    workouts: [{ id: 'side-history', name: 'Single arm', startedAt: at, endedAt: at + 1800000, templateId: ROUTINE,
      exercises: [{ id: 'side-entry', exerciseId: CURL, sets: [
        { id: 'old-right', type: 'normal', side: 'right', w: 16, r: 7 },
        { id: 'old-left', type: 'normal', side: 'left', w: 26, r: 5 },
      ] }] }],
    templates: [
      { id: ROUTINE, name: 'Single arm', exercises: [{ exerciseId: CURL, sets: [{ type: 'normal', w: 20, r: 5 }] }] },
      { id: 'side-duration', name: 'Side plank', exercises: [{ exerciseId: PLANK, sets: [{ type: 'normal', t: 45 }] }] },
      { id: 'side-cardio', name: 'Run', exercises: [{ exerciseId: CARDIO, sets: [{ type: 'normal', d: 5, t: 1800 }] }] },
    ], measurements: [],
    kv: { settings: { theme, language, showExamples: false, appKeepAwake: false, defaultRest: 0, prevSource: 'any', askTemplateUpdate: true },
      meta: { seedVersion: SEED_VERSION, createdAt: 1000 } },
  };
}
