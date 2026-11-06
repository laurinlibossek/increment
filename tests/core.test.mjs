// Unit tests for core/, run in plain Node (no browser): `npm test`.
// They also guard the boundary the Expo app relies on: core/ must not use the
// DOM, browser storage or anything outside core/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../core/index.js';
import { tallyFromTokens, render as renderTally } from '../scripts/tally-tokens.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE = path.join(ROOT, 'core');
/** Static pages published next to the web app (the privacy policy). */
const WEB = path.join(ROOT, 'web');
const DAY = 86400000;
const read = (p) => fs.readFileSync(p, 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

// ---------- the boundary ----------
test('core uses no browser APIs and imports only core files', () => {
  for (const f of fs.readdirSync(CORE).filter((x) => x.endsWith('.js'))) {
    const src = stripComments(read(path.join(CORE, f)));
    const hit = src.match(/\b(window|document|localStorage|sessionStorage|navigator|location|indexedDB|fetch|XMLHttpRequest)\b/);
    assert.equal(hit, null, `${f} uses ${hit && hit[0]}`);
    for (const m of src.matchAll(/\bfrom\s+'([^']+)'/g)) assert.match(m[1], /^\.\/[\w-]+\.js$/, `${f} imports ${m[1]}`);
  }
});

// ---------- units ----------
test('numbers: decimal commas, input strings, plates, typed times', () => {
  assert.equal(core.parseNum('62,5'), 62.5);
  assert.equal(core.parseNum('1.234,5'), 1234.5);
  assert.equal(core.parseNum('abc'), null);
  assert.equal(core.numToInput(62.5, 2, ','), '62,5');
  assert.equal(core.numToInput(62.5, 2, '.'), '62.5');
  assert.deepEqual(core.parsePlates('25,20,15'), [25, 20, 15]);
  assert.deepEqual(core.parsePlates('25  20  2,5  1,25'), [25, 20, 2.5, 1.25]);
  assert.deepEqual(core.parsePlates('45, 35, 2.5'), [45, 35, 2.5]);
  assert.deepEqual(core.parsePlates('2,5'), [2.5]);
  assert.equal(core.digitsToSec('130'), 90);
  assert.equal(core.secToDigits(90), '130');
  assert.equal(core.fmtClock(3723), '1:02:03');
});

// ---------- calc ----------
test('1RM formulas and records', () => {
  assert.ok(Math.abs(core.est1RM(100, 5, 'epley') - 116.667) < 0.001);
  assert.ok(Math.abs(core.est1RM(100, 5, 'brzycki') - 112.5) < 0.001);
  assert.equal(core.est1RM(100, 1, 'mayhew'), 100);
  const bests = { e1rm: 116.67, weight: 100, volume: 500 };
  assert.deepEqual(core.newRecords({ type: 'normal', w: 70, r: 10 }, 'barbell', bests, 'epley', Date.now()), ['volume']);
  assert.deepEqual(core.newRecords({ type: 'warmup', w: 200, r: 10 }, 'barbell', bests, 'epley', Date.now()), []);
  assert.deepEqual(core.newRecords({ type: 'normal', w: 20, r: 10 }, 'assisted_bw', { reps: 8 }, 'epley', Date.now()), ['reps']);
  assert.deepEqual(core.loggedFields('cardio'), ['d', 't']);
});

test('warm-ups: loadable barbell weights, 5 lb dumbbell steps', () => {
  assert.deepEqual(core.warmupSets(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25], true).map((s) => [s.w, s.r]), [[20, 10], [40, 5], [60, 3], [80, 2]]);
  assert.deepEqual(core.warmupSets(70, 45, [], false, core.DEFAULT_WARMUP, 5).map((s) => s.w), [30, 40, 55]);
});

// ---------- drafts ----------
test('drafts keep stored numbers when the text is untouched (no lb/mi drift)', () => {
  const st = { unit: 'lb', distUnit: 'mi' };
  const stored = { id: 's', type: 'normal', w: 61.2349, r: 5, d: 5.0123, t: 1500 };
  let s = stored;
  for (let i = 0; i < 5; i++) s = core.draftToSet(core.setToDraft(s, st), st);
  assert.equal(s.w, stored.w);
  assert.equal(s.d, stored.d);
  const d = core.setToDraft(stored, st);
  d.w = '140';
  assert.ok(Math.abs(core.draftToSet(d, st).w - 140 * core.KG_PER_LB) < 1e-9);
});

// ---------- effort: reps in reserve ----------
test('reps in reserve: 0 · 1 · 2+, stored on the set, RPE reads as it, survives drafts and the CSV', () => {
  assert.deepEqual(core.RIR_CHOICES, [0, 1, 2]);
  // RPE 10 → 0, 9 and 9.5 → 1, 8.5 and below → 2+
  assert.deepEqual([10, 9.5, 9, 8.5, 8, 7.5, 7, 6, 1].map(core.rirFromRpe), [0, 1, 1, 2, 2, 2, 2, 2, 2]);
  assert.equal(core.rirFromRpe('9,5'), 1, 'a draft keeps RPE as text');
  assert.equal(core.rirFromRpe(''), null);
  assert.equal(core.rirFromRpe(undefined), null);
  // nothing above 2: older sets with 3 read as 2+
  assert.deepEqual([0, 1, 2, 3, 5, '2', -1, null, '', 'x'].map(core.normRir), [0, 1, 2, 2, 2, 2, null, null, null, null]);
  assert.equal(core.setRir({ type: 'normal', rir: 3 }), 2);
  assert.deepEqual([0, 1, 2, 3].map(core.rpeFromRir), [10, 9, 8, 8]);
  assert.equal(core.rpeFromRir(null), null);
  // a set's own rating wins over its RPE; a failure set has 0 left
  assert.equal(core.setRir({ rir: 1, rpe: 8 }), 1);
  assert.equal(core.setRir({ rpe: 8 }), 2);
  assert.equal(core.setRir({ type: 'failure', w: 60, r: 8 }), 0);
  assert.equal(core.setRir({ type: 'normal', w: 60, r: 8 }), null);
  assert.equal(core.setRir(null), null);
  // drafts carry it both ways; rating clears the RPE
  const st = { unit: 'kg', distUnit: 'km' };
  const d = core.setToDraft({ id: 's', type: 'normal', w: 80, r: 8, rir: 2 }, st);
  assert.equal(d.rir, 2);
  assert.equal(core.draftToSet(d, st).rir, 2);
  assert.equal(core.draftToSet(core.setToDraft({ id: 's', type: 'normal', w: 80, r: 8, rir: 3 }, st), st).rir, 2, 'an older 3 is saved as 2+');
  assert.equal('rir' in core.draftToSet(core.setToDraft({ id: 's', type: 'normal', w: 80, r: 8 }, st), st), false);
  const draft = core.newSetDraft('normal', { w: '80', r: '8', rpe: '8.5' });
  core.rateSet(draft, 2);
  assert.equal(draft.rir, 2);
  assert.equal(draft.rpe, '');
  assert.deepEqual(core.draftToSet(draft, st), { id: draft.id, type: 'normal', w: 80, r: 8, rir: 2 });
  core.rateSet(draft, null);
  assert.equal('rir' in draft, false);
  // templates don't take a set's rating as a target
  const tpl = core.applyWorkoutToTemplate([E('a', [S('normal', 60, 8)])], { exercises: [E('a', [S('normal', 62.5, 8, { rir: 1 })])] }, { valuesOnly: true });
  assert.equal('rir' in tpl[0].sets[0], false);
  // Strong's CSV only knows RPE: 10 − reps left, 2+ → 8
  const exercises = new Map([['x', { id: 'x', name: 'Bench Press (Barbell)', category: 'barbell' }]]);
  const csv = core.exportCSV({ workouts: [{ id: 'w', name: 'Push', startedAt: Date.UTC(2026, 10, 3, 9), endedAt: Date.UTC(2026, 10, 3, 10), exercises: [E('x', [S('normal', 80, 8, { rir: 1 }), S('normal', 80, 8, { rir: 2 }), S('normal', 80, 8, { rir: 0 }), S('normal', 80, 8, { rpe: 8.5 }), S('normal', 80, 8)])] }], exercises });
  assert.deepEqual(csv.trim().split('\n').slice(1).map((l) => l.split(',').pop()), ['9', '8', '10', '8.5', '']);
});

test('reps in reserve: 0 is failure, both ways', () => {
  // rating 0 makes a working set a failure set
  const set = core.newSetDraft('normal', { w: '80', r: '8' });
  core.rateSet(set, 0);
  assert.equal(set.type, 'failure');
  assert.equal(set.rir, 0);
  // another rating, or none, makes it a working set again
  core.rateSet(set, 1);
  assert.deepEqual([set.type, set.rir], ['normal', 1]);
  core.rateSet(set, 0);
  core.rateSet(set, null);
  assert.equal(set.type, 'normal');
  assert.equal('rir' in set, false);
  // choosing Failure sets 0 left (and the RPE gives way)
  const f = core.newSetDraft('normal', { w: '80', r: '8', rpe: '8', rir: 2 });
  core.setSetType(f, 'failure');
  assert.deepEqual([f.type, f.rir, f.rpe], ['failure', 0, '']);
  // leaving Failure drops the 0, so a working set isn't left at 0
  core.setSetType(f, 'normal');
  assert.equal(f.type, 'normal');
  assert.equal('rir' in f, false);
  // other ratings survive a type change; warm-ups and drop sets keep their type when rated 0
  const g = core.newSetDraft('normal', { rir: 1 });
  core.setSetType(g, 'drop');
  assert.deepEqual([g.type, g.rir], ['drop', 1]);
  core.rateSet(g, 0);
  assert.deepEqual([g.type, g.rir], ['drop', 0]);
  const w = core.newSetDraft('warmup');
  core.rateSet(w, 0);
  assert.equal(w.type, 'warmup');
  // a failure set is saved with 0 left
  const st = { unit: 'kg', distUnit: 'km' };
  const h = core.newSetDraft('normal', { w: '100', r: '5' });
  core.setSetType(h, 'failure');
  assert.deepEqual(core.draftToSet(h, st), { id: h.id, type: 'failure', w: 100, r: 5, rir: 0 });
});
// ---------- the session ----------
test('session: units keep supersets together, rounds alternate, the next set follows the person', () => {
  const set = (id, done = false) => ({ id, type: 'normal', w: '', r: '', d: '', t: '', rpe: '', done });
  const entry = (id, sets, supersetId = null) => ({ id, exerciseId: `x-${id}`, supersetId, sets });
  const draft = {
    exercises: [
      entry('a', [set('a1', true), set('a2', true)]),
      entry('b', [set('b1', true), set('b2'), set('b3')], 'S'),
      entry('c', [set('c1', true), set('c2')], 'S'),
      entry('d', [set('d1')]),
    ],
  };
  const units = core.sessionUnits(draft.exercises);
  assert.deepEqual(units.map((u) => u.entries.map((e) => e.id)), [['a'], ['b', 'c'], ['d']]);
  assert.deepEqual(core.unitSets(units[1]).map((x) => x.set.id), ['b1', 'c1', 'b2', 'c2', 'b3']);
  // the first unit with sets left, one superset round after another
  let st = core.sessionState(draft);
  assert.equal(st.unit.id, 'b');
  assert.equal(st.next.set.id, 'b2');
  // while resting after the last set of a, a stays on screen with nothing to log
  st = core.sessionState(draft, { restEntryId: 'a' });
  assert.equal(st.unit.id, 'a');
  assert.equal(st.next, null);
  // the exercise the person switched to wins, also over the rest
  st = core.sessionState(draft, { current: 'd', restEntryId: 'a' });
  assert.equal(st.next.set.id, 'd1');
  assert.equal(core.sessionState(draft, { current: 'c' }).unit.id, 'b', 'any exercise of a superset picks the superset');
  assert.equal(core.sessionState(draft, { current: 'gone' }).unit.id, 'b');
  // all done: the last unit, nothing next
  const done = { exercises: [entry('a', [set('a1', true)]), entry('d', [set('d1', true)])] };
  assert.equal(core.hasPendingSets(done), false);
  assert.equal(core.hasPendingSets(draft), true);
  st = core.sessionState(done);
  assert.equal(st.unit.id, 'd');
  assert.equal(st.next, null);
  assert.equal(core.sessionState({ exercises: [] }).unit, null);
  // moving a superset moves both of its exercises
  const list = draft.exercises.slice();
  assert.equal(core.moveUnit(list, 'd', 'b'), true);
  assert.deepEqual(list.map((e) => e.id), ['a', 'd', 'b', 'c']);
  assert.equal(core.moveUnit(list, 'b', 'a'), true);
  assert.deepEqual(list.map((e) => e.id), ['b', 'c', 'a', 'd']);
  assert.equal(core.moveUnit(list, 'b', 'b'), false);
  assert.equal(core.moveUnit(list, 'zz', 'b'), false);
  // the keypad's −/+ step: a pair of the smallest plates, the dumbbell rack's step
  assert.equal(core.weightStep('barbell', { unit: 'kg', plates: core.KG_PLATES }), 2.5);
  assert.equal(core.weightStep('barbell', { unit: 'kg', plates: [20, 10, 0.5] }), 1);
  assert.equal(core.weightStep('barbell', { unit: 'lb', plates: core.LB_PLATES }), 5);
  assert.equal(core.weightStep('dumbbell', { unit: 'kg' }), 2);
  assert.equal(core.weightStep('dumbbell', { unit: 'lb' }), 5);
  assert.equal(core.weightStep('machine', { unit: 'kg' }), 2.5);
});

