// @ts-check
// Chart maths shared by the apps' charts: round axis steps and the time
// ranges the chart screens offer. Drawing is each app's job.
import {
  startOfWeek, startOfDay, startOfMonth, addDays, addMonths,
} from './units.js';

const TIME_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];

/** @param {number} range @param {number} count @param {boolean} time */
function niceStep(range, count, time) {
  const raw = range / count;
  if (time) return TIME_STEPS.find((s) => s >= raw) || Math.ceil(raw / 3600) * 3600;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/**
 * Round axis values from min to max, about `count` steps (seconds-friendly steps with `time`).
 * @param {number} min @param {number} max
 * @returns {number[]}
 */
export function niceTicks(min, max, count = 4, { zero = false, time = false } = {}) {
  if (zero) min = Math.min(0, min);
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad; max += pad;
    if (zero) min = Math.max(0, min);
  }
  const step = niceStep(max - min, count, time);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Decimals for axis labels with these ticks: as many as the step needs (2.5 → 1, 0.25 → 2), at most 2. @param {number[]} ticks */
export const tickDecimals = (ticks) => {
  const step = Math.abs(ticks.length > 1 ? ticks[1] - ticks[0] : 1);
  for (let d = 0; d < 2; d++) if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-6) return d;
  return 2;
};

/** Calendar-aligned labels within the plotted range, oldest first.
 * Month-only labels span the range in regular 1, 2, 3 or 6 month steps.
 * Longer ranges use January/July or January boundaries (whole-year multiples
 * for ranges too long to label every year), with month/year labels in the UI.
 * Use local calendar arithmetic so DST and variable month lengths stay correct.
 * @param {number} from @param {number} to
 * @returns {number[]}
 */
export function dateTicks(from, to, max = 4) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || !Number.isFinite(max) || max < 1) return [];
  max = Math.floor(max);
  if (from === to) return [from];
  const days = (to - from) / 86400000;
  if (days < 75) {
    let first = startOfDay(from);
    if (first < from) first = addDays(first, 1);
    if (first > to) return [from];
    const step = Math.max(1, Math.ceil(days / Math.max(1, max - 1)));
    const out = [];
    for (let at = first; at <= to && out.length < max; at = addDays(at, step)) out.push(at);
    return out;
  }
  let first = startOfMonth(from);
  if (first < from) first = addMonths(first, 1);
  const last = startOfMonth(to);
  const a = new Date(first), b = new Date(last);
  const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
  let step;
  let end = last;
  if (days <= 366) {
    step = [1, 2, 3, 6, 12].find((n) => Math.ceil(months / n) <= max) || 12;
  } else {
    // Align to January and July, even when the data starts mid-year.
    end = new Date(b.getFullYear(), b.getMonth() < 6 ? 0 : 6, 1).getTime();
    /** @param {number} lastTick @param {number} stride */
    const count = (lastTick, stride) => {
      const d = new Date(lastTick);
      const distance = (d.getFullYear() - a.getFullYear()) * 12 + d.getMonth() - a.getMonth();
      return Math.floor(distance / stride) + 1;
    };
    step = 6;
    if (count(end, step) > max) {
      end = new Date(b.getFullYear(), 0, 1).getTime();
      step = 12 * Math.max(1, Math.ceil(count(end, 12) / max));
    }
  }
  const out = [];
  for (let at = end; at >= first && out.length < max; at = addMonths(at, -step)) out.unshift(at);
  return out;
}

/** Range choices in days (0 = everything) for exercise and measurement charts. */
export const EXERCISE_RANGES = [{ value: 90, label: '3M' }, { value: 182, label: '6M' }, { value: 365, label: '1Y' }, { value: 0, label: 'All' }];
export const MEASURE_RANGES = [{ value: 30, label: '1M' }, { value: 90, label: '3M' }, { value: 365, label: '1Y' }, { value: 0, label: 'All' }];

/**
 * The box a one-line chart label takes around its anchor and baseline, so a
 * chart can keep two labels apart (#122). SVG text can't be measured before it
 * is drawn, so the width is estimated at 0.6 em a character, wider than most text.
 * @param {string} text @param {number} x the anchor @param {number} y the baseline @param {number} size the font size
 * @param {'start' | 'middle' | 'end'} [anchor]
 * @returns {{ x0: number, x1: number, y0: number, y1: number }}
 */
