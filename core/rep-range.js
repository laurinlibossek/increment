// Rep ranges on a routine's sets (#44): "80 kg × 8–10". A ranged routine set
// keeps three numbers: the fixed bounds `rMin` and `rMax` (the prescription,
// whole numbers, 1 ≤ rMin < rMax) and the scalar `r`, the current target
// inside them. Progression moves `r` and never the bounds; anything that
// doesn't know about ranges (older apps, Setlog) still reads `r` as an
// ordinary target. Workouts never carry a range.

const whole = (n) => Number.isInteger(n) && n >= 1 && n < 1000;

/** A set's rep range as [low, high], or null: only valid bounds, low < high. */
export function repRange(s) {
  const lo = s?.rMin, hi = s?.rMax;
  return whole(lo) && whole(hi) && lo < hi ? [lo, hi] : null;
}

/** `n` moved inside the range (unchanged without one). */
export const clampReps = (n, range) => (range ? Math.min(range[1], Math.max(range[0], n)) : n);

/**
 * The set with this range, or without any when `range` is null. Its target
 * `r` moves inside the bounds (the low bound when it has none), so the scalar
 * older readers see is always part of the prescription.
 */
export function withRepRange(s, range) {
  const { rMin: _lo, rMax: _hi, ...o } = s;
  if (!range) return o;
  const r = Number.isFinite(o.r) ? clampReps(Math.round(o.r), range) : range[0];
  return { ...o, r, rMin: range[0], rMax: range[1] };
}

/** "8–10" for a ranged set, else its reps as they are (a number or undefined). */
export const repsText = (s) => {
  const range = repRange(s);
  return range ? `${range[0]}–${range[1]}` : s?.r;
};

/**
 * What the routine editor's reps field says: null when it holds no range (an
 * ordinary number, or nothing), { range: [low, high] } for "8-10" or "8–10",
 * { r } when both bounds are the same ("8–8" is a target of 8), and
 * { problem: true } for anything else with a dash ("8-", "10–8", "0–5",
 * "8.5–10"), which must not save as some other prescription.
 */
export function parseRepsInput(text) {
  const v = String(text ?? '').trim();
  if (!/[-–—]/.test(v)) return null;
  const m = v.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (!m) return { problem: true };
  const lo = Number(m[1]), hi = Number(m[2]);
  if (!whole(lo) || !whole(hi) || lo > hi) return { problem: true };
  return lo === hi ? { r: lo } : { range: [lo, hi] };
}

/**
 * The range an exercise of a routine prescribes, for a one-line preview
 * (Today): the working sets' range when every ranged working set has the same
 * one, else null.
 */
export function entryRepRange(entry) {
  const ranges = (entry?.sets || []).filter((s) => (s.type || 'normal') !== 'warmup').map(repRange).filter(Boolean);
  if (!ranges.length || ranges.some((x) => x[0] !== ranges[0][0] || x[1] !== ranges[0][1])) return null;
  return ranges[0];
}