// ---------- templates ----------
const E = (exerciseId, sets, extra = {}) => ({ exerciseId, sets, ...extra });
const S = (type, w, r, extra = {}) => ({ type, w, r, ...extra });
test('templateChanges pairs warm-ups and working sets separately', () => {
  const tpl = { exercises: [E('a', [S('warmup', 20, 10), S('normal', 60, 8), S('normal', 60, 8)]), E('b', [S('normal', 40, 8)])] };
  const skipWarmup = core.templateChanges(tpl, { exercises: [E('a', [S('normal', 60, 8), S('normal', 60, 8)]), tpl.exercises[1]] });
  assert.equal(skipWarmup.removedSets, 1);
  assert.equal(skipWarmup.valueSets, 0);
  assert.equal(skipWarmup.typesChanged, false);
  assert.deepEqual(skipWarmup.sets, [], 'warm-ups are not counted as straight sets');
  assert.equal(skipWarmup.warmupsChanged, true, 'but a warm-up fewer is a change of its own');
  assert.equal(skipWarmup.structure, true);
  const reordered = core.templateChanges(tpl, { exercises: [tpl.exercises[1], tpl.exercises[0]] });
  assert.equal(reordered.reordered, true);
  assert.deepEqual(reordered.sets, [], 'moving exercises changes no set counts');
  // per exercise: what the routine loses and gains, for the popup's +/− lines
  const swapped = core.templateChanges(tpl, { exercises: [E('a', [S('warmup', 20, 10), S('normal', 60, 8), S('normal', 60, 8), S('normal', 60, 8)]), E('c', [S('normal', 30, 12), S('normal', 30, 12)])] });
  assert.deepEqual(swapped.sets, [{ exerciseId: 'a', from: 2, to: 3 }, { exerciseId: 'b', from: 1, to: 0, removed: true }, { exerciseId: 'c', from: 0, to: 2, added: true }], 'straight sets only');
  assert.equal(swapped.warmupsChanged, false);
  // intensifiers: a drop set is its own change, not a straight set; a failure set is a straight set and its own change
  const dropped = core.templateChanges(tpl, { exercises: [E('a', [S('warmup', 20, 10), S('normal', 60, 8), S('normal', 60, 8), S('drop', 40, 10)]), tpl.exercises[1]] });
  assert.deepEqual(dropped.sets, []);
  assert.deepEqual([dropped.dropsChanged, dropped.failuresChanged, dropped.warmupsChanged, dropped.structure], [true, false, false, true]);
  const failed = core.templateChanges(tpl, { exercises: [E('a', [S('warmup', 20, 10), S('normal', 60, 8), S('failure', 60, 9)]), tpl.exercises[1]] });
  assert.deepEqual(failed.sets, [], 'a set taken to failure is still a straight set');
  assert.deepEqual([failed.failuresChanged, failed.dropsChanged, failed.structure], [true, false, true]);
  assert.equal(core.templateChanges(tpl, JSON.parse(JSON.stringify(tpl))).structure, false);
});

test('progressTemplate with the layout keeps drop sets, failure sets and supersets', () => {
  const tpl = [E('a', [S('warmup', 20, 10), S('normal', 60, 8)]), E('b', [S('normal', 40, 10)])];
  const workout = { exercises: [
    E('a', [S('warmup', 20, 10), S('failure', 60, 9), S('drop', 40, 10)], { supersetId: 'g' }),
    E('b', [S('normal', 40, 10)], { supersetId: 'g' }),
  ] };
  const { exercises } = core.progressTemplate(tpl, workout, () => 'weight', { layout: true });
  assert.deepEqual(exercises[0].sets.map((x) => x.type), ['warmup', 'failure', 'drop']);
  assert.deepEqual(exercises.map((e) => e.supersetId), ['g', 'g']);
});

test('applyWorkoutToTemplate: values only vs. the new structure; RPE is kept', () => {
  const tpl = [E('a', [S('warmup', 20, 10), S('normal', 60, 8)], { notes: 'Pause reps' }), E('b', [{ type: 'normal', r: 8 }])];
  const workout = { exercises: [E('a', [S('normal', 62.5, 8, { rpe: 8 }), S('failure', 62.5, 6)]), E('c', [{ type: 'normal', r: 12 }])] };
  const values = core.applyWorkoutToTemplate(tpl, workout, { valuesOnly: true });
  assert.deepEqual(values[0].sets, [S('warmup', 20, 10), S('normal', 62.5, 8, { rpe: 8 })]);
  assert.equal(values.length, 2);
  const all = core.applyWorkoutToTemplate(tpl, workout);
  assert.deepEqual(all.map((e) => e.exerciseId), ['a', 'c']);
  assert.equal(all[0].notes, 'Pause reps');
  const clean = core.cleanTemplateExercises([E('a', [S('normal', 60, 8, { rpe: 7, id: 'x', done: true })], { supersetId: 'g' }), E('gone', [])], (id) => id !== 'gone');
  assert.deepEqual(clean[0].sets, [S('normal', 60, 8, { rpe: 7 })]);
  assert.equal(clean.length, 1);
});

test('compareSets: more weight, or the same weight and more reps; less assistance; more time; cardio further or faster', () => {
  const c = (r, d, cat) => core.compareSets(r, d, cat);
  // weight first, then reps
  assert.equal(c({ w: 60, r: 8 }, { w: 62.5, r: 5 }, 'barbell'), 1);
  assert.equal(c({ w: 60, r: 8 }, { w: 60, r: 9 }, 'dumbbell'), 1);
  assert.equal(c({ w: 60, r: 8 }, { w: 60, r: 8 }, 'machine'), 0);
  assert.equal(c({ w: 60, r: 8 }, { w: 60, r: 7 }, 'barbell'), -1);
  assert.equal(c({ w: 60, r: 8 }, { w: 57.5, r: 12 }, 'barbell'), -1);
  assert.equal(c({ w: 10, r: 8 }, { w: 12.5, r: 6 }, 'weighted_bw'), 1);
  // reps only
  assert.equal(c({ r: 8 }, { r: 10 }, 'reps'), 1);
  assert.equal(c({ r: 8 }, { r: 8 }, 'reps'), 0);
  // assisted: less assistance wins, then more reps; more assistance never does
  assert.equal(c({ w: 20, r: 8 }, { w: 15, r: 6 }, 'assisted_bw'), 1);
  assert.equal(c({ w: 20, r: 8 }, { r: 5 }, 'assisted_bw'), 1, 'no assistance at all');
  assert.equal(c({ w: 20, r: 8 }, { w: 20, r: 10 }, 'assisted_bw'), 1);
  assert.equal(c({ w: 20, r: 8 }, { w: 25, r: 12 }, 'assisted_bw'), -1);
  // time-only exercises (planks, holds): more time
  assert.equal(c({ t: 60 }, { t: 75 }, 'duration'), 1);
  assert.equal(c({ t: 60 }, { t: 60 }, 'duration'), 0);
  assert.equal(c({ t: 60 }, { t: 45 }, 'duration'), -1);
  // cardio: more distance, or the same distance in less time
  assert.equal(c({ d: 5, t: 1500 }, { d: 5.2, t: 1700 }, 'cardio'), 1, 'further, even if it took longer');
  assert.equal(c({ d: 5, t: 1500 }, { d: 4.8, t: 1400 }, 'cardio'), -1, 'shorter, even if quicker');
  assert.equal(c({ d: 5, t: 1500 }, { d: 5, t: 1440 }, 'cardio'), 1, 'the same distance, faster');
  assert.equal(c({ d: 5, t: 1500 }, { d: 5, t: 1560 }, 'cardio'), -1, 'the same distance, slower');
  assert.equal(c({ d: 5, t: 1500 }, { d: 5, t: 1500 }, 'cardio'), 0);
  assert.equal(c({ d: 5, t: 1500 }, { d: 5 }, 'cardio'), 0, 'no time logged is not faster');
  assert.equal(c({ d: 5 }, { d: 5, t: 1500 }, 'cardio'), 0, 'a first time at the same distance is not faster either');
  assert.equal(c({ t: 1200 }, { t: 1500 }, 'cardio'), 1, 'cardio logged by time only: more time');
  assert.equal(c({ t: 1200 }, { d: 3, t: 900 }, 'cardio'), 1, 'a distance where there was none');
  // a routine set without numbers takes any done numbers; an empty done set never wins
  assert.equal(c({ type: 'normal' }, { w: 40, r: 10 }, 'barbell'), 1);
  assert.equal(c({ w: 60, r: 8 }, { type: 'normal' }, 'barbell'), -1);
  assert.equal(c({ w: 60, r: 8 }, { w: 60.0000001, r: 8 }, 'barbell'), 0, 'rounding noise is not progress');
});

test("progressTemplate: a routine's numbers only go up; skipped sets and exercises keep theirs", () => {
  const cat = (id) => ({ a: 'barbell', b: 'assisted_bw', c: 'duration' })[id];
  const tpl = [
    E('a', [S('warmup', 40, 10), S('normal', 60, 8, { rpe: 8 }), S('normal', 60, 8), S('normal', 60, 6)], { notes: 'Pause reps' }),
    E('b', [S('normal', 20, 8), S('normal', 20, 8)]),
    E('c', [{ type: 'normal', t: 60 }]),
  ];
  const before = JSON.parse(JSON.stringify(tpl));
  // the warm-up was skipped, the 1st working set went up, the 2nd stayed, the 3rd went down; b got more assistance; c wasn't done
  const workout = { exercises: [
    E('a', [S('normal', 62.5, 8, { rpe: 9, rir: 1 }), S('normal', 60, 8), S('normal', 55, 6)]),
    E('b', [S('normal', 25, 10), S('normal', 15, 8)]),
  ] };
  const { exercises, raised } = core.progressTemplate(tpl, workout, cat);
  assert.equal(raised, 2);
  assert.deepEqual(exercises[0].sets, [
    S('warmup', 40, 10), // skipped warm-up: kept, and the working sets don't shift onto it
    S('normal', 62.5, 8, { rpe: 8 }), // better: the done numbers, the routine's own RPE target
    S('normal', 60, 8), // as good: kept
    S('normal', 60, 6), // worse: kept
  ]);
  assert.equal(exercises[0].notes, 'Pause reps');
  assert.deepEqual(exercises[1].sets, [S('normal', 20, 8), S('normal', 15, 8)], 'less assistance goes in, more stays out');
  assert.deepEqual(exercises[2], tpl[2], 'a skipped exercise keeps its numbers');
  assert.deepEqual(tpl, before, 'the routine passed in is left alone');
  // warm-ups pair with warm-ups: a heavier warm-up goes up on its own
  const warm = core.progressTemplate([E('a', [S('warmup', 40, 10), S('normal', 60, 8)])], { exercises: [E('a', [S('warmup', 50, 10), S('normal', 60, 8)])] }, cat);
  assert.deepEqual(warm.exercises[0].sets, [S('warmup', 50, 10), S('normal', 60, 8)]);
  assert.equal(warm.raised, 1);
  // nothing better: nothing raised, the same sets
  const same = core.progressTemplate(tpl, { exercises: [E('a', [S('warmup', 40, 10), S('normal', 60, 8)])] }, cat);
  assert.equal(same.raised, 0);
  assert.deepEqual(same.exercises, tpl);
});

test("progressTemplate with layout: the workout's exercises and sets; paired sets still only go up", () => {
  const cat = () => 'barbell';
  const tpl = [
    E('a', [S('normal', 60, 8), S('normal', 60, 8)], { notes: 'Pause reps', restSec: 120 }),
    E('b', [S('normal', 40, 10)]),
    E('c', [S('normal', 30, 12)]),
  ];
  // c removed, d added, b moved first, a got a third set and a worse first set
  const workout = { exercises: [
    E('b', [S('normal', 42.5, 10)]),
    E('a', [S('normal', 57.5, 8), S('normal', 62.5, 8), S('failure', 50, 10)], { restSec: 90, supersetId: 'g' }),
    E('d', [S('normal', 20, 15, { rir: 2 })]),
  ] };
  const { exercises, raised } = core.progressTemplate(tpl, workout, cat, { layout: true });
  assert.deepEqual(exercises.map((e) => e.exerciseId), ['b', 'a', 'd']);
  assert.deepEqual(exercises[0].sets, [S('normal', 42.5, 10)]);
  assert.deepEqual(exercises[1].sets, [S('normal', 60, 8), S('normal', 62.5, 8), S('failure', 50, 10)], 'worse kept, better taken, new as done');
  assert.equal(exercises[1].notes, 'Pause reps');
  assert.equal(exercises[1].restSec, 90);
  assert.equal(exercises[1].supersetId, 'g');
  assert.deepEqual(exercises[2].sets, [S('normal', 20, 15)], 'a new exercise takes what was done, without the rating');
  assert.equal(raised, 2);
  // templateChanges names what was added and removed
  const ch = core.templateChanges({ exercises: tpl }, workout);
  assert.deepEqual(ch.added, ['d']);
  assert.deepEqual(ch.removed, ['c']);
  assert.equal(ch.addedSets, 1);
  assert.equal(ch.reordered, true);
});

