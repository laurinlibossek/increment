// A made-up training history for the Strong CSV export fixtures (#28): every set
// type, loaded, bodyweight, assisted, weighted-bodyweight, timed and cardio
// exercises, durations under and over an hour, and notes with commas, quotes and
// line breaks. Times are UTC; the tests pin TZ=UTC. No personal data.
export const EXPORT_EXERCISES = [
  { id: 'x-bench-press-barbell', name: 'Bench Press (Barbell)', category: 'barbell', bodyPart: 'chest' },
  { id: 'x-pull-up', name: 'Pull Up', category: 'reps', bodyPart: 'back' },
  { id: 'x-pull-up-assisted', name: 'Pull Up (Assisted)', category: 'assisted_bw', bodyPart: 'back' },
  { id: 'x-pull-up-weighted', name: 'Pull Up (Weighted)', category: 'weighted_bw', bodyPart: 'back' },
  { id: 'x-plank', name: 'Plank', category: 'duration', bodyPart: 'core' },
  { id: 'x-running', name: 'Running', category: 'cardio', bodyPart: 'cardio' },
];

const set = (id, type, fields) => ({ id, type, ...fields });
export const EXPORT_WORKOUTS = [
  {
    id: 'push', name: 'Push, heavy', notes: 'Felt "strong", slept 8h\nNext time: +2.5', startedAt: Date.UTC(2026, 9, 1, 17, 30, 15), endedAt: Date.UTC(2026, 9, 1, 18, 35, 0), templateId: null,
    exercises: [
      { id: 'e1', exerciseId: 'x-bench-press-barbell', notes: 'Pause, then press', restSec: 150, sets: [
        set('s1', 'warmup', { w: 20, r: 10 }), set('s2', 'normal', { w: 62.5, r: 8, rir: 2 }), set('s3', 'normal', { w: 62.5, r: 7, rpe: 9.5 }),
        set('s4', 'failure', { w: 60, r: 6 }), set('s5', 'drop', { w: 40, r: 10 }), set('s6', 'normal', { w: 61.25, r: 5, rir: 0 }),
      ] },
      { id: 'e2', exerciseId: 'x-pull-up', sets: [set('s7', 'normal', { w: 0, r: 12 }), set('s8', 'normal', { w: 0, r: 10 })] },
    ],
  },
  {
    id: 'pull', name: 'Pull', notes: '', startedAt: Date.UTC(2026, 9, 3, 7, 5, 0), endedAt: Date.UTC(2026, 9, 3, 7, 50, 0), templateId: null,
    exercises: [
      { id: 'e3', exerciseId: 'x-pull-up-assisted', sets: [set('s9', 'normal', { w: 20, r: 8 }), set('s10', 'normal', { w: 15, r: 6 })] },
      { id: 'e4', exerciseId: 'x-pull-up-weighted', notes: 'Belt, 2 plates', sets: [set('s11', 'normal', { w: 10, r: 5 })] },
      { id: 'e5', exerciseId: 'x-plank', sets: [set('s12', 'normal', { t: 60 }), set('s13', 'normal', { t: 45 })] },
    ],
  },
  {
    id: 'run', name: 'Long run', notes: '', startedAt: Date.UTC(2026, 9, 5, 6, 0, 0), endedAt: Date.UTC(2026, 9, 5, 8, 0, 0), templateId: null,
    exercises: [{ id: 'e6', exerciseId: 'x-running', sets: [set('s14', 'normal', { d: 21.0975, t: 7200 })] }],
  },
];
