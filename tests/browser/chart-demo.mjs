// Keep the store demo unchanged; chart review needs a history long enough to
// exercise 6M, a full 1Y and multi-year All rather than the same 16 weeks.
import { demoData } from './store-demo.mjs';

export function chartDemoData(lang, now = Date.now()) {
  const data = demoData(lang, now);
  const first = data.workouts.filter(w => w.exercises.some(e => e.exerciseId === 'x-squat-barbell'))
    .sort((a, b) => a.startedAt - b.startedAt)[0];
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 3);
  const span = first.startedAt - start.getTime();
  for (let at = start.getTime(), i = 0; at < first.startedAt; at += 7 * 86400000, i++) {
    const w = structuredClone(first);
    w.id = `chart-history-${i}`;
    w.startedAt = at;
    w.endedAt = at + first.endedAt - first.startedAt;
    w.exercises = w.exercises.filter(e => e.exerciseId === 'x-squat-barbell');
    w.exercises.forEach((e, j) => {
      e.id = `${w.id}-${j}`;
      e.sets.forEach((s, k) => {
        s.id = `${e.id}-${k}`;
        if (s.w) s.w = Math.round(s.w * (0.65 + 0.35 * (at - start.getTime()) / span) / 1.25) * 1.25;
      });
    });
    data.workouts.push(w);
  }
  return data;
}