// ---------- suggestion ----------
test('suggested workout: rotation, weekday habit, a routine change after about two rounds', () => {
  const now = new Date(2026, 9, 14, 18, 0).getTime(); // a Wednesday
  const templates = ['Push', 'Pull', 'Legs', 'Upper'].map((name) => ({ id: name, name }));
  const run = (plan) => {
    const workouts = plan.map(([d, n], i) => ({ id: 'w' + i, name: n, templateId: n, startedAt: now - d * DAY - 8 * 3600000, exercises: [] }));
    const r = core.suggestTemplate(templates, workouts, now);
    return r && [r.template.name, r.why.kind];
  };
  const routine = (weeks, fresh) => {
    const plan = [];
    for (let w = weeks; w >= 1; w--) plan.push([7 * w + 2, 'Legs'], [7 * w, w <= fresh ? 'Upper' : 'Push'], [7 * w - 2, 'Pull']);
    plan.push([2, 'Legs']);
    return plan;
  };
  assert.equal(run(routine(10, 0))[0], 'Push');
  assert.equal(run(routine(10, 1))[0], 'Push');
  assert.equal(run(routine(10, 2))[0], 'Upper');
  assert.deepEqual(run([[23, 'Push'], [21, 'Pull'], [18, 'Legs'], [15, 'Push'], [12, 'Pull'], [10, 'Legs'], [6, 'Push'], [3, 'Pull']]), ['Legs', 'after']);
  assert.deepEqual(run([[28, 'Legs'], [26, 'Push'], [21, 'Legs'], [19, 'Pull'], [14, 'Legs'], [12, 'Push'], [7, 'Legs'], [2, 'Pull']]), ['Legs', 'weekday']);
  assert.equal(run([[3, 'Push']]), null);
});

// ---------- sessions ----------
test('previous sets prefer the same template; body weight on a day', () => {
  const sessions = core.sessionsByExercise([
    { id: 'old', startedAt: 1000, templateId: 'A', exercises: [E('x', [S('normal', 70, 5)])] },
    { id: 'new', startedAt: 2000, templateId: null, exercises: [E('x', [S('normal', 80, 5)])] },
  ]).get('x');
  assert.equal(core.previousSetsFrom(sessions)[0].w, 80);
  assert.equal(core.previousSetsFrom(sessions, { templateId: 'A' })[0].w, 70);
  assert.equal(core.previousSetsFrom(sessions, { before: 1500 })[0].w, 70);
  const ms = [{ type: 'bodyweight', value: 82, at: 300 }, { type: 'bodyweight', value: 80, at: 100 }];
  assert.equal(core.bodyweightFrom(ms, 200), 80);
  assert.equal(core.bodyweightFrom(ms, 50), 80);
  assert.equal(core.bodyweightFrom(ms, 400), 82);
});

// ---------- the running workout ----------
const ST = { ...core.DEFAULT_SETTINGS, unit: 'kg', distUnit: 'km' };
const BENCH = core.SEED_EXERCISES.find((e) => e.name === 'Bench Press (Barbell)');
const PULLUP = core.SEED_EXERCISES.find((e) => e.name === 'Pull Up');
test('starting from a template: targets as placeholders, last time beats the template', () => {
  const tpl = { id: 't1', name: 'Push', notes: 'Heavy day', exercises: [E(BENCH.id, [S('warmup', 40, 8), S('normal', 80, 8), S('normal', 80, 8)], { supersetId: 'g' }), E('gone', [S('normal', 10, 10)])] };
  const a = core.newActiveWorkout({ template: tpl, hasExercise: (id) => id !== 'gone', settings: ST, now: 1000 });
  assert.equal(a.name, 'Push');
  assert.equal(a.templateId, 't1');
  assert.equal(a.templateNotes, 'Heavy day');
  assert.equal(a.exercises.length, 1);
  assert.notEqual(a.exercises[0].supersetId, 'g');
  assert.equal(core.newActiveWorkout({ template: { ...tpl, example: true }, settings: ST }).templateId, null);
  const entry = a.exercises[0];
  // no history: the template's targets
  assert.deepEqual(core.placeholders(entry, null, ST).map((r) => [r.ph.w, r.ph.r]), [['40', '8'], ['80', '8'], ['80', '8']]);
  // history: last time's sets, warm-ups paired with warm-ups
  const rows = core.placeholders(entry, [S('normal', 85, 6)], ST);
  assert.deepEqual(rows.map((r) => r.ph.w), ['40', '85', '80']);
  assert.equal(rows[1].prev.w, 85);
  assert.equal(core.workoutNameKey(new Date(2026, 0, 1, 7).getTime()), 'Morning Workout');
});

test('checking off: fills from placeholders, says what is missing, rest after the superset round', () => {
  const a = core.newActiveWorkout({ settings: ST, name: 'Evening Workout' });
  a.exercises.push(...core.newEntries([BENCH.id, PULLUP.id], { previousSets: () => null }));
  const [bench, pull] = a.exercises;
  // nothing typed and nothing to fall back on
  let r = core.checkOffSet(a, bench, 0, { category: BENCH.category, ph: { w: '', r: '' }, rest: 120, settings: ST });
  assert.equal(r.problem, core.WORKOUT_MESSAGES.repsFirst);
  bench.sets[0].r = '8';
  r = core.checkOffSet(a, bench, 0, { category: BENCH.category, ph: { w: '', r: '' }, rest: 120, settings: ST });
  assert.equal(r.problem, core.WORKOUT_MESSAGES.weightFirst);
  r = core.checkOffSet(a, bench, 0, { category: BENCH.category, ph: { w: '80', r: '5', orig: { w: ['80', 80] } }, rest: 120, settings: ST });
  assert.deepEqual(r, { rest: 120 });
  assert.equal(bench.sets[0].done, true);
  assert.deepEqual([bench.sets[0].w, bench.sets[0].r], ['80', '8']);
  // body weight exercises need no weight
  r = core.checkOffSet(a, pull, 0, { category: PULLUP.category, ph: { r: '10' }, rest: 90, settings: ST });
  assert.equal(r.rest, 90);
  // supersets: rest only after the last exercise of the round
  core.joinSuperset(a.exercises, bench, pull);
  assert.deepEqual(a.exercises, [pull, bench], 'bench moves behind the exercise it joined');
  core.addSet(pull);
  r = core.checkOffSet(a, pull, 1, { category: PULLUP.category, ph: { r: '10' }, rest: 90, settings: ST });
  assert.equal(r.rest, 0, 'no rest between the exercises of a superset');
  core.addSet(bench); bench.sets[1].type = 'warmup';
  r = core.checkOffSet(a, bench, 1, { category: BENCH.category, ph: { w: '40', r: '5' }, rest: 120, settings: ST });
  assert.equal(r.rest, 60, 'after the round; warm-ups rest at most a minute');
  core.leaveSuperset(a.exercises, bench);
  assert.equal(pull.supersetId, null);
});

test('finishing: unchecked sets with numbers, progress, the saved workout', () => {
  const a = core.newActiveWorkout({ settings: ST, now: 10000, name: 'Morning Workout' });
  a.exercises.push(...core.newEntries([BENCH.id], { previousSets: () => [S('normal', 80, 5), S('normal', 80, 5)] }));
  const bench = a.exercises[0];
  assert.equal(bench.sets.length, 2);
  bench.sets[0].w = '82,5'; bench.sets[0].r = '5'; bench.sets[0].done = true;
  bench.sets[1].r = '4';
  assert.deepEqual(core.progressOf(a), { done: 1, typed: 1 });
  const prev = () => [S('normal', 80, 5), S('normal', 80, 5)];
  const pending = core.pendingSets(a, { exercises: new Map([[BENCH.id, BENCH]]), previousSets: prev, settings: ST });
  assert.equal(pending.length, 1);
  assert.deepEqual([pending[0].filled.w, pending[0].filled.r], ['80', '4'], 'the missing weight comes from last time');
  const noHistory = core.pendingSets(a, { exercises: new Map([[BENCH.id, BENCH]]), previousSets: () => null, settings: ST });
  assert.equal(noHistory[0].filled.w, '82,5', 'without history, from the row above');
  const w = core.finishWorkout(a, { settings: ST, exercises: new Map([[BENCH.id, BENCH]]), now: 20000, defaultName: 'X' });
  assert.equal(w.name, 'Morning Workout');
  assert.equal(w.endedAt, 10000 + 60000, 'at least a minute');
  assert.deepEqual(w.exercises[0].sets.map((s) => [s.w, s.r]), [[82.5, 5]]);
  a.name = '  ';
  assert.equal(core.finishWorkout(a, { settings: ST, exercises: new Map([[BENCH.id, BENCH]]), defaultName: 'X' }).name, 'X');
});

test('warm-ups, replacing an exercise, moving entries', () => {
  const entry = core.newEntryDraft(BENCH.id, 1);
  const rows = core.placeholders(entry, [S('normal', 100, 5)], ST);
  assert.deepEqual(core.addWarmups(entry, rows, 'barbell', ST), { added: 4 });
  assert.deepEqual(entry.sets.map((s) => [s.type, s.w]), [['warmup', '20'], ['warmup', '40'], ['warmup', '60'], ['warmup', '80'], ['normal', '']]);
  assert.deepEqual(core.addWarmups(core.newEntryDraft(BENCH.id, 1), [{ ph: {} }], 'barbell', ST), { problem: core.WORKOUT_MESSAGES.warmupNeedsWeight });
  entry.restSec = 180; entry.focus = 'volume'; entry.sets[4].w = '100'; entry.sets[4].r = '5';
  core.replaceExercise(entry, BENCH, PULLUP);
  assert.deepEqual([entry.exerciseId, entry.restSec, entry.focus, entry.sets[4].w], [PULLUP.id, null, null, '']);
  const list = ['a', 'b', 'c'];
  assert.equal(core.moveItem(list, 0, 2), true);
  assert.deepEqual(list, ['b', 'c', 'a']);
  assert.equal(core.restFor({ restSec: null }, { restSec: 90 }, 120), 90);
  assert.equal(core.restFor({}, {}, 120), 120);
});

// ---------- editing templates and finished workouts ----------
test('template editor: from a template or a workout, saving, problems', () => {
  const ex = new Map([[BENCH.id, BENCH], [PULLUP.id, PULLUP]]);
  const tpl = {
    id: 't1', name: 'Upper', folder: 'A', notes: 'n', createdAt: 5, lastUsedAt: 9,
    exercises: [
      { exerciseId: BENCH.id, notes: 'grip', supersetId: 'g', restSec: 90, sets: [{ type: 'normal', w: 80, r: 5 }, { type: 'normal', r: 8 }] },
      { exerciseId: PULLUP.id, supersetId: 'g', sets: [{ type: 'normal', r: 10 }] },
      { exerciseId: 'gone', sets: [{ type: 'normal', r: 1 }] },
    ],
  };
  const d = core.templateDraft({ template: tpl, settings: ST, hasExercise: (id) => ex.has(id) });
  assert.deepEqual([d.kind, d.id, d.name, d.folder, d.notes, d.exercises.length], ['template', 't1', 'Upper', 'A', 'n', 2]);
  assert.notEqual(d.exercises[0].supersetId, 'g', 'fresh superset ids');
  assert.equal(d.exercises[0].supersetId, d.exercises[1].supersetId);
  assert.deepEqual([d.exercises[0].sets[0].w, d.exercises[0].sets[1].w, d.exercises[0].notes], ['80', '', 'grip']);
  d.exercises[0].sets[1].w = '85';
  const r = core.templateFromDraft(d, { settings: ST, exercises: ex, existing: tpl, now: 100 });
  assert.equal(r.problem, undefined);
  assert.deepEqual([r.template.createdAt, r.template.lastUsedAt, r.template.name], [5, 9, 'Upper'], 'other fields are kept');
  assert.deepEqual(r.template.exercises[0].sets, [{ type: 'normal', w: 80, r: 5 }, { type: 'normal', w: 85, r: 8 }]);
  assert.equal(r.template.exercises[0].restSec, 90);
  assert.equal('id' in r.template.exercises[0].sets[0], false, 'template sets have no ids');
  d.name = '  ';
  assert.equal(core.templateFromDraft(d, { settings: ST, exercises: ex }).problem, core.EDIT_MESSAGES.templateName);
  const fromWorkout = core.templateDraft({ workout: { name: 'Leg day', notes: 'tired', exercises: [{ exerciseId: BENCH.id, notes: 'x', sets: [S('normal', 100, 3)] }] }, settings: ST });
  assert.deepEqual([fromWorkout.name, fromWorkout.notes, fromWorkout.exercises[0].notes, fromWorkout.folder], ['Leg day', '', '', '']);
  assert.notEqual(fromWorkout.id, undefined);
  const empty = core.templateDraft({ settings: ST });
  empty.name = 'New';
  assert.equal(core.templateFromDraft(empty, { settings: ST, exercises: ex }).problem, core.EDIT_MESSAGES.templateEmpty);
  empty.exercises.push(core.newEntryDraft(BENCH.id, 3));
  const made = core.templateFromDraft(empty, { settings: ST, exercises: ex, now: 7 }).template;
  assert.deepEqual([made.createdAt, made.exercises[0].sets.length], [7, 3], 'empty sets are kept in templates');
});