export function labelBox(text, x, y, size, anchor = 'start') {
  const w = text.length * size * 0.6;
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x0, x1: x0 + w, y0: y - size, y1: y + size * 0.3 };
}

/** Whether two boxes overlap. @param {{ x0: number, x1: number, y0: number, y1: number }} a @param {{ x0: number, x1: number, y0: number, y1: number }} b */
export const boxesOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Smallest step for centred labels with a gap between neighbours. The last
 * label is always shown; earlier labels count back from it (#124).
 * @param {string[]} labels @param {number} band distance between label centres
 * @param {number} size font size @param {number} gap minimum space between labels
 * @returns {number}
 */
export function labelStep(labels, band, size, gap) {
  const boxes = labels.map((text, i) => labelBox(text, i * band, 0, size, 'middle'));
  for (let step = 1; step < labels.length; step++) {
    let fits = true;
    for (let i = labels.length - 1; i >= step; i -= step) {
      const left = boxes[i - step];
      if (boxesOverlap({ ...left, x1: left.x1 + gap }, boxes[i])) {
        fits = false;
        break;
      }
    }
    if (fits) return step;
  }
  return Math.max(1, labels.length);
}

/**
 * Workouts per week for the last `weeks` weeks (oldest first).
 * @param {{ startedAt: number }[]} workouts
 * @returns {{ start: number, value: number }[]}
 */
export function weeklyCounts(workouts, { weeks = 12, weekStart = 1, now = Date.now() } = {}) {
  const thisWeek = startOfWeek(now, weekStart);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    out.push({ start, value: workouts.filter((w) => w.startedAt >= start && w.startedAt < end).length });
  }
  return out;
}

/** Weeks in a row (up to this one) with at least `goal` workouts; this week counts once it's reached. @param {{ startedAt: number }[]} workouts */
export function weekStreak(workouts, { goal = 1, weekStart = 1, now = Date.now() } = {}) {
  // One pass over the workouts, then a walk back week by week (filtering every
  // workout for every week took 80 ms on a 5-year log).
  /** @type {Map<number, number>} */
  const perWeek = new Map();
  for (const w of workouts) {
    const k = startOfWeek(w.startedAt, weekStart);
    perWeek.set(k, (perWeek.get(k) || 0) + 1);
  }
  const count = (/** @type {number} */ s) => perWeek.get(s) || 0;
  let week = startOfWeek(now, weekStart);
  let streak = 0;
  if (count(week) >= goal) streak++;
  week = addDays(week, -7);
  while (count(week) >= goal && streak < 520) { streak++; week = addDays(week, -7); }
  return streak;
}

/**
 * One month of the History calendar. `days` are the grid's day starts (5 or 6
 * weeks from `weekStart`, including days of the months around it), `byDay`
 * maps a day start to its workouts (newest first, as given), and the totals
 * count the month's workouts, the days trained and the time spent.
 * @template {{ startedAt: number, endedAt?: number | null }} W
 * @param {W[]} workouts
 * @param {number} month a time in the month
 */
export function calendarMonth(workouts, month, { weekStart = 1 } = {}) {
  const start = startOfMonth(month);
  const next = addMonths(start, 1);
  const gridStart = startOfWeek(start, weekStart);
  const days = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
  const rows = days[35] >= next ? 5 : 6;
  const gridEnd = addDays(days[rows * 7 - 1], 1);
  /** @type {Map<number, W[]>} */
  const byDay = new Map();
  let count = 0;
  let time = 0;
  const trained = new Set();
  for (const w of workouts) {
    if (w.startedAt >= gridStart && w.startedAt < gridEnd) {
      const d = startOfDay(w.startedAt);
      let list = byDay.get(d);
      if (!list) byDay.set(d, list = []);
      list.push(w);
    }
    if (w.startedAt >= start && w.startedAt < next) {
      count++;
      time += (w.endedAt || w.startedAt) - w.startedAt;
      trained.add(startOfDay(w.startedAt));
    }
  }
  return {
    start, next, days: days.slice(0, rows * 7), byDay, workouts: count, daysTrained: trained.size, time,
  };
}