test('edit workout: kept ids, duration in minutes, incomplete sets dropped', () => {
  const ex = new Map([[BENCH.id, BENCH]]);
  const w = {
    id: 'w1', name: 'Push', startedAt: 1000, endedAt: 1000 + 61 * 60000, templateId: 't', source: 'strong',
    exercises: [{ id: 'e1', exerciseId: BENCH.id, sets: [S('normal', 80, 5), S('normal', 80, 4)] }],
  };
  const d = core.workoutEditDraft(w, ST, (id) => ex.has(id));
  assert.deepEqual([d.kind, d.id, d.durationMin, d.exercises[0].id, d.templateId], ['edit', 'w1', '61', 'e1', 't']);
  d.exercises[0].sets[1].r = '';
  d.durationMin = '45,4';
  const r = core.workoutFromEditDraft(d, { settings: ST, exercises: ex, defaultName: 'Workout' });
  assert.deepEqual([r.workout.endedAt, r.workout.exercises[0].sets.length, r.workout.source, r.workout.name], [1000 + 45 * 60000, 1, 'strong', 'Push']);
  assert.equal(r.workout.exercises[0].sets[0].w, 80, 'untouched weights keep the stored number');
  d.exercises[0].sets[0].r = '';
  assert.equal(core.workoutFromEditDraft(d, { settings: ST, exercises: ex }).problem, core.EDIT_MESSAGES.workoutEmpty);
});

test('copies, folders, new exercises, exercise changes waiting in a draft', () => {
  const c = core.copyTemplateRecord({ name: 'A', folder: 'F', exercises: [{ exerciseId: 'x', sets: [{ w: 1, r: 2, id: 'z' }] }, { exerciseId: 'gone', sets: [] }] }, { patch: { name: 'A (copy)' }, hasExercise: (id) => id === 'x', now: 3 });
  assert.deepEqual([c.name, c.folder, c.createdAt, c.exercises.length, c.exercises[0].sets[0]], ['A (copy)', 'F', 3, 1, { type: 'normal', w: 1, r: 2 }]);
  assert.deepEqual(core.folderNames([{ folder: 'B' }, { folder: '' }, { folder: 'A' }, { folder: 'B' }], ['C', 'A']), ['A', 'B', 'C']);
  const lib = new Map([[BENCH.id, BENCH]]);
  assert.equal(core.findExerciseByName(lib, `  ${BENCH.name.toUpperCase()} `), BENCH);
  assert.equal(core.findExerciseByName([BENCH], 'nope'), null);
  const e = core.newExerciseRecord({ name: ' Incline Row (Dumbbell) ', category: 'dumbbell', bodyPart: 'back' }, { now: 1 });
  assert.deepEqual([e.id, e.name, e.createdAt], ['c-incline-row-dumbbell', 'Incline Row (Dumbbell)', 1]);
  assert.notEqual(core.newExerciseRecord({ name: 'Incline Row (Dumbbell)' }, { hasId: () => true }).id, 'c-incline-row-dumbbell');
  const draft = { exercises: [] };
  core.patchDraftExercise(draft, BENCH.id, { restSec: 60 });
  core.patchDraftExercise(draft, BENCH.id, { pinnedNote: 'p' });
  assert.deepEqual([core.exerciseInDraft(lib, draft, BENCH.id).restSec, core.exerciseInDraft(lib, draft, BENCH.id).pinnedNote], [60, 'p']);
  assert.equal(core.exerciseInDraft(lib, null, BENCH.id), BENCH);
});

test('date ticks spread 3M, 6M and 1Y labels over the whole range at regular month starts', () => {
  const at = (y, m, d = 1) => new Date(y, m - 1, d).getTime();
  // Three months: show every boundary when they fit.
  assert.deepEqual(core.dateTicks(at(2026, 8, 1), at(2026, 11, 1)), [8, 9, 10, 11].map((m) => at(2026, m)));
  assert.deepEqual(core.dateTicks(at(2026, 7, 20), at(2026, 11, 4), 3), [9, 11].map((m) => at(2026, m)));
  // Six months, including a year end: a regular two-month step.
  assert.deepEqual(core.dateTicks(at(2026, 5, 5), at(2026, 11, 4)), [7, 9, 11].map((m) => at(2026, m)));
  assert.deepEqual(core.dateTicks(at(2025, 10, 15), at(2026, 4, 15)), [at(2025, 12), at(2026, 2), at(2026, 4)]);
  assert.deepEqual(core.dateTicks(at(2025, 9, 1), at(2026, 2, 28)), [at(2025, 10), at(2025, 12), at(2026, 2)]);
  assert.equal(core.dateTicks(at(2025, 11, 1), at(2026, 11, 1), 1).length, 1);
  // A full year must not leave its first two thirds unlabelled.
  assert.deepEqual(core.dateTicks(at(2025, 11, 5), at(2026, 11, 4)), [2, 5, 8, 11].map((m) => at(2026, m)));
  assert.deepEqual(core.dateTicks(at(2025, 11, 5), at(2026, 11, 4), 3), [5, 11].map((m) => at(2026, m)));
});

test('multi-year date ticks align to January and July, then whole years', () => {
  const at = (y, m, d = 1) => new Date(y, m - 1, d).getTime();
  assert.deepEqual(core.dateTicks(at(2025, 5, 15), at(2026, 11, 4)), [at(2025, 7), at(2026, 1), at(2026, 7)]);
  assert.deepEqual(core.dateTicks(at(2023, 11, 5), at(2026, 11, 4)), [2024, 2025, 2026].map((y) => at(y, 1)));
  assert.deepEqual(core.dateTicks(at(2020, 1, 15), at(2026, 11, 4)), [2022, 2024, 2026].map((y) => at(y, 1)));
  assert.deepEqual(core.dateTicks(at(2024, 1), at(2026, 1)), [2024, 2025, 2026].map((y) => at(y, 1)));
});

test('date ticks handle short, single-point and invalid ranges in local calendar days', () => {
  const from = new Date(2024, 2, 8, 12).getTime(), to = new Date(2024, 2, 20, 12).getTime();
  const ticks = core.dateTicks(from, to);
  assert.ok(ticks.length <= 4 && ticks.length >= 2);
  assert.ok(ticks.every((t) => t >= from && t <= to && new Date(t).getHours() === 0));
  assert.deepEqual(core.dateTicks(from, from), [from]);
  assert.deepEqual(core.dateTicks(from, from + 1000), [from]);
  assert.equal(core.dateTicks(from, to, 1).length, 1);
  assert.deepEqual(core.dateTicks(to, from), []);
  assert.deepEqual(core.dateTicks(NaN, to), []);
  assert.deepEqual(core.dateTicks(from, to, 0), []);
});

test('chart ticks, weekly counts and the streak', () => {
  assert.deepEqual(core.niceTicks(81, 99), [80, 85, 90, 95, 100]);
  assert.deepEqual(core.niceTicks(0, 3, 3, { zero: true }), [0, 1, 2, 3]);
  assert.deepEqual(core.niceTicks(50, 50), [45, 47.5, 50, 52.5, 55]);
  assert.equal(core.niceTicks(100, 400, 4, { time: true })[1] - core.niceTicks(100, 400, 4, { time: true })[0], 120);
  assert.equal(core.tickDecimals([1, 1.5, 2]), 1);
  assert.equal(core.tickDecimals([50, 52.5, 55, 57.5, 60]), 1, 'a 2.5 kg step keeps its half: 52.5, not 53');
  assert.equal(core.tickDecimals([100, 125, 150]), 0);
  assert.equal(core.tickDecimals([1, 1.25, 1.5]), 2);
  assert.equal(core.tickDecimals([0.1, 0.2, 0.3]), 1);
  assert.equal(core.tickDecimals([5]), 0);
  const now = new Date(2026, 9, 21, 12).getTime(); // a Wednesday
  const day = (d) => new Date(2026, 9, d, 18).getTime();
  const ws = [day(20), day(19), day(14), day(13), day(12), day(6)].map((t) => ({ startedAt: t }));
  const weeks = core.weeklyCounts(ws, { weeks: 3, weekStart: 1, now });
  assert.deepEqual(weeks.map((x) => x.value), [1, 3, 2]);
  assert.equal(weeks[2].start, new Date(2026, 9, 19).getTime());
  assert.equal(core.weekStreak(ws, { goal: 2, weekStart: 1, now }), 2);
  assert.equal(core.weekStreak(ws, { goal: 3, weekStart: 1, now }), 1, 'this week doesn’t count until it reaches the goal');
});

test('History calendar: the grid from the week start, workouts per day, the month’s totals', () => {
  const at = (m, d, h = 18, min = 0) => new Date(2026, m, d, h, min).getTime();
  const w = (start, minutes) => ({ id: String(start), startedAt: start, endedAt: start + minutes * 60000 });
  const ws = [w(at(11, 1), 30), w(at(10, 30, 19), 60), w(at(10, 30, 7), 45), w(at(10, 3), 50), w(at(9, 31), 40)];
  // November 2026 starts on a Sunday and ends on a Monday
  const mon = core.calendarMonth(ws, at(10, 17), { weekStart: 1 });
  assert.equal(mon.start, new Date(2026, 10, 1).getTime());
  assert.equal(mon.days.length, 42, 'Monday weeks: Nov 30 needs a sixth row');
  assert.equal(mon.days[0], new Date(2026, 9, 26).getTime());
  assert.equal(new Date(mon.days[0]).getDay(), 1);
  const sun = core.calendarMonth(ws, at(10, 17), { weekStart: 0 });
  assert.equal(sun.days.length, 35, 'Sunday weeks fit in five rows');
  assert.equal(sun.days[0], mon.start);
  assert.equal(mon.workouts, 3, 'Oct 31 and Dec 1 are outside the month');
  assert.equal(mon.daysTrained, 2, 'two workouts on the 30th count as one day');
  assert.equal(mon.time, (60 + 45 + 50) * 60000);
  assert.equal(mon.byDay.get(new Date(2026, 10, 30).getTime()).length, 2);
  assert.ok(mon.byDay.has(new Date(2026, 9, 31).getTime()), 'days of the month before in the grid show their workouts');
  assert.ok(!sun.byDay.has(new Date(2026, 9, 31).getTime()), 'but not outside the grid');
  const empty = core.calendarMonth([], at(1, 10));
  assert.equal(empty.workouts + empty.daysTrained + empty.time, 0);
  assert.equal(empty.days.length % 7, 0);
});

test('Today: the week strip plans usual days up to the goal, from today on', () => {
  const at = (m, d, h = 18) => new Date(2026, m, d, h).getTime();
  // Tuesday 3 November 2026; usually Monday, Thursday and Saturday
  const now = at(10, 3, 9);
  const usual = [];
  for (let wk = 1; wk <= 8; wk++) for (const d of [2, 5, 7]) usual.push({ startedAt: at(10, d - 7 * wk) });
  const ws = [{ startedAt: at(10, 2) }, ...usual, { startedAt: at(9, 1) }];
  const strip = core.weekStrip(ws, { weekStart: 1, goal: 4, now });
  assert.equal(strip.days.length, 7);
  assert.equal(strip.days[0].start, new Date(2026, 10, 2).getTime(), 'the week starts on Monday');
  assert.equal(strip.today, 1);
  assert.deepEqual(strip.days.map((d) => d.done), [1, 0, 0, 0, 0, 0, 0]);
  assert.equal(strip.done, 1);
  assert.deepEqual(strip.days.map((d) => d.planned), [false, false, false, true, false, true, false], 'Thursday and Saturday; Monday is past');
  const two = core.weekStrip(ws, { weekStart: 1, goal: 2, now });
  assert.deepEqual(two.days.map((d) => d.planned), [false, false, false, true, false, false, false], 'only as many as the goal needs');
  const sun = core.weekStrip(ws, { weekStart: 0, goal: 4, now });
  assert.equal(sun.today, 2);
  assert.equal(sun.days[0].start, new Date(2026, 10, 1).getTime());
  const fresh = core.weekStrip([], { weekStart: 1, goal: 3, now });
  assert.ok(fresh.days.every((d) => !d.done && !d.planned), 'no history, nothing planned');
  const met = core.weekStrip([...ws, { startedAt: at(10, 3, 7) }, { startedAt: at(10, 3, 8) }, { startedAt: at(10, 3, 8) }], { weekStart: 1, goal: 4, now });
  assert.ok(met.days.every((d) => !d.planned), 'the goal is reached');
});

test('Today: working sets per muscle in the last 7 days, and a routine’s size', () => {
  const now = new Date(2026, 10, 3, 12).getTime();
  const lib = new Map([
    ['bench', { id: 'bench', bodyPart: 'chest', category: 'barbell' }],
    ['row', { id: 'row', bodyPart: 'back', category: 'barbell', restSec: 90 }],
    ['run', { id: 'run', bodyPart: 'cardio', category: 'cardio' }],
  ]);
  const sets = (n, warm = 0) => [...Array(warm).fill({ type: 'warmup' }), ...Array(n).fill({ type: 'normal' })];
  const w = (day, exercises) => ({ startedAt: new Date(2026, 10, day, 8).getTime(), exercises });
  const ws = [
    w(3, [{ exerciseId: 'row', sets: sets(3) }, { exerciseId: 'bench', sets: sets(4, 2) }]),
    w(1, [{ exerciseId: 'run', sets: sets(1) }, { exerciseId: 'gone', sets: sets(5) }, { exerciseId: 'bench', sets: [{ type: 'drop' }] }]),
    w(-4, [{ exerciseId: 'bench', sets: sets(9) }]), // 27 October: outside the 7 days
  ];
  assert.deepEqual(core.setsPerMuscle(ws, lib, { now }), [
    { muscle: 'chest', label: 'Chest', sets: 5 },
    { muscle: 'back', label: 'Back', sets: 3 },
  ], 'chest first; warm-ups, cardio and unknown exercises don’t count');
  assert.deepEqual(core.setsPerMuscle(ws, Object.fromEntries(lib), { now, days: 14 }).map((m) => m.sets), [14, 3]);
  assert.deepEqual(core.setsPerMuscle([], lib, { now }), []);

  const t = { exercises: [
    { exerciseId: 'bench', sets: sets(3, 2) },
    { exerciseId: 'row', sets: sets(3) },
    { exerciseId: 'gone', sets: sets(3) },
  ] };
  // bench: 2 × (30 + 60) + 3 × (45 + 120); row: 3 × (45 + 90) minus the last rest
  assert.deepEqual(core.routineSize(t, lib, { defaultRest: 120 }), { exercises: 2, sets: 6, minutes: 15 });
  assert.equal(core.routineSize({ exercises: [] }, lib).minutes, 0);
  assert.equal(core.routineSize({ exercises: [{ exerciseId: 'bench', sets: sets(1) }] }, lib).minutes, 5, 'at least 5 minutes');
});

test('merging exercises: same logged fields only; the target keeps its own rest timer and notes', () => {
  const bench = { id: 'x-bench', category: 'barbell', restSec: null, notes: '', pinnedNote: 'Arch' };
  const db = { id: 'x-db', category: 'dumbbell', restSec: 90, notes: 'Slow', pinnedNote: 'Elbows in' };
  const plank = { id: 'x-plank', category: 'duration' };
  const run = { id: 'x-run', category: 'cardio' };
  assert.equal(core.canMergeExercises(db, bench), true, 'weight and reps both');
  assert.equal(core.canMergeExercises(db, plank), false);
  assert.equal(core.canMergeExercises(plank, run), false, 'time vs. distance and time');
  assert.equal(core.canMergeExercises(bench, bench), false, 'not into itself');
  assert.equal(core.canMergeExercises(bench, undefined), false);
  assert.deepEqual(core.mergeExercisePatch(db, bench), { restSec: 90, notes: 'Slow' }, 'the pinned note stays the target’s');
  assert.deepEqual(core.mergeExercisePatch(bench, db), {}, 'a target with everything keeps it');
  assert.deepEqual(core.mergeExercisePatch({ restSec: 0 }, { restSec: undefined }), { restSec: 0 }, 'a timer set to off counts');
  const ws = [
    { id: 'a', exercises: [{ id: 'e1', exerciseId: 'x-db', sets: [] }, { id: 'e2', exerciseId: 'x-row', sets: [] }] },
    { id: 'b', exercises: [{ id: 'e3', exerciseId: 'x-row', sets: [] }] },
  ];
  const before = JSON.stringify(ws);
  const changed = core.moveExerciseEntries(ws, 'x-db', 'x-bench');
  assert.deepEqual(changed.map((x) => x.id), ['a']);
  assert.deepEqual(changed[0].exercises.map((e) => e.exerciseId), ['x-bench', 'x-row']);
  assert.equal(changed[0].exercises[1], ws[0].exercises[1], 'untouched entries keep their identity');
  assert.equal(JSON.stringify(ws), before, 'the records passed in stay as they were');
});

test('warm-up scheme from the editor: decimal commas, empty and odd rows dropped, sorted', () => {
  assert.deepEqual(core.warmupFromInput('8', [['60', '3'], ['42,5', '5'], ['', '4'], ['100', '1'], ['70', '0'], ['85', '1,4']]),
    { barReps: 8, steps: [[42.5, 5], [60, 3], [85, 1]] });
  assert.deepEqual(core.warmupFromInput('', []), { barReps: 0, steps: [] });
  assert.deepEqual(core.warmupFromInput('-3', [['50', '5']]), { barReps: 0, steps: [[50, 5]] });
  const s = core.warmupFromInput('10', [['40', '5'], ['80', '2']]);
  assert.equal(core.warmupSets(100, 20, core.KG_PLATES, true, s).length, 3, 'the result works as a scheme');
});

// ---------- Strong CSV ----------
const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-09-01 18:00:00,"Upper",1h 5m,"T Bar Row",W,60,6,0,0,"","Felt strong",
2026-09-01 18:00:00,"Upper",1h 5m,"T Bar Row",1,110,7,0,0,"","Felt strong",8
2026-09-01 18:00:00,"Upper",1h 5m,"T Bar Row",Rest Timer,0,0,0,150,"Last two sets Kelso","Felt strong",
2026-09-01 18:00:00,"Upper",1h 5m,"Mystery Machine",1,40,12,0,0,"","Felt strong",
2026-09-03 18:00:00,"Run",30m,"Running",1,0,0,5,1800,"","",
`;
test('Strong import: set types, rest timer rows, notes, units, new exercises', () => {
  const preview = core.parseStrongCSV(STRONG, { weightUnit: 'lb', distUnit: 'mi', exercises: core.SEED_EXERCISES });
  assert.deepEqual(preview.review.map((r) => [r.name, r.bodyPart]), [['Mystery Machine', '']]);
  assert.throws(() => core.resolveStrongImport(preview, {}, { exercises: core.SEED_EXERCISES }), /Choose an exercise/);
  const r = core.resolveStrongImport(preview, { 'Mystery Machine': { kind: 'new', name: 'Mystery Machine', category: 'machine', bodyPart: 'back' } }, { exercises: core.SEED_EXERCISES });
  assert.equal(r.workouts.length, 2);
  const upper = r.workouts[0];
  assert.equal(upper.notes, 'Felt strong');
  assert.equal(upper.endedAt - upper.startedAt, 65 * 60000);
  const row = upper.exercises[0];
  assert.deepEqual(row.sets.map((s) => s.type), ['warmup', 'normal']);
  assert.ok(Math.abs(row.sets[1].w - 110 * core.KG_PER_LB) < 1e-3);
  assert.equal(row.sets[1].rpe, 8);
  assert.equal(row.restSec, 150);
  assert.equal(row.notes, 'Last two sets Kelso');
  assert.deepEqual(r.exercises.map((e) => [e.name, e.category]), [['Mystery Machine', 'machine']]);
  assert.ok(Math.abs(r.workouts[1].exercises[0].sets[0].d - 5 * core.KM_PER_MI) < 1e-6);
  assert.throws(() => core.parseStrongCSV('a,b\n1,2', {}), /doesn’t look like a Strong export/);
});

test('own CSV export re-imports as duplicates (seconds vs. milliseconds) with Strong-style durations', () => {
  const ex = core.SEED_EXERCISES.find((e) => e.name === 'Bench Press (Barbell)');
  const workouts = [{ id: 'a', name: 'Push', startedAt: Date.UTC(2026, 9, 1, 16, 0, 0, 123), endedAt: Date.UTC(2026, 9, 1, 17, 5, 0), exercises: [E(ex.id, [S('normal', 80, 8)])] }];
  const csv = core.exportCSV({ workouts, exercises: new Map([[ex.id, ex]]) });
  assert.match(csv, /,1h 5m,/);
  const preview = core.parseStrongCSV(csv, { weightUnit: 'kg', exercises: [ex], workouts });
  const again = core.resolveStrongImport(preview, {}, { exercises: [ex], workouts });
  assert.equal(again.workouts.length, 0);
  assert.equal(again.stats.duplicates, 1);
  assert.deepEqual([core.strongDuration(45 * 60000), core.strongDuration(2 * 3600000)], ['45m', '2h']);
});

const strongFile = (rows) => 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes\n'
  + rows.map(([name, w = 20, r = 8, d = 0, t = 0, date = '2026-10-01 12:00:00', notes = '', workoutNotes = '']) =>
    `${date},Import,30m,"${name}",1,${w},${r},${d},${t},${notes},${workoutNotes}`).join('\n');

test('Strong suggestions: spelling, plurals, punctuation, accents, equipment and shortcuts; never shared words alone', () => {
  const suggestions = (name, category = 'machine', exercises = core.SEED_EXERCISES) => core.strongExerciseSuggestions(name, category, exercises);
  for (const name of ['Kenan Flaps', 'Keenan Flaps', 'KÉÉNAN—FLAP (Cable)', 'Keenan Flap']) {
    const [s] = suggestions(name);
    assert.equal(s.id, 'x-keenan-flap-cable', name);
    assert.equal(s.preselect, true, name);
  }
  assert.equal(suggestions('Bench Press')[0].id, 'x-bench-press-barbell');
  assert.equal(suggestions('Bench Press').length, 3);
  for (const [name, id] of [['DB Bench Press', 'x-bench-press-dumbbell'], ['Bench Press (BB)', 'x-bench-press-barbell'], ['Bicep Curl (EZ)', 'x-bicep-curl-ez-bar']]) {
    assert.equal(suggestions(name)[0].id, id, name);
    assert.equal(suggestions(name)[0].preselect, true, name);
  }
  assert.equal(suggestions('Bench Press (Barbel)')[0].preselect, true);
  assert.equal(suggestions('Farmers Walk')[0].id, 'x-farmer-s-walk-dumbbell');
  assert.equal(suggestions('Pullups', 'reps')[0].id, 'x-pull-up');
  // short plurals ("ups") and spacing or hyphens that only split or join words, as people type them in Strong
  for (const [name, id, category] of [
    ['Pull-Ups', 'x-pull-up', 'reps'], ['Pull Ups', 'x-pull-up', 'reps'], ['Push-ups', 'x-push-up', 'reps'],
    ['Chin-ups', 'x-chin-up', 'reps'], ['Sit-ups', 'x-sit-up', 'reps'], ['Lat Pull Down', 'x-lat-pulldown-cable', 'machine'],
    ['Tricep Push Down', 'x-triceps-pushdown-cable', 'machine'], ['Skull Crushers (EZ Bar)', 'x-skullcrusher-ez-bar', 'barbell'],
  ]) {
    assert.equal(suggestions(name, category)[0]?.id, id, name);
    assert.equal(suggestions(name, category)[0].preselect, true, name);
  }
  // joined words must then be spelled the same: "Lat Raise" is neither Y-Raise nor Lateral Raise
  assert.deepEqual(suggestions('Lat Raise', 'dumbbell'), []);
  for (const name of ['Snatch Pull (Barbell)', 'Clean Pull', 'Unrelated Exercise', 'Front Rack Reverse Lunge With Twist']) assert.deepEqual(suggestions(name), [], name);
  assert.ok(suggestions('Squat (Cybex Machine)').every((s) => !s.preselect), 'different equipment waits for a choice');
  assert.deepEqual(suggestions('Kenan Flaps', 'duration'), [], 'timed sets cannot take a weighted suggestion');
  const custom = { id: 'c-moon', name: 'Moon Lift (Cable)', category: 'machine' };
  assert.equal(suggestions('Moon Lifts', 'machine', [custom])[0].id, custom.id, 'own exercises participate');
  const ambiguous = ['Curl Mate', 'Curl Fate'].map((name) => ({ ...custom, id: name, name }));
  assert.equal(suggestions('Curl Date', 'machine', ambiguous)[0].preselect, false, 'equally close different names need a choice');
});

test('Strong review counts sessions, requires decisions and body parts, and limits categories to logged fields', () => {
  const csv = strongFile([
    ['Bench Press (Barbell)'], ['Kenan Flaps'], ['Moon Lift'], ['kenan  flaps'],
    ['Kenan Flaps', 20, 8, 0, 0, '2026-10-02 12:00:00'], ['Bench Press', 0, 0, 0, 45],
    ['Mystery Reps', 0, 12], ['Mystery Route', 0, 0, 5, 900],
  ]);
  const before = JSON.stringify(core.SEED_EXERCISES);
  const preview = core.parseStrongCSV(csv, { exercises: core.SEED_EXERCISES });
  assert.equal(preview.stats.matchedExercises, 1);
  assert.equal(preview.review.find((r) => r.name === 'Kenan Flaps').sessions, 2);
  assert.equal(preview.review.length, 5, 'case/whitespace variants share one review row');
  assert.equal(preview.review.find((r) => r.name === 'Moon Lift').bodyPart, '');
  const timed = preview.review.find((r) => r.name === 'Bench Press');
  assert.deepEqual(timed.suggestions, []);
  assert.deepEqual(timed.categories, ['duration']);
  assert.deepEqual(core.strongImportCategories([{ w: 0, r: 8 }]), ['reps']);
  assert.deepEqual(core.strongImportCategories([{ d: 1, t: 50 }]), ['cardio']);
  assert.deepEqual(core.strongImportCategories([{ t: 60 }]), ['duration']);
  assert.deepEqual(core.strongImportCategories([{ w: -10, r: 8 }]), ['barbell', 'dumbbell', 'machine', 'weighted_bw', 'assisted_bw']);
  assert.deepEqual(core.strongImportCategories([{ w: 20, t: 60 }]), [], 'cannot discard fields from mixed sets');
  const choices = Object.fromEntries(preview.review.map((r) => [r.name, { kind: 'new', name: r.name, category: r.category, bodyPart: r.bodyPart || 'other' }]));
  choices['Kenan Flaps'] = { kind: 'existing', exerciseId: 'x-keenan-flap-cable' };
  choices['Moon Lift'].bodyPart = '';
  assert.throws(() => core.resolveStrongImport(preview, choices, { exercises: core.SEED_EXERCISES }), /Choose a body part/);
  choices['Moon Lift'].bodyPart = 'back';
  choices['Bench Press'] = { kind: 'existing', exerciseId: 'x-bench-press-barbell' };
  assert.throws(() => core.resolveStrongImport(preview, choices, { exercises: core.SEED_EXERCISES }), /same fields/);
  choices['Bench Press'] = { kind: 'new', name: 'Timed Bench Hold', category: 'duration', bodyPart: 'chest' };
  const r = core.resolveStrongImport(preview, choices, { exercises: core.SEED_EXERCISES });
  assert.equal(r.workouts.length, 2);
  assert.equal(r.exercises.length, 4);
  assert.equal(r.workouts[0].exercises[1].exerciseId, 'x-keenan-flap-cable');
  assert.equal(r.workouts[0].exercises[3].exerciseId, 'x-keenan-flap-cable', 'the case variant uses the same decision');
  assert.equal(r.workouts[0].exercises[1].sets[0].w, 20);
  assert.equal(JSON.stringify(core.SEED_EXERCISES), before, 'review and resolution do not mutate stored records');
  choices['Moon Lift'].name = 'Bench Press (Barbell)';
  assert.throws(() => core.resolveStrongImport(preview, choices, { exercises: core.SEED_EXERCISES }), /already exists/);
  choices['Moon Lift'].name = 'Timed Bench Hold';
  assert.throws(() => core.resolveStrongImport(preview, choices, { exercises: core.SEED_EXERCISES }), /already exists/, 'new rows cannot duplicate each other');
});

test('Strong choices survive a backup, silently match newer exports, skip duplicates and fill missing notes', () => {
  const csv = strongFile([['Kenan Flaps', 20, 8, 0, 0, '2026-10-01 12:00:00', 'Cues', 'Good day'], ['Moon Lift']]);
  const preview = core.parseStrongCSV(csv, { exercises: core.SEED_EXERCISES });
  const choices = { 'Kenan Flaps': { kind: 'existing', exerciseId: 'x-keenan-flap-cable' }, 'Moon Lift': { kind: 'new', name: 'Moon Machine', category: 'machine', bodyPart: 'back' } };
  const r = core.resolveStrongImport(preview, choices, { exercises: core.SEED_EXERCISES });
  const data = { exercises: [...core.SEED_EXERCISES, ...r.exercises], workouts: r.workouts, templates: [], measurements: [], kv: { strongAliases: r.aliases } };
  const restored = core.parseBackup(core.makeBackup(data, 'test'), core.SEED_EXERCISES).data;
  assert.deepEqual(restored.kv.strongAliases, r.aliases);
  const opts = { exercises: restored.exercises, workouts: restored.workouts, aliases: restored.kv.strongAliases };
  const again = core.parseStrongCSV(csv, opts);
  assert.deepEqual(again.review, []);
  assert.equal(again.stats.matchedExercises, 2);
  assert.equal(core.resolveStrongImport(again, {}, opts).workouts.length, 0);
  const newer = core.parseStrongCSV(csv.replaceAll('2026-10-01', '2026-10-02'), opts);
  assert.deepEqual(newer.review, []);
  assert.equal(core.resolveStrongImport(newer, {}, opts).workouts[0].exercises[1].exerciseId, r.exercises[0].id);
  const oldWorkouts = structuredClone(r.workouts);
  delete oldWorkouts[0].notes; delete oldWorkouts[0].exercises[0].notes;
  const filled = core.resolveStrongImport(again, {}, { ...opts, workouts: oldWorkouts });
  assert.deepEqual(filled.noteUpdates, [{ id: oldWorkouts[0].id, notes: 'Good day', entries: [[0, 'Cues']] }]);
  for (const exercises of [restored.exercises.filter((e) => e.id !== r.exercises[0].id), restored.exercises.map((e) => e.id === r.exercises[0].id ? { ...e, category: 'duration' } : e)]) {
    assert.equal(core.parseStrongCSV(csv, { ...opts, exercises }).review[0].name, 'Moon Lift', 'deleted or incompatible remembered targets return to review');
  }
});

test('Strong shipped spellings resolve to existing identities, and new family membership is exact', () => {
  const names = Object.keys(core.STRONG_EXERCISE_ALIASES);
  const preview = core.parseStrongCSV(strongFile(names.map((name) => [name])), { exercises: core.SEED_EXERCISES });
  assert.deepEqual(preview.review, []);
  assert.deepEqual(preview.matches, core.STRONG_EXERCISE_ALIASES);
  assert.deepEqual(core.parseStrongCSV(strongFile(names.map((name) => [name.toLowerCase()])), { exercises: core.SEED_EXERCISES }).review, []);
  const custom = { id: 'c-cross', name: 'Cable Crossover', category: 'machine', bodyPart: 'chest' };
  assert.equal(core.parseStrongCSV(strongFile([[custom.name]]), { exercises: [...core.SEED_EXERCISES, custom] }).matches[custom.name], custom.id, 'exact custom names win over aliases');
  const csv = strongFile([['Squat (Cybex Machine)'], ['Squats (Custom)'], ['Kenan Flaps']]);
  const p = core.parseStrongCSV(csv, { exercises: core.SEED_EXERCISES });
  const choices = Object.fromEntries(p.review.map((r) => [r.name, { kind: 'new', name: r.name, category: 'machine', bodyPart: 'legs' }]));
  const r = core.resolveStrongImport(p, choices, { exercises: core.SEED_EXERCISES });
  assert.deepEqual(r.exercises.map((e) => e.family), ['f-squat', undefined, undefined]);
  assert.equal(core.strongExerciseFamily('Squat (Cybex Machine)', core.SEED_EXERCISES), 'f-squat');
  assert.equal(core.strongExerciseFamily('Squat Jump (Machine)', core.SEED_EXERCISES), undefined);
});

// ---------- backup ----------
test('backups round-trip, count as the latest backup and restore the built-in library', () => {
  const data = { exercises: [], workouts: [{ id: 'w' }], templates: [], measurements: [], kv: { meta: { lastBackupAt: 5 } } };
  const now = new Date('2026-10-13T20:00:00Z');
  const back = core.parseBackup(core.makeBackup(data, '1.6.0', now), core.SEED_EXERCISES);
  assert.equal(back.data.workouts.length, 1);
  assert.equal(back.data.kv.meta.lastBackupAt, now.getTime());
  assert.equal(back.data.exercises.length, core.SEED_EXERCISES.length);
  assert.throws(() => core.parseBackup('{', []), /isn’t valid JSON/);
  try { core.parseBackup(JSON.stringify({ app: 'setlog', data: { workouts: 3 } }), []); assert.fail(); } catch (e) {
    assert.equal(e.message, 'The backup is damaged ({part}).');
    assert.deepEqual(e.vars, { part: 'workouts' });
  }
});

// ---------- share links ----------
test('template links round-trip and reject junk', () => {
  const bench = core.SEED_EXERCISES.find((e) => e.name === 'Bench Press (Barbell)');
  const custom = { id: 'c-curl', name: 'Bayesian Curl (Cable)', category: 'machine', bodyPart: 'arms' };
  const t = { name: 'Push', notes: 'Heavy', exercises: [E(bench.id, [S('warmup', 60, 6), S('normal', 110, 7)], { restSec: 150, supersetId: 'g' }), E(custom.id, [{ type: 'normal', r: 12 }], { supersetId: 'g' })] };
  const code = core.encodeTemplate(t, new Map([[bench.id, bench], [custom.id, custom]]));
  const back = core.decodeTemplate(`try this #template=${code} !`, { categories: core.CATEGORIES.map((c) => c.id), bodyParts: core.BODY_PARTS.map((b) => b.id) });
  assert.equal(back.name, 'Push');
  assert.equal(back.exercises[0].id, bench.id);
  assert.deepEqual(back.exercises[0].sets, [S('warmup', 60, 6), S('normal', 110, 7)]);
  assert.equal(back.exercises[1].name, 'Bayesian Curl (Cable)');
  assert.equal(back.exercises[0].group, back.exercises[1].group);
  assert.equal(core.decodeTemplate('#template=!!!notbase64'), null);
});

// ---------- search ----------
test('exercise search: shortcuts as whole words, accents ignored', () => {
  const find = (q) => core.SEED_EXERCISES.filter((e) => core.matchExercise(e, q)).map((e) => e.name);
  const benchBB = find('bench bb');
  assert.ok(benchBB.includes('Bench Press (Barbell)'));
  assert.ok(!benchBB.some((n) => /Dumbbell/.test(n)), benchBB.join(', '));
  assert.ok(find('bench db').every((n) => /Dumbbell/.test(n)));
  assert.ok(find('ohp').some((n) => n.startsWith('Overhead Press')));
  assert.ok(find('pullup').includes('Pull Up'));
  assert.ok(!find('bi').some((n) => /Bike|Cycling/.test(n)));
  assert.equal(core.matchExercise({ name: 'Rückenstrecker' }, 'ruck'), true);
  assert.equal(core.matchExercise({ name: 'Rückenstrecker' }, 'rück'), true);
  assert.equal(core.matchExercise({ name: 'Leg Press' }, ''), true);
});

// ---------- i18n ----------
const DE = core.DICTIONARIES.de;
test('translator fills placeholders and falls back to English', () => {
  const de = core.translator('de');
  assert.equal(de('Set {label}', { label: 3 }), 'Satz 3');
  assert.equal(de('No such text'), 'No such text');
  assert.equal(core.translator('en')('Set {label}', { label: 3 }), 'Set 3');
  assert.equal(core.pickLanguage(['de-AT', 'en']), 'de');
});

test('every label in core has German', () => {
  const keep = new Set(['Push', 'Pull', 'Legs', 'Push / Pull / Legs', 'Epley', 'Brzycki', 'Lombardi', 'Mayhew', 'O’Conner', 'Wathen', 'Lander']);
  const labels = [
    ...core.CATEGORIES, ...core.BODY_PARTS, ...core.MEASUREMENTS, ...core.FORMULAS,
    ...['barbell', 'reps', 'cardio', 'duration', 'assisted_bw'].flatMap((c) => core.chartMetricsFor(c)),
  ].map((x) => x.label).concat(Object.values(core.PR_LABEL), Object.values(core.FOCUS_LABEL), Object.values(core.WORKOUT_MESSAGES),
    Object.values(core.EDIT_MESSAGES), Object.values(core.CATEGORY_HELP), [...core.EXERCISE_RANGES, ...core.MEASURE_RANGES].map((r) => r.label),
    ['Night Workout', 'Morning Workout', 'Afternoon Workout', 'Evening Workout'], core.EXAMPLE_TEMPLATES.flatMap((t) => [t.name, t.folder]));
  const missing = new Set(labels.filter((l) => !keep.has(l) && DE[l] === undefined));
  assert.deepEqual([...missing], []);
});

test('every tr() text in the iPhone and Android app has German', () => {
  const keep = new Set(['English', 'Deutsch']);
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(p)) files.push(p); } };
  walk(path.join(ROOT, 'app/src'));
  const missing = new Set();
  for (const f of files) {
    for (const m of read(f).matchAll(/\btr\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      const key = m[2].replace(/\\'/g, "'");
      if (!key.includes('${') && !keep.has(key) && DE[key] === undefined) missing.add(`${path.relative(ROOT, f)}: ${key}`);
    }
  }
  assert.deepEqual([...missing], []);
});

test('the German dictionary has no duplicate keys', () => {
  const keys = [...read(path.join(CORE, 'i18n-de.js')).matchAll(/^\s*('(?:\\.|[^'])*'|[A-Za-z_]\w*):\s/gm)].map((m) => m[1].replace(/^'|'$/g, ''));
  const seen = new Set(), dupes = [];
  for (const k of keys) { if (seen.has(k)) dupes.push(k); seen.add(k); }
  assert.deepEqual(dupes, []);
});

// ---------- themes ----------

test('weekStreak counts each week in one pass, the same as filtering per week', () => {
  const now = Date.UTC(2026, 10, 3, 12);
  const slow = (ws, { goal, weekStart }) => {
    const count = (st) => ws.filter((w) => w.startedAt >= st && w.startedAt < core.addDays(st, 7)).length;
    let week = core.startOfWeek(now, weekStart), streak = 0;
    if (count(week) >= goal) streak++;
    week = core.addDays(week, -7);
    while (count(week) >= goal && streak < 520) { streak++; week = core.addDays(week, -7); }
    return streak;
  };
  let seed = 7; const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ws = [];
  for (let t = now - 400 * DAY; t < now; t += (0.6 + rand() * 2.4) * DAY) ws.push({ id: 'w' + ws.length, startedAt: Math.round(t) });
  for (const goal of [1, 2, 3, 4]) for (const weekStart of [0, 1]) {
    assert.equal(core.weekStreak(ws, { goal, weekStart, now }), slow(ws, { goal, weekStart }), `goal ${goal}, week starts ${weekStart}`);
  }
});

// ---------- Tally design tokens ----------
test('app/src/design/tally.ts matches docs/design/tokens.json (run `npm run tally` after changing it)', () => {
  const tally = tallyFromTokens(JSON.parse(read(path.join(ROOT, 'docs/design/tokens.json'))));
  assert.equal(read(path.join(ROOT, 'app/src/design/tally.ts')), renderTally(tally));
  assert.deepEqual(Object.keys(tally.themes), ['light', 'dark', 'strawberry-matcha', 'intense-red']);
  assert.equal(tally.themes.dark.colors.paper, '#000000', 'dark themes are true black');
  assert.equal(tally.themes.light.colors.strokeDone, tally.themes.light.colors.ink, 'aliases resolve');
  assert.equal(tally.themes['intense-red'].scheme, 'dark');
});

// ---------- German exercise names ----------
test('German exercise names: every built-in has one, shown only in German and only while not renamed', () => {
  const de = core.EXERCISE_NAMES_DE;
  assert.deepEqual(core.SEED_EXERCISES.filter((e) => !de[e.name]).map((e) => e.name), []);
  assert.deepEqual(Object.keys(de).filter((n) => !core.SEED_EXERCISES.some((e) => e.name === n)), []);
  const names = Object.values(de);
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), [], 'German names are unique');
  // every equipment variant of one exercise uses the same German base term (Reverse Fly → Reverse Flys, …)
  const base = (n) => n.replace(/\s*\(.*\)$/, '');
  const groups = new Map();
  for (const e of core.SEED_EXERCISES) groups.set(base(e.name), [...(groups.get(base(e.name)) || []), base(de[e.name])]);
  const mixed = [...groups].filter(([, g]) => new Set(g).size > 1).map(([en, g]) => `${en}: ${[...new Set(g)].join(' / ')}`);
  assert.deepEqual(mixed, []);
  const bench = core.SEED_EXERCISES.find((e) => e.id === 'x-bench-press-barbell');
  assert.equal(core.exerciseDisplayName(bench, 'de'), 'Bankdrücken (Langhantel)');
  assert.equal(core.exerciseDisplayName(bench, 'en'), 'Bench Press (Barbell)');
  assert.equal(core.exerciseDisplayName({ ...bench, name: 'Flat Bench' }, 'de'), 'Flat Bench', 'a renamed built-in keeps its name');
  assert.equal(core.exerciseDisplayName({ id: 'c-bench-press-barbell', name: 'Bench Press (Barbell)' }, 'de'), 'Bench Press (Barbell)', 'custom ones keep theirs');
  assert.equal(core.exerciseDisplayName(undefined, 'de'), '');
  assert.equal(core.exerciseBaseName(bench, 'en'), 'Bench Press', 'the equipment in brackets goes');
  assert.equal(core.exerciseBaseName(bench, 'de'), 'Bankdrücken');
  assert.equal(core.exerciseBaseName({ id: 'c-row', name: 'Row (Cable) (wide grip)' }, 'en'), 'Row (Cable)', 'only the last bracket');
  assert.equal(core.exerciseBaseName({ id: 'c-x', name: '(Warm-up)' }, 'en'), '(Warm-up)', 'a name that is only brackets keeps them');
  assert.equal(core.exerciseBaseName({ id: 'c-curl', name: 'Hammer Curl' }, 'en'), 'Hammer Curl');
  assert.equal(core.exerciseBaseName(undefined, 'en'), '');
  // search finds built-ins by either name, in either language
  const find = (q) => core.SEED_EXERCISES.filter((e) => core.matchExercise(e, q)).map((e) => e.id);
  assert.deepEqual(find('latzug'), find('lat pulldown'));
  assert.ok(find('bankdrücken kh').includes('x-bench-press-dumbbell'));
  assert.ok(find('kreuzheben').includes('x-deadlift-barbell'));
  assert.ok(find('rumanisch').includes('x-romanian-deadlift-barbell'), 'accents are ignored');
  assert.deepEqual(find('bench bb'), find('bankdrücken lh'));
  assert.equal(core.matchExercise({ id: 'c-x', name: 'Bankdrücken eng' }, 'bankdrücken'), true);
});

// ---------- links and the privacy pages ----------
test('privacy pages: one per language, and the contact email written in one place only', () => {
  assert.equal(core.privacyPage('de'), 'datenschutz.html');
  assert.equal(core.privacyPage('en'), 'privacy.html');
  assert.equal(core.privacyPage(undefined), 'privacy.html');
  assert.ok(core.WEB_APP_URL.endsWith('/'));
  for (const page of ['privacy.html', 'datenschutz.html']) {
    const html = read(path.join(WEB, page));
    assert.match(html, /from '\.\/js\/core\/links\.js'/, `${page} reads the address from core/links.js`);
    assert.match(html, /data-contact/);
  }
  // the deploy must refuse "[EMAIL]", so it may only be the constant itself
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(js|html)$/.test(e.name) && read(f).includes('[EMAIL]')) hits.push(path.relative(ROOT, f));
    }
  };
  walk(WEB);
  walk(CORE);
  assert.deepEqual(hits.filter((f) => f !== path.join('core', 'links.js')), []);
});

// ---------- offline ----------

// ---------- exercise families and catalogue upgrades ----------
const seedV1 = JSON.parse(read(path.join(ROOT, 'tests/fixtures/exercises-v1.json')));
const byName = (name) => core.SEED_EXERCISES.find((e) => e.name === name);

test('catalogue preserves all v1 ids, English names, categories, body parts and example routines', () => {
  assert.equal(seedV1.exercises.length, 190);
  const current = new Map(core.SEED_EXERCISES.map((e) => [e.id, e]));
  for (const old of seedV1.exercises) assert.deepEqual(current.get(old.id), old);
  assert.deepEqual(core.EXAMPLE_TEMPLATES, seedV1.examples);
  assert.ok(core.SEED_VERSION > 1);
  assert.ok(core.SEED_EXERCISES.length >= 360, 'a substantial, curated expansion');
});

test('catalogue has unique stable ids, valid logging types, and exactly one family per built-in', () => {
  const seeds = core.SEED_EXERCISES;
  assert.equal(new Set(seeds.map((e) => e.id)).size, seeds.length);
  assert.equal(new Set(seeds.map((e) => e.name)).size, seeds.length);
  assert.equal(new Set(core.EXERCISE_FAMILIES.map((f) => f.id)).size, core.EXERCISE_FAMILIES.length);
  const ids = core.EXERCISE_FAMILIES.flatMap((f) => f.members);
  assert.equal(ids.length, seeds.length);
  assert.equal(new Set(ids).size, seeds.length);
  for (const f of core.EXERCISE_FAMILIES) {
    assert.equal(f.id, 'f-' + core.slug(f.name));
    assert.ok(f.nameDe && f.members.length);
    for (const id of f.members) assert.equal(core.familyOf(seeds.find((e) => e.id === id)), f.id);
  }
  for (const e of seeds) {
    assert.equal(e.id, 'x-' + core.slug(e.name));
    assert.ok(core.CATEGORY_LABEL[e.category], e.name);
    assert.ok(core.BODY_PART_LABEL[e.bodyPart], e.name);
    assert.equal(Object.hasOwn(e, 'family'), false, 'membership is resolved, not stored');
  }
});

test('family names are unique in English and German', () => {
  for (const field of ['name', 'nameDe']) {
    const seen = new Set();
    for (const family of core.EXERCISE_FAMILIES) {
      const name = family[field].trim().normalize('NFC').toLocaleLowerCase(field === 'nameDe' ? 'de' : 'en');
      assert.ok(name && !seen.has(name), `${field}: ${family[field]}`);
      seen.add(name);
    }
  }
  assert.equal(core.FAMILY_BY_ID['f-row'].nameDe, 'Rudern');
  assert.equal(core.FAMILY_BY_ID['f-rowing'].nameDe, 'Rudergerät');
});

test('families group variations by their program slot', () => {
  for (const e of core.SEED_EXERCISES) {
    if (e.name.includes('Split Squat')) assert.equal(core.familyOf(e), 'f-split-squat', e.name);
    if (/Romanian Deadlift|Stiff Leg Deadlift/.test(e.name)) assert.equal(core.familyOf(e), 'f-romanian-deadlift', e.name);
    if (e.name.includes('Glute Bridge')) assert.equal(core.familyOf(e), 'f-hip-thrust', e.name);
    if (e.name.startsWith('Kelso Shrug')) assert.equal(core.familyOf(e), 'f-kelso-shrug', e.name);
  }
  assert.equal(core.familyOf(byName('Sissy Squat')), 'f-sissy-squat');
  assert.equal(core.familyOf(byName('Copenhagen Plank')), 'f-copenhagen-plank');
  assert.equal(byName('Copenhagen Plank').bodyPart, 'legs');
  assert.equal(core.familyOf(byName('Deadlift (Barbell)')), 'f-deadlift');
  assert.equal(core.familyOf(byName('Shrug (Barbell)')), 'f-shrug');
  assert.equal(core.familyOf(byName('Plank')), 'f-plank');
  assert.equal(core.FAMILY_BY_ID['f-glute-bridge'], undefined);
});

test('families use catalogue ids after rename/hide, and explicit custom assignments win', () => {
  const squat = byName('Squat (Barbell)');
  assert.equal(core.familyOf(squat), 'f-squat');
  assert.equal(core.familyOf({ ...squat, name: 'My squat', hidden: true }), 'f-squat');
  assert.equal(core.familyOf({ ...squat, family: 'f-my-lifts' }), 'f-my-lifts');
  assert.equal(core.familyOf({ ...squat, family: null }), null);
  assert.equal(core.familyOf({ id: 'c-front', name: 'My front squat', family: 'f-squat' }), 'f-squat');
  assert.equal(core.familyOf({ id: 'c-squat', name: squat.name }), undefined, 'names do not silently group customs');
  assert.equal(core.familyOf(undefined), undefined);
  assert.equal(core.familyOf({ id: 'unknown' }), undefined);
  assert.equal(core.familyOf(byName('Leg Press (Machine)')), 'f-leg-press');
  assert.equal(core.familyOf(byName('Chest Press (Machine)')), 'f-chest-press');
  assert.equal(core.familyOf(byName('Pullover (Machine)')), 'f-pullover');
  for (const name of ['Front Squat (Barbell)', 'Hack Squat (Machine)', 'Goblet Squat (Dumbbell)', 'Safety Bar Squat (Barbell)', 'Zercher Squat (Barbell)', 'Pendulum Squat (Machine)']) {
    assert.equal(core.familyOf(byName(name)), 'f-squat', name);
  }
  for (const name of ['Close Grip Bench Press (Barbell)', 'Floor Press (Dumbbell)', 'Spoto Press (Barbell)', 'Larsen Press (Barbell)', 'Decline Bench Press (Barbell)']) {
    assert.equal(core.familyOf(byName(name)), 'f-bench-press', name);
  }
  assert.equal(core.familyOf(byName('Cuffed Single Arm Lat Pullover (Cable)')), 'f-keenan-flap');
});

test('family members keep main-first catalogue order, actual stored records and custom members', () => {
  const main = byName('Squat (Barbell)');
  const front = byName('Front Squat (Barbell)');
  const smith = { ...byName('Squat (Smith Machine)'), hidden: true };
  const custom = { id: 'c-my-squat', name: 'My squat', family: 'f-squat', category: 'reps' };
  const library = [custom, smith, front, main, byName('Leg Press (Machine)')];
  const original = structuredClone(library);
  assert.deepEqual(core.familyMembers('f-squat', library), [main, front, custom]);
  assert.equal(core.familyMembers('f-squat', library)[0], main);
  assert.deepEqual(core.familyMembers('f-squat', new Map(library.map((e) => [e.id, e]))), [main, front, custom]);
  assert.deepEqual(core.familyMembers('f-squat', library, { includeHidden: true }), [main, smith, front, custom]);
  assert.deepEqual(core.familyMembers(undefined, library), []);
  assert.deepEqual(core.familyMembers('f-no-such-family', library), []);
  assert.deepEqual(library, original);
  const own = { id: 'c-1', name: 'Own', family: 'f-own' };
  assert.deepEqual(core.familyMembers('f-own', [own]), [own]);
});

test('family groups keep exercises then equipment, including different logged fields', () => {
  const groups = core.familyMemberGroups('f-pull-up');
  const pull = groups.find((g) => g.name === 'Pull Up');
  assert.deepEqual(pull.members.map((m) => m.equipment), ['', 'Band', 'Weighted', 'Assisted'], 'plain Pull Up leads');
  assert.deepEqual(pull.members.map((m) => m.exercise.category), ['reps', 'reps', 'weighted_bw', 'assisted_bw']);
  assert.equal(new Set(pull.members.map((m) => m.exercise.id)).size, 4);
  const squat = core.familyMemberGroups('f-squat');
  assert.equal(squat[0].name, 'Squat');
  assert.deepEqual(squat[0].members.map((m) => m.equipment), ['Barbell', 'Dumbbell', 'Smith Machine', 'Bodyweight']);
  assert.ok(squat.some((g) => g.name === 'Front Squat'));
  assert.deepEqual(core.familyMemberGroups('f-unknown'), []);
  assert.equal(core.exerciseEquipment({ name: 'Row (Cable) (wide grip)' }), 'wide grip');
  assert.equal(core.exerciseEquipment({ name: 'Pull Up' }), '');
});

test('every family keeps related movements contiguous and equipment in the shared order', () => {
  const equipmentOrder = ['Barbell', 'EZ Bar', 'Trap Bar', 'Dumbbell', 'Kettlebell', 'Plate', 'Smith Machine', 'Machine', 'Cable', 'Band', 'Bodyweight', 'Weighted', 'Assisted'];
  assert.deepEqual(core.EXERCISE_EQUIPMENT_ORDER, equipmentOrder);
  for (const f of core.EXERCISE_CATALOGUE) {
    const seen = new Set();
    let previousBase, previousRank = -1;
    for (const e of f.members) {
      const base = core.exerciseBaseName(e, 'en');
      const label = core.exerciseEquipment(e) || (['reps', 'duration'].includes(e.category) ? 'Bodyweight' : '');
      const rank = equipmentOrder.includes(label) ? equipmentOrder.indexOf(label) : equipmentOrder.length;
      if (base !== previousBase) {
        // a movement's first entry is its usual version; the rest follow the equipment order
        assert.ok(!seen.has(base), `${f.name}: ${base} equipment is separated by another movement`);
        seen.add(base);
        previousBase = base;
        previousRank = -1;
        continue;
      }
      assert.ok(rank >= previousRank, `${f.name}: ${e.name} breaks equipment order`);
      previousRank = rank;
    }
    assert.deepEqual(core.familyMemberGroups(f.id).flatMap(g => g.members.map(m => m.exercise.id)), f.members.map(e => e.id));
  }
  const groups = (id) => core.familyMemberGroups(id).map(g => g.name);
  assert.deepEqual(groups('f-squat'), ['Squat', 'Front Squat', 'Safety Bar Squat', 'Zercher Squat', 'Box Squat', 'Paused Squat', 'Pin Squat', 'Hack Squat', 'Pendulum Squat', 'Belt Squat', 'Goblet Squat', 'Pistol Squat']);
  assert.deepEqual(groups('f-split-squat'), ['Split Squat', 'Bulgarian Split Squat', 'Front Foot Elevated Split Squat']);
  assert.deepEqual(groups('f-romanian-deadlift'), ['Romanian Deadlift', 'Stiff Leg Deadlift', 'Single Leg Romanian Deadlift', 'B Stance Romanian Deadlift']);
  assert.deepEqual(groups('f-hip-thrust'), ['Hip Thrust', 'Glute Bridge', 'Single Leg Hip Thrust', 'Single Leg Glute Bridge']);
});

test('each movement starts with its usual version, not the first in the equipment order', () => {
  const first = (familyId) => core.EXERCISE_FAMILIES.find((f) => f.id === familyId).members[0];
  assert.equal(first('f-push-up'), 'x-push-up');
  assert.equal(first('f-pull-up'), 'x-pull-up');
  assert.equal(first('f-lat-pulldown'), 'x-lat-pulldown-cable');
  assert.equal(first('f-back-extension'), 'x-back-extension');
  assert.equal(first('f-crunch'), 'x-crunch');
  assert.equal(first('f-calf-raise'), 'x-standing-calf-raise-machine');
  assert.equal(first('f-nordic-hamstring-curl'), 'x-nordic-hamstring-curl');
  const lead = (familyId, name) => core.familyMemberGroups(familyId).find((g) => g.name === name).members.map((m) => m.exercise.name);
  assert.deepEqual(lead('f-push-up', 'Push Up'), ['Push Up', 'Push Up (Band)', 'Push Up (Weighted)']);
  assert.deepEqual(lead('f-lat-pulldown', 'Lat Pulldown'), ['Lat Pulldown (Cable)', 'Lat Pulldown (Machine)', 'Lat Pulldown (Single Arm)']);
  assert.deepEqual(lead('f-row', 'Seated Row'), ['Seated Row (Cable)', 'Seated Row (Machine)']);
  assert.deepEqual(lead('f-squat', 'Hack Squat'), ['Hack Squat (Machine)', 'Hack Squat (Barbell)']);
  assert.deepEqual(lead('f-split-squat', 'Bulgarian Split Squat'), ['Bulgarian Split Squat (Dumbbell)', 'Bulgarian Split Squat (Barbell)', 'Bulgarian Split Squat (Smith Machine)', 'Bulgarian Split Squat']);
  // a custom version joins after the usual one; a hidden usual version hands the lead to the next built-in
  const library = [...core.SEED_EXERCISES, { id: 'c-lat-band', name: 'Lat Pulldown (Band)', family: 'f-lat-pulldown', category: 'reps' }];
  const names = (lib) => core.familyMemberGroups('f-lat-pulldown', lib).find((g) => g.name === 'Lat Pulldown').members.map((m) => m.exercise.name);
  assert.deepEqual(names(library), ['Lat Pulldown (Cable)', 'Lat Pulldown (Machine)', 'Lat Pulldown (Band)', 'Lat Pulldown (Single Arm)']);
  const hidden = library.map((e) => (e.id === 'x-lat-pulldown-cable' ? { ...e, hidden: true } : e));
  assert.deepEqual(names(hidden), ['Lat Pulldown (Machine)', 'Lat Pulldown (Band)', 'Lat Pulldown (Single Arm)']);
});

test('equipment ordering also applies to custom groups without changing stored records', () => {
  const labels = ['Assisted', 'Weighted', 'Bodyweight', 'Band', 'Cable', 'Machine', 'Smith Machine', 'Plate', 'Kettlebell', 'Dumbbell', 'Trap Bar', 'EZ Bar', 'Barbell'];
  const exercises = labels.map((label, i) => ({ id: `c-${i}`, name: `Own (${label})`, family: 'f-own', category: 'machine' }));
  const bare = { id: 'c-bare', name: 'Own', family: 'f-own', category: 'reps' };
  const unknown = { id: 'c-unknown', name: 'Own (Custom attachment)', family: 'f-own', category: 'machine' };
  const library = [unknown, ...exercises, bare];
  const snapshot = structuredClone(library);
  const [group] = core.familyMemberGroups('f-own', library);
  assert.deepEqual(group.members.map(m => m.equipment), ['Barbell', 'EZ Bar', 'Trap Bar', 'Dumbbell', 'Kettlebell', 'Plate', 'Smith Machine', 'Machine', 'Cable', 'Band', 'Bodyweight', '', 'Weighted', 'Assisted', 'Custom attachment']);
  assert.equal(group.members.find(m => m.exercise.id === bare.id).exercise, bare);
  assert.deepEqual(library, snapshot);
});

test('review additions log the verified movement and equipment without extra fields', () => {
  for (const movement of ['Neck Curl', 'Neck Extension']) for (const equipment of ['Plate', 'Machine']) {
    const e = byName(`${movement} (${equipment})`);
    assert.equal(core.familyOf(e), 'f-' + core.slug(movement));
    assert.equal(e.bodyPart, 'other', 'there is no Neck body-part category');
    assert.equal(e.category, 'machine', 'load × reps without a bar weight or two dumbbells');
    assert.deepEqual(core.loggedFields(e.category), ['w', 'r']);
  }
  for (const [name, family, category] of [
    ['Chest Supported T Bar Row (Machine)', 'f-row', 'machine'],
    ['Kroc Row (Dumbbell)', 'f-row', 'dumbbell'],
    ['Donkey Calf Raise (Machine)', 'f-calf-raise', 'machine'],
    ['Dead Hang', 'f-dead-hang', 'duration'],
  ]) {
    assert.equal(core.familyOf(byName(name)), family);
    assert.equal(byName(name).category, category);
  }
  assert.deepEqual(core.loggedFields(byName('Dead Hang').category), ['t']);
});

test('seeding upgrades v1, is repeatable, and never overwrites renamed or hidden built-ins', () => {
  const old = seedV1.exercises.map((e) => ({ ...e }));
  old[0] = { ...old[0], name: 'My bench', hidden: true, restSec: 123, notes: 'mine' };
  const snapshot = structuredClone(old);
  const upgraded = core.withSeedExercises(old);
  assert.equal(upgraded.length, core.SEED_EXERCISES.length);
  assert.equal(upgraded.find((e) => e.id === old[0].id), old[0]);
  assert.deepEqual(core.seedExerciseChanges(upgraded), []);
  assert.deepEqual(core.seedExerciseChanges(new Map(upgraded.map((e) => [e.id, e]))), []);
  assert.deepEqual(old, snapshot);
});

test('new built-in name collisions keep custom ids, logging fields, settings and history, and join the family', () => {
  const custom = { id: 'c-kelso', name: '  Kelso Shrug (Dumbbell) ', category: 'machine', bodyPart: 'other', hidden: true, restSec: 55, notes: 'mine' };
  const ownFamily = { id: 'c-katana', name: 'Katana Triceps Extension (Cable)', category: 'reps', family: 'f-my-arms' };
  const optOut = { id: 'c-bayesian', name: 'Bayesian Curl (Cable)', category: 'machine', family: null };
  const library = [...seedV1.exercises, custom, ownFamily, optOut];
  const before = structuredClone(library);
  const upgraded = core.withSeedExercises(library);
  assert.deepEqual(upgraded.find((e) => e.id === custom.id), { ...custom, family: 'f-kelso-shrug' });
  for (const name of ['Kelso Shrug (Dumbbell)', ownFamily.name, optOut.name]) assert.ok(!upgraded.some((e) => e.id === byName(name).id));
  assert.equal(upgraded.find((e) => e.id === ownFamily.id), ownFamily);
  assert.equal(upgraded.find((e) => e.id === optOut.id), optOut);
  assert.deepEqual(core.seedExerciseChanges(upgraded), []);
  assert.deepEqual(library, before);
  // Same path when restoring an old backup: references and metrics stay on the custom id.
  const data = { exercises: library, workouts: [{ id: 'w', startedAt: 1, exercises: [{ id: 'entry', exerciseId: custom.id, sets: [{ id: 's', type: 'normal', w: 20, r: 10 }] }] }], templates: [{ id: 't', exercises: [{ exerciseId: custom.id, sets: [{ w: 15, r: 10 }] }] }], kv: { meta: { seedVersion: 1 } } };
  const restored = core.parseBackup(core.makeBackup(data, '1'), core.SEED_EXERCISES).data;
  assert.deepEqual(restored.exercises, upgraded);
  assert.deepEqual(restored.workouts, data.workouts);
  assert.deepEqual(restored.templates, data.templates);
  assert.equal(core.familyOf(restored.exercises.find((e) => e.id === custom.id)), 'f-kelso-shrug');
});

test('name collisions never reassign a renamed built-in, even to a newly added exercise', () => {
  const renamed = { ...byName('Shrug (Barbell)'), name: 'Kelso Shrug (Machine)', hidden: true };
  const upgraded = core.withSeedExercises([renamed]);
  assert.equal(upgraded.find((e) => e.id === renamed.id), renamed);
  assert.equal(core.familyOf(renamed), 'f-shrug');
  assert.ok(!upgraded.some((e) => e.id === byName(renamed.name).id));
});

test('duplicate custom names all join the family without merging; existing built-in id wins over name collisions', () => {
  const a = { id: 'c-a', name: 'Keenan Flap (Cable)', category: 'machine' };
  const b = { ...a, id: 'c-b', name: 'keenan flap   (cable)' };
  const changes = core.seedExerciseChanges([a, b], [byName(a.name)]);
  assert.deepEqual(changes, [{ ...a, family: 'f-keenan-flap' }, { ...b, family: 'f-keenan-flap' }]);
  const builtin = { ...byName(a.name), name: 'Renamed flap', hidden: true };
  assert.deepEqual(core.seedExerciseChanges([a, b, builtin], [byName(a.name)]), []);
});

test('family metadata never combines records, last-time sets or routine progression across variations', () => {
  const bar = byName('Squat (Barbell)'), smith = byName('Squat (Smith Machine)');
  const entry = (e, w) => ({ id: e.id, exerciseId: e.id, sets: [{ id: e.id + '-s', type: 'normal', w, r: 5 }] });
  const workouts = [{ id: 'w', startedAt: 1000, exercises: [entry(bar, 100), entry(smith, 150)] }];
  const sessions = core.sessionsByExercise(workouts);
  assert.equal(core.previousSetsFrom(sessions.get(bar.id))[0].w, 100);
  assert.equal(core.previousSetsFrom(sessions.get(smith.id))[0].w, 150);
  const stats = core.buildStats(workouts, new Map([[bar.id, bar], [smith.id, smith]]));
  assert.equal(stats.bests.get(bar.id).weight, 100);
  assert.equal(stats.bests.get(smith.id).weight, 150);
  const routine = { exercises: [{ exerciseId: bar.id, sets: [{ w: 90, r: 5 }] }] };
  const result = core.progressTemplate(routine.exercises, { exercises: [entry(smith, 200)] }, (id) => id === bar.id ? bar.category : smith.category);
  assert.equal(result.exercises[0].sets[0].w, 90);
});

test('new search shortcuts find actual named movements and equipment', () => {
  for (const [query, name] of [['ssb', 'Safety Bar Squat (Barbell)'], ['bss', 'Bulgarian Split Squat (Dumbbell)'], ['jm', 'JM Press (Barbell)'], ['yraise', 'Y-Raise (Cable)'], ['cuff', 'Cuffed Lateral Raise (Cable)'], ['sz', 'Preacher Curl (EZ Bar)'], ['ffess', 'Front Foot Elevated Split Squat (Dumbbell)'], ['ghr', 'Glute Ham Raise']]) {
    assert.ok(core.matchExercise(byName(name), query), query);
  }
});
