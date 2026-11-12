// Unit tests for core/, run in plain Node (no browser): `npm test`.
// They also guard the boundary the Expo app relies on: core/ must not use the
// DOM, browser storage or anything outside core/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../core/index.js';
import { tallyFromTokens, render as renderTally, renderCss } from '../scripts/tally-tokens.mjs';

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
  assert.deepEqual(core.strongImportCategories([{ w: -10, r: 8 }]), [], 'no exercise logs a negative load (#40)');
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

test('Strong import (#40): exact names pass the field check, negative weights and mixed sets can only be left out', () => {
  const csv = strongFile([
    ['Bench Press (Barbell)', -20, 8], ['Bench Press (Barbell)', 60, 8], // negative: even an exact name goes to review
    ['Pull Up', 10, 8], // exact name, but Increment's Pull Up logs reps only
    ['Pull Up (Assisted)', 20, 8], // Strong's help is positive: stays assistance
    ['Moon Hold', 20, 8], ['Moon Hold', 0, 0, 0, 30], // weight and time mixed
    ['Squat (Barbell)', 100, 5, 0, 0, '2026-10-02 12:00:00'], ['Moon Hold', 0, 0, 0, 40, '2026-10-03 12:00:00'],
  ]);
  const preview = core.parseStrongCSV(csv, { exercises: core.SEED_EXERCISES, aliases: { 'Bench Press (Barbell)': 'x-bench-press-barbell' } });
  const row = (name) => preview.review.find((r) => r.name === name);
  assert.equal(preview.matches['Pull Up (Assisted)'], 'x-pull-up-assisted');
  assert.equal(preview.matches['Squat (Barbell)'], 'x-squat-barbell');
  assert.equal(row('Bench Press (Barbell)').blocked, 'negative', 'neither the exact name nor a remembered choice takes a negative weight');
  assert.equal(row('Moon Hold').blocked, 'mixed');
  assert.deepEqual(row('Moon Hold').omit, { sets: 3, workouts: 2 });
  assert.deepEqual(row('Bench Press (Barbell)').omit, { sets: 2, workouts: 1 });
  const pull = row('Pull Up');
  assert.equal(pull.exact, 'x-pull-up');
  assert.equal(pull.blocked, undefined);
  assert.ok(!pull.suggestions.some((x) => x.id === 'x-pull-up'), 'the reps-only exercise is not offered');
  assert.ok(pull.suggestions.some((x) => x.id === 'x-pull-up-weighted'), 'a compatible sibling is');
  // blocked rows take nothing but Leave out
  const choices = { 'Pull Up': { kind: 'existing', exerciseId: 'x-pull-up-weighted' }, 'Moon Hold': { kind: 'new', name: 'Moon Hold', category: 'duration', bodyPart: 'core' }, 'Bench Press (Barbell)': { kind: 'existing', exerciseId: 'x-bench-press-barbell' } };
  const problems = core.strongImportProblems(preview, choices, core.SEED_EXERCISES);
  assert.match(problems.find((x) => x.name === 'Bench Press (Barbell)').problem, /negative weight/);
  assert.match(problems.find((x) => x.name === 'Moon Hold').problem, /combine fields/);
  assert.throws(() => core.resolveStrongImport(preview, choices, { exercises: core.SEED_EXERCISES }), /negative weight/);
  choices['Bench Press (Barbell)'] = { kind: 'skip' };
  choices['Moon Hold'] = { kind: 'skip' };
  const r = core.resolveStrongImport(preview, choices, { exercises: core.SEED_EXERCISES });
  assert.deepEqual(r.workouts.map((w) => w.exercises.map((e) => e.exerciseId)), [['x-pull-up-weighted', 'x-pull-up-assisted'], ['x-squat-barbell']], 'the rest imports; a workout with nothing left is not made');
  assert.equal(r.workouts[0].exercises[1].sets[0].w, 20, 'assistance as Strong wrote it');
  assert.deepEqual(r.stats.omitted, { sets: 5, workouts: 1, exercises: ['Bench Press (Barbell)', 'Moon Hold'] });
  assert.equal(r.stats.sets, 3);
  assert.equal(r.exercises.length, 0, 'no exercise is made for left-out sets');
  assert.equal(r.aliases['Moon Hold'], undefined, 'a skip is not remembered');
  assert.equal(r.aliases['Pull Up'], 'x-pull-up-weighted');
  // everything left out: nothing is made, and the stats say so
  const lone = core.parseStrongCSV(strongFile([['Moon Hold', 20, 8], ['Moon Hold', 0, 0, 0, 30]]), { exercises: core.SEED_EXERCISES });
  const none = core.resolveStrongImport(lone, { 'Moon Hold': { kind: 'skip' } }, { exercises: core.SEED_EXERCISES });
  assert.deepEqual([none.workouts.length, none.exercises.length, none.stats.omitted.sets, none.stats.omitted.workouts], [0, 0, 2, 1]);
  // the remembered choice for Pull Up matches silently next time, past the incompatible exact name
  const again = core.parseStrongCSV(strongFile([['Pull Up', 12, 6, 0, 0, '2026-10-05 12:00:00']]), { exercises: core.SEED_EXERCISES, aliases: r.aliases });
  assert.deepEqual([again.review.length, again.matches['Pull Up']], [0, 'x-pull-up-weighted']);
});

test('logging times (#43): set by logging, gone on uncheck, kept by edits and backups, never copied into routines or new sessions', () => {
  const st = core.withDefaults({ unit: 'kg', distUnit: 'km' });
  const bench = core.SEED_EXERCISES.find((e) => e.id === 'x-bench-press-barbell');
  const exercises = new Map([[bench.id, bench]]);
  const draft = core.newActiveWorkout({ template: { id: 't', name: 'Push', exercises: [E(bench.id, [S('normal', 60, 8), S('normal', 60, 8), S('normal', 60, 8)])] }, settings: st, now: 1000 });
  const entry = draft.exercises[0];
  assert.ok(entry.sets.every((x) => !('doneAt' in x)), 'a new session has none');
  // a set that can't be logged yet gets no time
  assert.ok(core.checkOffSet(draft, entry, 0, { category: 'barbell', ph: {}, rest: 0, settings: st, now: 5000 }).problem);
  assert.equal(entry.sets[0].doneAt, undefined);
  const ph = { w: '60', r: '8' };
  core.checkOffSet(draft, entry, 0, { category: 'barbell', ph, rest: 0, settings: st, now: 5000 });
  assert.equal(entry.sets[0].doneAt, 5000);
  core.uncheckSet(entry.sets[0]);
  assert.deepEqual([entry.sets[0].done, 'doneAt' in entry.sets[0]], [false, false]);
  core.checkOffSet(draft, entry, 0, { category: 'barbell', ph, rest: 0, settings: st, now: 7000 });
  assert.equal(entry.sets[0].doneAt, 7000, 'logging again takes the new time');
  // Save them as done: pending sets get the Finish time, a time already there stays
  entry.sets[1].w = '62.5';
  entry.sets[2].w = '65';
  entry.sets[2].doneAt = 6000; // e.g. logged, then edited back to pending by an older version
  core.logPendingSets(draft, new Map([[entry.sets[1].id, { w: '62.5', r: '8' }], [entry.sets[2].id, { w: '65', r: '8' }]]), 9000);
  assert.deepEqual(entry.sets.map((x) => x.doneAt), [7000, 9000, 6000]);
  const workout = core.finishWorkout(draft, { settings: st, exercises, now: 10000, mode: 'done' });
  assert.deepEqual(workout.exercises[0].sets.map((x) => x.doneAt), [7000, 9000, 6000]);
  // Edit workout and backups keep them; an old set without one stays without
  const old = { ...workout, exercises: [{ ...workout.exercises[0], sets: [...workout.exercises[0].sets, { id: 'old', type: 'normal', w: 50, r: 5 }] }] };
  const edited = core.workoutFromEditDraft(core.workoutEditDraft(old, st), { settings: st, exercises }).workout;
  assert.deepEqual(edited.exercises[0].sets.map((x) => x.doneAt), [7000, 9000, 6000, undefined]);
  assert.equal('doneAt' in edited.exercises[0].sets[3], false);
  const restored = core.parseBackup(core.makeBackup({ exercises: [bench], workouts: [old], templates: [], measurements: [], kv: {} }, 't')).data.workouts[0];
  assert.deepEqual(restored, old);
  // routines, copies, links and new sessions never take them
  const noTimes = (list) => list.every((e) => e.sets.every((x) => !('doneAt' in x)));
  const saveAs = core.templateFromDraft(core.templateDraft({ workout, settings: st }), { settings: st, exercises }).template;
  assert.ok(noTimes(saveAs.exercises), 'Save as routine');
  assert.ok(noTimes(core.applyWorkoutToTemplate(saveAs.exercises, workout)), 'Update routine');
  assert.ok(noTimes(core.applyWorkoutToTemplate(saveAs.exercises, workout, { valuesOnly: true })), 'Update routine values');
  assert.ok(noTimes(core.progressTemplate(saveAs.exercises, workout, () => 'barbell').exercises), 'progression');
  assert.ok(noTimes(core.cleanTemplateExercises(workout.exercises)), 'cleaned routine');
  assert.ok(noTimes(core.copyTemplateRecord(saveAs, { hasExercise: () => true }).exercises), 'Duplicate');
  assert.doesNotMatch(core.encodeTemplate(saveAs, exercises), /doneAt/);
  assert.ok(noTimes(core.newActiveWorkout({ fromWorkout: workout, settings: st, now: 20000 }).exercises), 'Do this workout again');
  assert.ok(noTimes(core.newActiveWorkout({ template: saveAs, settings: st, now: 20000 }).exercises), 'start the routine');
});

// ---------- export and backup contracts (#28) ----------
const fixture = (name) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8');
/** Run with the timezone pinned (CSV dates are local time). */
function withTZ(tz, fn) {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
}
const { EXPORT_EXERCISES, EXPORT_WORKOUTS } = await import('./fixtures/strong-export-workouts.mjs');
const exportMap = (list = EXPORT_EXERCISES) => new Map(list.map((e) => [e.id, e]));

test('CSV export is Strong’s 12-column style, pinned by golden files (kg/km and lb/mi)', () => {
  withTZ('UTC', () => {
    for (const [file, unit, distUnit] of [['strong-export-kg.csv', 'kg', 'km'], ['strong-export-lb.csv', 'lb', 'mi']]) {
      const csv = core.exportCSV({ workouts: EXPORT_WORKOUTS, exercises: exportMap(), unit, distUnit });
      assert.equal(csv, fixture(file), file);
      assert.ok(csv.endsWith('",\n') || csv.endsWith(',\n'), 'one final newline');
      assert.equal(csv.split('\n')[0], 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE');
    }
    // the order of the workouts doesn't matter, the export is oldest first
    assert.equal(core.exportCSV({ workouts: [...EXPORT_WORKOUTS].reverse(), exercises: exportMap() }), fixture('strong-export-kg.csv'));
  });
});

test('app-only fields never add CSV columns or change the values', () => {
  // sides, set times, pinned notes, families, hidden exercises, chart settings and fields from later versions
  const extra = (o) => ({ ...o, futureField: { any: 1 } });
  const workouts = EXPORT_WORKOUTS.map((w) => extra({ ...w, exercises: w.exercises.map((e) => extra({ ...e, supersetId: 'g1', focus: 'tempo',
    sets: e.sets.map((x, i) => extra({ ...x, side: i % 2 ? 'left' : 'right', doneAt: w.startedAt + i * 60000, done: true })) })) }));
  const exercises = EXPORT_EXERCISES.map((e) => extra({ ...e, pinnedNote: 'Brace', family: 'fc-mine', hidden: true, restSec: 90, chartMetric: 'heaviest' }));
  withTZ('UTC', () => assert.equal(core.exportCSV({ workouts, exercises: exportMap(exercises) }), fixture('strong-export-kg.csv')));
});

test('CSV export → Strong import keeps the training data (stated rounding; RIR becomes RPE)', () => {
  withTZ('UTC', () => {
    for (const [unit, distUnit, wTol, dTol] of [['kg', 'km', 0.005, 0.0005], ['lb', 'mi', 0.05 * core.KG_PER_LB, 0.001 * core.KM_PER_MI]]) {
      const csv = core.exportCSV({ workouts: EXPORT_WORKOUTS, exercises: exportMap(), unit, distUnit });
      const preview = core.parseStrongCSV(csv, { exercises: EXPORT_EXERCISES, weightUnit: unit, distUnit });
      assert.deepEqual(preview.review, [], `${unit}: every exercise matches by name`);
      const back = core.resolveStrongImport(preview, {}, { exercises: EXPORT_EXERCISES }).workouts;
      assert.equal(back.length, EXPORT_WORKOUTS.length);
      EXPORT_WORKOUTS.forEach((w, i) => {
        const b = back[i];
        assert.equal(b.name, w.name);
        assert.equal(b.notes, w.notes);
        assert.equal(b.startedAt, Math.floor(w.startedAt / 1000) * 1000, 'to the second');
        assert.equal(Math.round((b.endedAt - b.startedAt) / 60000), Math.round((w.endedAt - w.startedAt) / 60000), 'duration to the minute');
        w.exercises.forEach((e, j) => {
          const be = b.exercises[j];
          assert.equal(be.exerciseId, e.exerciseId);
          assert.equal(be.notes || '', e.notes || '');
          e.sets.forEach((x, k) => {
            const bs = be.sets[k];
            assert.equal(bs.type, x.type);
            assert.ok(Math.abs((bs.w || 0) - (x.w || 0)) <= wTol, `${unit} weight ${x.w} → ${bs.w}`);
            assert.equal(bs.r || 0, x.r || 0);
            assert.ok(Math.abs((bs.d || 0) - (x.d || 0)) <= dTol, `${distUnit} distance ${x.d} → ${bs.d}`);
            assert.equal(bs.t || 0, x.t || 0);
            // CSV knows RPE only: reps in reserve come back as 10 − RIR
            assert.equal(bs.rpe ?? null, x.rpe ?? core.rpeFromRir(x.rir));
          });
        });
      });
    }
  });
});

test('Setlog-format backups: structure pinned, user data kept, only documented normalization', () => {
  const text = fixture('setlog-backup.json');
  const file = JSON.parse(text);
  const { data } = core.parseBackup(text, core.SEED_EXERCISES);
  // user data comes back as it was
  for (const list of ['workouts', 'templates', 'measurements']) assert.deepEqual(data[list], file.data[list], list);
  for (const ex of file.data.exercises) assert.deepEqual(data.exercises.find((e) => e.id === ex.id), ex, ex.id);
  assert.deepEqual(data.kv.settings, file.data.kv.settings);
  assert.deepEqual(data.kv.profile, file.data.kv.profile);
  assert.deepEqual(data.kv.strongAliases, file.data.kv.strongAliases);
  assert.deepEqual(data.kv.futureKey, file.data.kv.futureKey, 'unknown kv data is kept');
  // documented normalization: the built-in library is added, the backup counts as one, empty families go
  assert.ok(data.exercises.length > file.data.exercises.length);
  assert.equal(data.kv.meta.lastBackupAt, Date.parse(file.exportedAt));
  assert.deepEqual({ ...data.kv.meta, lastBackupAt: 0 }, { ...file.data.kv.meta, lastBackupAt: 0 });
  assert.deepEqual(data.kv.customFamilies, { 'fc-moon': 'Moon Lift' });
  // a backup made from it reads the same (not byte for byte: exportedAt and appVersion change)
  const again = JSON.parse(core.makeBackup(data, '2.0.0', new Date('2026-11-11T00:00:00Z')));
  assert.deepEqual([again.app, again.schema, Object.keys(again).sort()], ['setlog', 1, ['app', 'appVersion', 'data', 'exportedAt', 'schema']]);
  assert.deepEqual(Object.keys(again.data).sort(), ['exercises', 'kv', 'measurements', 'templates', 'workouts']);
  const twice = core.parseBackup(JSON.stringify(again), core.SEED_EXERCISES).data;
  for (const list of ['exercises', 'workouts', 'templates', 'measurements']) assert.deepEqual(twice[list], data[list], list);
  assert.deepEqual({ ...twice.kv, meta: { ...twice.kv.meta, lastBackupAt: 0 } }, { ...data.kv, meta: { ...data.kv.meta, lastBackupAt: 0 } });
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

test('a backup never brings a running workout along; other kv keys stay', () => {
  const active = { id: 'a', kind: 'workout', name: 'Old', startedAt: 1, exercises: [] };
  const data = { exercises: [], workouts: [], templates: [], measurements: [], kv: { settings: { unit: 'lb' }, active, later: 1 } };
  const kv = core.parseBackup(core.makeBackup(data, '1.6.0'), []).data.kv;
  assert.equal('active' in kv, false);
  assert.deepEqual(kv.settings, { unit: 'lb' });
  assert.equal(kv.later, 1, 'a key the app doesn’t know is kept');
});

test('recovery backups carry the running workout beside the data; old files restore as before', () => {
  const active = { id: 'a1', kind: 'workout', name: 'Push', startedAt: 10, exercises: [{ id: 'e', exerciseId: 'x', sets: [] }], updatedAt: 20 };
  const data = { exercises: [], workouts: [{ id: 'w' }], templates: [], measurements: [], kv: { settings: { unit: 'kg' } } };
  const file = JSON.parse(core.makeBackup(data, '1.0.0', new Date(0), { active }));
  assert.deepEqual(file.recovery, { active }, 'the running workout is beside data, not in kv');
  assert.equal('active' in file.data.kv, false);
  const back = core.parseBackup(JSON.stringify(file), []);
  assert.deepEqual(back.recovery, { active });
  assert.equal(back.data.workouts.length, 1);
  assert.equal(core.parseBackup(core.makeBackup(data, 'old'), []).recovery, null, 'a file without recovery restores normally');
  assert.equal('recovery' in JSON.parse(core.makeBackup(data, '1.0.0')), false);
  try { core.parseBackup(JSON.stringify({ ...file, recovery: { active: { id: 1 } } }), []); assert.fail(); } catch (e) {
    assert.deepEqual(e.vars, { part: 'recovery' });
  }
  assert.equal(core.runningWorkoutChoice(null, active), 'restore', 'a fresh install gets the draft back');
  assert.equal(core.runningWorkoutChoice(active, null), 'keep');
  assert.equal(core.runningWorkoutChoice({ ...active }, active), 'keep', 'the same workout: nothing to ask');
  assert.equal(core.runningWorkoutChoice({ ...active, name: 'Pull' }, active), 'ask');
});

test('pending writes: the latest value per key, and conflicts hold whole batches', () => {
  const w = (id, value = { id }) => ({ store: 'workouts', id, value });
  const kv = (key, value) => ({ kv: key, value });
  assert.equal(core.writeKey(w('a')), 'workouts/a');
  assert.equal(core.writeKey(kv('active', null)), 'kv/active');
  const b1 = { ops: [w('a', { id: 'a', n: 1 }), kv('active', { id: 'x' })] };
  const b2 = { ops: [kv('active', null), w('b')] };
  const b3 = { ops: [kv('settings', { unit: 'lb' })] };
  const ops = core.coalesceWrites([b1, b2, b3]);
  assert.deepEqual(ops.map(core.writeKey), ['workouts/a', 'kv/active', 'workouts/b', 'kv/settings']);
  assert.equal(ops[1].value, null, 'the later write wins');
  // a conflict on workouts/b holds b2, and with it b1, which shares kv/active
  const split = core.splitBlocked([b1, b2, b3], ['workouts/b']);
  assert.deepEqual(split.blocked, [b1, b2]);
  assert.deepEqual(split.rest, [b3]);
  assert.deepEqual([...split.keys].sort(), ['kv/active', 'workouts/a', 'workouts/b']);
  assert.deepEqual(core.splitBlocked([b1, b2, b3], []).rest, [b1, b2, b3]);
});

test('stored data: checked before the move, compared record by record', () => {
  const raw = { exercises: [{ id: 'e', name: 'A' }], workouts: [{ id: 'w', n: 1 }, { id: 'w', n: 2 }], templates: [], kv: { settings: { b: 1, a: 2 }, active: null } };
  const d = core.storedDataFrom(raw);
  assert.deepEqual(d.workouts, [{ id: 'w', n: 2 }], 'a document saved twice keeps its later copy');
  assert.deepEqual(d.measurements, []);
  assert.equal('active' in d.kv, false, 'empty values are not stored');
  assert.deepEqual([...core.recordsOf(d).keys()], ['exercises/e', 'workouts/w', 'kv/settings']);
  assert.ok(core.sameStoredData(d, { ...d, kv: { settings: { a: 2, b: 1 } } }), 'key order does not matter');
  assert.ok(!core.sameStoredData(d, { ...d, workouts: [] }));
  assert.ok(!core.sameStoredData(d, { ...d, kv: { settings: { a: 2, b: 3 } } }));
  for (const bad of [null, [], 'x', { workouts: {} }, { workouts: [{ name: 'no id' }] }, { kv: [] }]) {
    assert.throws(() => core.storedDataFrom(bad), undefined, JSON.stringify(bad));
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

test('English dates and numbers follow the phone region', () => {
  const cases = [['de-DE', 'en-DE'], ['de_AT', 'en-AT'], ['en-GB', 'en-GB'], ['en-US', 'en-US'], ['fr-FR', 'en-FR'],
    ['zh-Hans-CN', 'en-CN'], ['es-419', 'en-419'], ['de-DE-u-hc-h23', 'en-DE'], ['de-u-ca-gregory', 'en-US'], ['de', 'en-US'], ['', 'en-US'], [undefined, 'en-US']];
  for (const [phone, locale] of cases) assert.equal(core.englishFormatLocale(phone), locale, String(phone));
  // English words with the region's formats
  const d = new Date(2026, 10, 6, 19, 15);
  assert.equal(new Intl.DateTimeFormat(core.englishFormatLocale('de-DE'), { weekday: 'long', day: 'numeric', month: 'long' }).format(d), 'Friday, 6 November');
  assert.equal(new Intl.NumberFormat(core.englishFormatLocale('de-DE')).format(1630.5), '1.630,5');
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
test('app/src/design/tally.ts and web/css/tally.css match docs/design/tokens.json (run `npm run tally` after changing it)', () => {
  const tokens = JSON.parse(read(path.join(ROOT, 'docs/design/tokens.json')));
  const tally = tallyFromTokens(tokens);
  assert.equal(read(path.join(ROOT, 'app/src/design/tally.ts')), renderTally(tally));
  assert.equal(read(path.join(WEB, 'css/tally.css')), renderCss(tokens));
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
test('links: the web app at its domain, and the contact email written in one place only', () => {
  assert.equal(core.privacyPage('de'), 'datenschutz.html');
  assert.equal(core.privacyPage('en'), 'privacy.html');
  assert.equal(core.privacyPage(undefined), 'privacy.html');
  assert.equal(core.WEB_APP_URL, 'https://increment-training.app/');
  assert.match(core.CONTACT_EMAIL, /^[a-z]+@increment-training\.app$/);
  for (const page of ['privacy.html', 'datenschutz.html']) {
    assert.match(read(path.join(WEB, page)), /<a data-contact><\/a>/, `${page}: scripts/web-site.mjs writes the email in`);
  }
  // so it changes in one place: core/links.js (the website build writes it into the pages)
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'web-build') walk(f); }
      else if (/\.(m?js|tsx?|html|json|webmanifest)$/.test(e.name) && read(f).includes(core.CONTACT_EMAIL)) hits.push(path.relative(ROOT, f));
    }
  };
  for (const dir of [WEB, CORE, path.join(ROOT, 'app/src'), path.join(ROOT, 'scripts')]) walk(dir);
  assert.deepEqual(hits, [path.join('core', 'links.js')]);
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

test('browse families open on the last logged visible version, or the usual version without history', () => {
  const all = structuredClone(core.SEED_EXERCISES);
  const members = core.familyMembers('f-squat', all);
  const usual = members[0], smith = members.find((e) => e.id === 'x-squat-smith-machine');
  const sessions = new Map([[usual.id, [{ startedAt: 10 }]], [smith.id, [{ startedAt: 20 }]]]);
  assert.equal(core.lastLoggedExercise(members, new Map()), usual);
  assert.equal(core.lastLoggedExercise(members, sessions), smith);
  assert.equal(core.lastLoggedExercise([], sessions), undefined);
  assert.equal(core.lastLoggedExercise(members, new Map([[usual.id, [{ startedAt: 20 }]], [smith.id, [{ startedAt: 20 }]]])), usual, 'ties keep catalogue order');
  const row = core.exerciseBrowseRows(new Map(all.map((e) => [e.id, e])), sessions).find((r) => r.id === 'f-squat');
  assert.equal(row.members.length, members.length);
  assert.equal(row.exercise, smith);
  assert.equal(row.lastAt, 20);
  assert.equal(row.bodyPart, usual.bodyPart);
  smith.hidden = true;
  const hidden = core.exerciseBrowseRows(all, sessions).find((r) => r.id === 'f-squat');
  assert.equal(hidden.members.length, members.length - 1);
  assert.equal(hidden.exercise, usual, 'hidden last-used versions never become an opening target');
  assert.equal(hidden.lastAt, 10);
});

test('family browsing filters actual members, keeps usual body parts, custom order and standalone exercises', () => {
  const builtins = core.familyMembers('f-squat').map((e) => ({ ...e }));
  const usual = builtins[0];
  usual.hidden = true;
  builtins[1].bodyPart = 'other';
  const custom = { id: 'c-cybex', name: 'Squat (Cybex Machine)', category: 'machine', bodyPart: 'legs', family: 'f-squat' };
  const alone = { id: 'c-alone', name: 'Squat (My Own)', category: 'machine', bodyPart: 'back', family: null };
  const unknown = { ...alone, id: 'c-unknown', family: 'f-future' };
  const exercises = [...builtins, custom, alone, unknown];
  const before = JSON.stringify(exercises);
  const rows = core.exerciseBrowseRows(exercises, new Map());
  assert.equal(rows.length, 3);
  const row = rows[0];
  assert.equal(row.bodyPart, usual.bodyPart, 'body-part filtering follows the usual member, including a hidden one');
  assert.equal(row.members.find((e) => e.id === custom.id), custom, 'actual custom object is retained');
  assert.ok(row.members.indexOf(custom) < row.members.findIndex((e) => e.id === 'x-front-squat-barbell'), 'custom equipment stays with its movement');
  assert.equal(rows[1].exercise, alone);
  assert.equal(rows[1].family, null);
  assert.equal(rows[2].exercise, unknown, 'an unknown custom family has no invented display name');
  const filtered = core.exerciseBrowseRows(exercises, new Map(), { accepts: (e) => core.canMergeExercises({ id: null, category: 'reps' }, e) });
  assert.ok(filtered[0].members.every((e) => e.category === 'reps'));
  assert.equal(filtered[0].exercise.category, 'reps');
  assert.deepEqual(core.exerciseBrowseRows(exercises, new Map(), { accepts: () => false }), []);
  assert.deepEqual(core.exerciseBrowseRows(builtins.map((e) => ({ ...e, hidden: true })), new Map()), []);
  assert.equal(JSON.stringify(exercises), before, 'browsing never changes records');
  assert.equal(core.exerciseEquipment({ name: 'My Row (Upper) (Cybex Machine)' }), 'Cybex Machine');
  assert.equal(core.exerciseBaseName({ name: 'My Row (Upper) (Cybex Machine)' }, 'en'), 'My Row (Upper)');
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

test('creating exercises suggests exact built-in and custom families before ungrouped exercises', () => {
  const squat = core.SEED_EXERCISES.find((e) => e.name === 'Squat (Barbell)');
  const ungrouped = { id: 'c-squat', name: 'Squat (Own Machine)', family: null };
  const custom = { id: 'c-moon', name: 'Moon Lift (Cable)', family: 'fc-moon-lift' };
  const registry = { 'fc-moon-lift': 'Moon Lift' };
  const library = [ungrouped, squat, custom];
  const before = JSON.stringify({ library, registry });
  const suggestion = core.suggestExerciseFamily('  s Q u A t (Cybex Machine)', library, registry);
  assert.equal(suggestion.family.id, 'f-squat', 'existing family takes priority over an ungrouped own exercise');
  assert.equal(suggestion.exercise, squat);
  assert.equal(suggestion.name, 'Squat');
  assert.deepEqual(core.suggestExerciseFamily('MoonLift (Machine)', new Map(library.map((e) => [e.id, e])), registry), {
    family: { id: 'fc-moon-lift', name: 'Moon Lift', nameDe: 'Moon Lift', members: [] }, exercise: custom, name: 'Moon Lift',
  });
  for (const name of ['Squats (Machine)', 'Squat Jump', 'Squa (Machine)', 'Moon Lift Extra']) {
    assert.equal(core.suggestExerciseFamily(name, library, registry), undefined, name);
  }
  const kelso = { id: 'c-kelso', name: 'Kelso Shrug (Cable)', family: null };
  assert.deepEqual(core.suggestExerciseFamily('Kelso Shrug (Dumbbell)', [kelso]), { family: null, exercise: kelso, name: 'Kelso Shrug' });
  assert.equal(core.suggestExerciseFamily('Squat (New)', [...library, { ...custom, name: 'Squat (Other)' }], registry), undefined, 'conflicting exact families need a manual choice');
  assert.equal(core.suggestExerciseFamily('', library, registry), undefined);
  const bracketed = { id: 'c-bracketed', name: 'Moon Lift (Upper) (Cable)' };
  assert.equal(core.suggestExerciseFamily('Moon Lift (Upper) (Machine)', [bracketed]).name, 'Moon Lift (Upper)', 'only the last bracket is removed');
  assert.equal(core.suggestExerciseFamily('Moon Lift (Machine)', [bracketed]), undefined);
  assert.equal(JSON.stringify({ library, registry }), before, 'suggesting saves nothing');
});

test('family choices save with the exercise, create custom groups only on save, and keep independent records', () => {
  const first = { id: 'c-kelso-cable', name: 'Kelso Shrug (Cable)', category: 'machine', notes: 'Seat 3', restSec: 60 };
  const next = { id: 'c-kelso-db', name: 'Kelso Shrug (Dumbbell)', category: 'dumbbell', notes: '', restSec: 90 };
  const before = JSON.stringify([first, next]);
  const grouped = core.changeExerciseFamily(next, first.id, [first]);
  assert.deepEqual(grouped.customFamilies, { 'fc-kelso-shrug': 'Kelso Shrug' });
  assert.deepEqual(grouped.exercises, [{ ...first, family: 'fc-kelso-shrug' }, { ...next, family: 'fc-kelso-shrug' }]);
  assert.equal(JSON.stringify([first, next]), before, 'saving does not mutate form or stored input');
  const third = { ...next, id: 'c-kelso-machine', name: 'Kelso Shrug (Machine)' };
  for (const choice of ['fc-kelso-shrug', first.id]) {
    const joinedCustom = core.changeExerciseFamily(third, choice, grouped.exercises, grouped.customFamilies);
    assert.equal(joinedCustom.exercises[2].family, 'fc-kelso-shrug', 'picking a family row or its member joins that existing custom family');
    assert.deepEqual(joinedCustom.customFamilies, grouped.customFamilies);
  }
  const squat = core.SEED_EXERCISES.find((e) => e.name === 'Squat (Barbell)');
  const moved = core.changeExerciseFamily(grouped.exercises[1], squat.id, [...grouped.exercises, squat], grouped.customFamilies);
  assert.equal(moved.exercises.find((e) => e.id === next.id).family, 'f-squat');
  assert.deepEqual(moved.customFamilies, grouped.customFamilies, 'one remaining member keeps its custom family');
  const removed = core.changeExerciseFamily(moved.exercises[0], null, moved.exercises, moved.customFamilies);
  assert.deepEqual(removed.customFamilies, {}, 'moving the final member out deletes its registry entry');
  assert.equal(removed.exercises[0].family, null);
  const kept = core.changeExerciseFamily(next, undefined, [first]);
  assert.deepEqual(kept.exercises, [first, next], 'an untouched form never silently groups by name');
  const joined = core.changeExerciseFamily({ ...next, name: 'Renamed' }, 'f-squat', [squat]);
  assert.deepEqual(joined.exercises[1], { ...next, name: 'Renamed', family: 'f-squat' });
  assert.deepEqual(core.changeExerciseFamily(squat, null, [squat]).exercises, [squat], 'built-ins retain catalogue membership');
  const collision = core.changeExerciseFamily(next, first.id, [first, { ...next, id: 'c-other', family: 'fc-kelso-shrug' }], grouped.customFamilies);
  assert.match(collision.exercises.find((e) => e.id === next.id).family, /^fc-/);
  assert.notEqual(collision.exercises.find((e) => e.id === next.id).family, 'fc-kelso-shrug', 'same-named unrelated groups get separate ids');
});

test('custom registry families browse and filter like catalogue families, and keep hidden members during cleanup', () => {
  const registry = { 'fc-moon-lift': 'Moon Lift', 'fc-empty': 'Empty' };
  const cable = { id: 'c-cable', name: 'Moon Lift (Cable)', family: 'fc-moon-lift', bodyPart: 'back', hidden: true };
  const db = { id: 'c-db', name: 'Moon Lift (Dumbbell)', family: 'fc-moon-lift', bodyPart: 'arms' };
  const machine = { id: 'c-machine', name: 'Moon Lift (Machine)', family: 'fc-moon-lift', bodyPart: 'chest' };
  const library = [cable, db, machine];
  const sessions = new Map([[machine.id, [{ startedAt: 50 }]]]);
  const [row] = core.exerciseBrowseRows(library, sessions, { customFamilies: registry });
  assert.equal(row.id, 'fc-moon-lift');
  assert.equal(row.family.name, 'Moon Lift');
  assert.equal(row.bodyPart, 'back', 'usual member controls filtering even when hidden');
  assert.deepEqual(row.members, [db, machine]);
  assert.equal(row.exercise, machine);
  const [filtered] = core.exerciseBrowseRows(library, sessions, { customFamilies: registry, accepts: (e) => e.id === db.id });
  assert.deepEqual(filtered.members, [db]);
  assert.equal(filtered.exercise, db);
  assert.deepEqual(core.cleanCustomFamilies(registry, [cable]), { 'fc-moon-lift': 'Moon Lift' });
  assert.deepEqual(core.cleanCustomFamilies(registry, []), {});
  assert.equal(core.exerciseFamily('fc-unknown', registry), undefined);
});

test('custom family backups round-trip, old backups restore, and empty registry entries are removed', () => {
  const ex = { id: 'c-moon', name: 'Moon Lift (Cable)', family: 'fc-moon-lift' };
  const data = { exercises: [ex], workouts: [{ id: 'w', exercises: [{ exerciseId: ex.id }] }], templates: [], measurements: [],
    kv: { customFamilies: { 'fc-moon-lift': 'Moon Lift', 'fc-empty': 'Empty' } } };
  const restored = core.parseBackup(core.makeBackup(data, 'test')).data;
  assert.deepEqual(restored.exercises, data.exercises);
  assert.deepEqual(restored.workouts, data.workouts);
  assert.deepEqual(restored.kv.customFamilies, { 'fc-moon-lift': 'Moon Lift' });
  assert.deepEqual(core.parseBackup(core.makeBackup({ ...data, kv: {} }, 'old')).data.kv.customFamilies, {});
});

test('merges retain the target family and remove empty source-family registry entries', () => {
  const from = { id: 'c-from', name: 'Moon Lift', category: 'machine', family: 'fc-moon', notes: 'Slow' };
  const into = { id: 'c-into', name: 'Squat (Custom)', category: 'machine', family: 'f-squat' };
  const target = { ...into, ...core.mergeExercisePatch(from, into) };
  assert.equal(target.family, 'f-squat');
  assert.equal(target.notes, from.notes);
  assert.deepEqual(core.cleanCustomFamilies({ 'fc-moon': 'Moon' }, [target]), {});
  assert.equal(core.familyOf({ ...into, family: null, ...core.mergeExercisePatch(from, { ...into, family: null }) }), null, 'an ungrouped target stays ungrouped');
});

test('Strong exact-base creation joins custom families without sharing their history', () => {
  const ex = { id: 'c-moon', name: 'Moon Lift (Cable)', family: 'fc-moon-lift', category: 'machine', bodyPart: 'back' };
  assert.equal(core.strongExerciseFamily('MOONLIFT (Machine)', [ex]), ex.family);
  assert.equal(core.strongExerciseFamily('Moon Lifts (Machine)', [ex]), undefined);
  const csv = strongFile([['Moon Lift (Machine)']]);
  const preview = core.parseStrongCSV(csv, { exercises: [ex] });
  const result = core.resolveStrongImport(preview, { 'Moon Lift (Machine)': { kind: 'new', name: 'Moon Lift (Machine)', category: 'machine', bodyPart: 'back' } }, { exercises: [ex] });
  assert.equal(result.exercises[0].family, ex.family);
  assert.notEqual(result.exercises[0].id, ex.id);
  assert.equal(result.workouts[0].exercises[0].exerciseId, result.exercises[0].id);
});

test('routine links carry custom exercises in catalogue families, but never share custom families', () => {
  const builtin = { id: 'c-squat', name: 'Squat (Cybex Machine)', family: 'f-squat', category: 'machine', bodyPart: 'legs' };
  const custom = { ...builtin, id: 'c-moon', name: 'Moon Lift (Cable)', family: 'fc-moon-lift' };
  const separate = { ...builtin, id: 'c-alone', name: 'Squat (Alone)', family: null };
  const exercises = [builtin, custom, separate];
  const code = core.encodeTemplate({ name: 'Legs', exercises: exercises.map((ex) => ({ exerciseId: ex.id, sets: [{ type: 'normal', r: 10 }] })) }, new Map(exercises.map((ex) => [ex.id, ex])));
  const decoded = core.decodeTemplate('#template=' + code);
  assert.equal(decoded.exercises[0].family, 'f-squat');
  assert.equal(decoded.exercises[1].family, undefined);
  assert.equal(decoded.exercises[2].family, undefined);
  const raw = JSON.parse(Buffer.from(code, 'base64url').toString());
  assert.equal(raw.e[1].f, undefined, 'the custom family id never leaves this library');
  for (const family of ['fc-injected', 'toString', '__proto__']) {
    raw.e[0].f = family;
    assert.equal(core.decodeTemplate('#template=' + Buffer.from(JSON.stringify(raw)).toString('base64url')).exercises[0].family, undefined, 'only real catalogue ids are accepted');
  }
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

// ---------- optional left/right sets ----------
const sided = (side, w = 26, type = 'normal') => ({ type, w, r: 5, ...(side ? { side } : {}) });
test('set sides survive drafts, targets, repeat workouts, routine copies and Edit workout', () => {
  const st = { unit: 'kg', distUnit: 'km' };
  const sets = [sided('left'), sided('right', 22), sided(undefined, 30)].map((s, i) => ({ ...s, id: `side-${i}` }));
  for (const s of sets) assert.deepEqual(core.draftToSet(core.setToDraft(s, st), st), s);
  assert.equal(core.newSetDraft('normal', { side: 'left' }).side, 'left');
  assert.equal('side' in core.newSetDraft(), false);
  const entry = { id: 'e', exerciseId: 'curl', sets };
  for (const asTemplateTargets of [false, true]) {
    assert.deepEqual(core.entryToDraft(entry, st, { asTemplateTargets }).sets.map((s) => s.side), ['left', 'right', undefined]);
  }
  const template = { id: 'routine', name: 'Sides', exercises: [entry] };
  const workout = { id: 'wo', name: 'Sides', startedAt: 1, endedAt: 60001, templateId: 'routine', exercises: [entry] };
  const lib = new Map([['curl', { id: 'curl', category: 'dumbbell' }]]);
  for (const options of [{ template }, { fromWorkout: workout }]) {
    const active = core.newActiveWorkout({ ...options, settings: st });
    assert.deepEqual(active.exercises[0].sets.map((s) => s.side), ['left', 'right', undefined]);
    assert.ok(active.exercises[0].sets.every((s) => !s.done && s.w === ''));
  }
  const routine = core.templateFromDraft(core.templateDraft({ template, settings: st }), { settings: st, exercises: lib }).template;
  assert.deepEqual(routine.exercises[0].sets.map((s) => s.side), ['left', 'right', undefined]);
  assert.deepEqual(core.cleanTemplateExercises([entry])[0].sets.map((s) => s.side), ['left', 'right', undefined]);
  const edited = core.workoutFromEditDraft(core.workoutEditDraft(workout, st), { settings: st, exercises: lib }).workout;
  assert.deepEqual(edited.exercises[0].sets, sets);
});

test('Add set continues alternating or repeated sides; warm-up insertion never inherits a side', () => {
  for (const [sides, expected] of [[[], undefined], [[undefined], undefined], [['left'], 'right'], [['right'], 'left'], [['left', 'right'], 'left'], [['left', 'left'], 'left'], [['right', 'right'], 'right'], [['left', undefined], undefined]]) {
    const entry = { sets: sides.map((s) => core.newSetDraft('normal', s ? { side: s } : {})) };
    core.addSet(entry);
    assert.equal(entry.sets.at(-1).side, expected, JSON.stringify(sides));
    if (!expected) assert.equal('side' in entry.sets.at(-1), false);
  }
  const drop = { sets: [{ type: 'drop', side: 'left' }] };
  core.addSet(drop);
  assert.equal(drop.sets[1].type, 'drop');
  assert.equal(drop.sets[1].side, 'right');
  const entry = { sets: [core.newSetDraft('normal', { w: '100', r: '5', side: 'left' })] };
  const result = core.addWarmups(entry, [{ ph: {} }], 'barbell', { ...core.DEFAULT_SETTINGS, unit: 'kg', bar: 20, plates: core.KG_PLATES, warmup: core.DEFAULT_WARMUP });
  assert.ok(result.added > 0);
  assert.ok(entry.sets.filter((s) => s.type === 'warmup').every((s) => !('side' in s)));
  assert.equal(entry.sets.at(-1).side, 'left');
});

test('one pairing rule keeps left/right/untagged and warm-ups separate, with legacy order fallback', () => {
  const left = [sided('left'), sided('right'), sided('left'), sided('right')];
  const history = [sided('right', 18), sided('left', 26), sided('right', 20), sided('left', 28)];
  assert.deepEqual(core.pairSets(left, history), [1, 0, 3, 2]);
  assert.deepEqual(core.pairSets([sided('left'), sided(), sided('right')], [sided('right'), sided('left'), sided()]), [1, 2, 0]);
  assert.deepEqual(core.pairSets([sided('left', 20, 'warmup'), sided('left'), sided('right')], [sided('right'), sided('left'), sided('left', 20, 'warmup')]), [2, 1, 0]);
  assert.deepEqual(core.pairSets(left, history.map(({ side, ...s }) => s)), [0, 1, 2, 3]);
  assert.deepEqual(core.pairSets(left.map(({ side, ...s }) => s), history), [0, 1, 2, 3]);
  assert.deepEqual(core.pairSets([sided('left'), sided('right')], [sided('left')]), [0, -1]);
});

test('side-aware placeholders pair each side in order and retain grey values from untagged history', () => {
  const st = { unit: 'kg', distUnit: 'km' };
  const entry = { sets: ['left', 'right', 'left', 'right'].map((side) => core.newSetDraft('normal', { side })) };
  const history = [sided('left', 26), sided('right', 18), sided('left', 28), sided('right', 20)];
  assert.deepEqual(core.placeholders(entry, history, st).map((row) => row.ph.w), ['26', '18', '28', '20']);
  const reversed = [history[1], history[0], history[3], history[2]];
  const rows = core.placeholders(entry, reversed, st);
  assert.deepEqual(rows.map((row) => row.prev.side), ['left', 'right', 'left', 'right']);
  assert.deepEqual(rows.map((row) => row.ph.w), ['26', '18', '28', '20']);
  assert.deepEqual(core.placeholders(entry, history.map(({ side, ...s }) => s), st).map((row) => row.ph.w), ['26', '18', '28', '20']);
});

test('routine comparison and both update paths pair sides, detect changes and retain the right metadata', () => {
  const T = [E('curl', [sided('left', 26), sided('right', 18), sided('left', 28), sided('right', 20)])];
  const W = { exercises: [E('curl', [sided('right', 19), sided('left', 27), sided('right', 21), sided('left', 29)])] };
  const before = JSON.stringify({ T, W });
  const diff = core.templateChanges({ exercises: T }, W);
  assert.equal(diff.sidesChanged, false, 'the same side counts in a different order still pair by side');
  assert.equal(diff.valueSets, 4);
  assert.equal(diff.structure, false);
  assert.deepEqual(core.applyWorkoutToTemplate(T, W, { valuesOnly: true })[0].sets.map((s) => [s.side, s.w]), [['left', 27], ['right', 19], ['left', 29], ['right', 21]]);
  assert.deepEqual(core.progressTemplate(T, W, () => 'dumbbell').exercises[0].sets.map((s) => [s.side, s.w]), [['left', 27], ['right', 19], ['left', 29], ['right', 21]]);
  const tagged = { exercises: [E('curl', [sided('left', 20), sided('right', 15)])] };
  const untagged = [E('curl', [sided(undefined, 26), sided(undefined, 18)])];
  assert.equal(core.templateChanges({ exercises: untagged }, tagged).sidesChanged, true);
  assert.equal(core.templateChanges({ exercises: untagged }, tagged).structure, true);
  assert.deepEqual(core.applyWorkoutToTemplate(untagged, tagged)[0].sets.map((s) => s.side), ['left', 'right']);
  assert.ok(core.applyWorkoutToTemplate(untagged, tagged, { valuesOnly: true })[0].sets.every((s) => !('side' in s)));
  const layout = core.progressTemplate(untagged, tagged, () => 'dumbbell', { layout: true });
  assert.deepEqual(layout.exercises[0].sets.map((s) => [s.side, s.w]), [['left', 26], ['right', 18]], 'Update routine keeps better targets and saves the workout sides');
  const removed = { exercises: [E('curl', [sided(undefined, 30), sided(undefined, 22)])] };
  const oldSides = [E('curl', [sided('left', 26), sided('right', 18)])];
  assert.deepEqual(core.applyWorkoutToTemplate(oldSides, removed, { valuesOnly: true })[0].sets.map((s) => s.side), ['left', 'right']);
  assert.ok(core.applyWorkoutToTemplate(oldSides, removed)[0].sets.every((s) => !('side' in s)));
  assert.deepEqual(core.progressTemplate(oldSides, removed, () => 'dumbbell').exercises[0].sets.map((s) => s.side), ['left', 'right']);
  assert.ok(core.progressTemplate(oldSides, removed, () => 'dumbbell', { layout: true }).exercises[0].sets.every((s) => !('side' in s)));
  const changedCount = core.templateChanges({ exercises: [E('curl', [sided('left'), sided('left')])] }, tagged);
  assert.equal(changedCount.sidesChanged, true);
  assert.equal(changedCount.structure, true);
  const swappedWarm = core.templateChanges({ exercises: [E('curl', [sided('left', 20, 'warmup'), sided('right')])] }, { exercises: [E('curl', [sided('right', 20, 'warmup'), sided('left')])] });
  assert.equal(swappedWarm.sidesChanged, true, 'warm-up side counts do not hide working-side changes');
  assert.equal(JSON.stringify({ T, W }), before);
});

test('muscle and routine set counts use the larger side count per exercise; minutes count every row', () => {
  const now = Date.now();
  const lib = new Map([['curl', { bodyPart: 'arms', category: 'dumbbell' }], ['plank', { bodyPart: 'core', category: 'duration' }]]);
  const paired = ['left', 'right', 'left', 'right', 'left', 'right'].map((s) => sided(s));
  const entries = [E('curl', paired), E('plank', [sided('left'), sided('right'), sided('left'), sided()])];
  const counts = core.setsPerMuscle([{ startedAt: now, exercises: entries }], lib, { now });
  assert.deepEqual(counts.map((m) => [m.muscle, m.sets]), [['arms', 3], ['core', 3]]);
  assert.equal(core.routineSize({ exercises: entries }, lib).sets, 6);
  const normal = entries.map((e) => ({ ...e, sets: e.sets.map(({ side, ...s }) => s) }));
  assert.equal(core.routineSize({ exercises: entries }, lib).minutes, core.routineSize({ exercises: normal }, lib).minutes);
  assert.equal(core.routineSize({ exercises: [E('curl', [sided('left'), sided('right'), sided('left')])] }, lib).sets, 2);
  assert.equal(core.routineSize({ exercises: [E('curl', [...paired, sided(), sided('left', 10, 'warmup')])] }, lib).sets, 4);
  const repeated = [E('curl', paired.filter((s) => s.side === 'left')), E('curl', paired.filter((s) => s.side === 'right'))];
  assert.equal(core.routineSize({ exercises: repeated }, lib).sets, 3);
  assert.equal(core.setsPerMuscle([{ startedAt: now, exercises: repeated }], lib, { now })[0].sets, 3);
});

test('routine links preserve optional sixth-value sides, keep preceding nulls and read old links', () => {
  const ex = core.SEED_EXERCISES[0];
  const routine = { name: 'Sides', exercises: [E(ex.id, [sided('left'), { type: 'normal', t: 45, side: 'right' }, sided()])] };
  const code = core.encodeTemplate(routine, new Map([[ex.id, ex]]));
  const raw = JSON.parse(Buffer.from(code, 'base64url').toString());
  assert.deepEqual(raw.e[0].s, [['n', 26, 5, null, null, 'l'], ['n', null, null, null, 45, 'r'], ['n', 26, 5]]);
  assert.deepEqual(core.decodeTemplate('#template=' + code).exercises[0].sets, routine.exercises[0].sets);
  const old = { v: 1, n: 'Old routine', e: [{ n: 'Curl', c: 'dumbbell', b: 'arms', s: [['n', 24, 8], ['w', 10, 10, null, null]] }] };
  const decoded = core.decodeTemplate('#template=' + Buffer.from(JSON.stringify(old)).toString('base64url'));
  assert.deepEqual(decoded.exercises[0].sets, [{ type: 'normal', w: 24, r: 8 }, { type: 'warmup', w: 10, r: 10 }]);
  raw.e[0].s[0][5] = 'unknown';
  assert.equal('side' in core.decodeTemplate('#template=' + Buffer.from(JSON.stringify(raw)).toString('base64url')).exercises[0].sets[0], false);
});

test('backups keep set sides unchanged while Strong CSV export drops only the side metadata', () => {
  const ex = core.SEED_EXERCISES.find((e) => e.category === 'dumbbell');
  const workout = { id: 'sides-wo', name: 'Sides', startedAt: 1, endedAt: 60001, exercises: [E(ex.id, [sided('left'), sided('right', 20), sided()])] };
  const data = { exercises: [ex], workouts: [workout], templates: [{ id: 'tpl', name: 'Sides', exercises: workout.exercises }], measurements: [], kv: {} };
  const restored = core.parseBackup(core.makeBackup(data, 'test')).data;
  assert.deepEqual(restored.workouts, data.workouts);
  assert.deepEqual(restored.templates, data.templates);
  const untagged = { ...workout, exercises: workout.exercises.map((e) => ({ ...e, sets: e.sets.map(({ side, ...s }) => s) })) };
  const exercises = new Map([[ex.id, ex]]);
  assert.equal(core.exportCSV({ workouts: [workout], exercises }), core.exportCSV({ workouts: [untagged], exercises }));
});

test('records in a running workout (#37): one set per exercise and metric, as in the summary', () => {
  const st = core.withDefaults({ unit: 'kg', distUnit: 'km' });
  const bench = core.SEED_EXERCISES.find((e) => e.id === 'x-bench-press-barbell');
  const exercises = new Map([[bench.id, bench]]);
  const before = { id: 'old', startedAt: 1000, endedAt: 2000, exercises: [{ id: 'oe', exerciseId: bench.id, sets: [{ id: 'o1', type: 'normal', w: 95, r: 5 }] }] };
  const { bests } = core.buildStats([before], exercises, st.formula);
  /** A running workout with these entries of bench press, sets as [type, w, r, done]. */
  const running = (...entries) => {
    const a = core.newActiveWorkout({ settings: st, now: 5000 });
    a.exercises = entries.map((sets, i) => ({ ...core.newEntryDraft(bench.id), id: `e${i}`,
      sets: sets.map(([type, w, r, done = true], j) => ({ ...core.newSetDraft(type, { w: String(w), r: String(r) }), id: `e${i}s${j}`, done })) }));
    return a;
  };
  const recs = (a, b = bests) => Object.fromEntries([...core.liveRecordSets(a, b, exercises, st)].map(([id, m]) => [id, [...m].sort()]));
  const ALL = ['e1rm', 'volume', 'weight'];
  // the summary of the same workout names the same sets
  const summary = (a, b = bests) => new Set(core.prsForNewWorkout(core.finishWorkout(a, { settings: st, exercises, mode: 'done' }), { bests: b }, exercises, st.formula).map((p) => p.setId));
  const same = (a) => assert.deepEqual(new Set(core.liveRecordSets(a, bests, exercises, st).keys()), summary(a));

  // three equal sets above the old best: one record, the first; one set beating three metrics counts once
  let a = running([['normal', 100, 5], ['normal', 100, 5], ['normal', 100, 5]]);
  assert.deepEqual(recs(a), { e0s0: ALL });
  same(a);
  // a later, better set takes over; an equal one doesn't
  a = running([['normal', 100, 5], ['normal', 102.5, 5], ['normal', 102.5, 5]]);
  assert.deepEqual(recs(a), { e0s1: ALL });
  same(a);
  // different winning sets count separately: the heavy set keeps weight and 1RM, the long one takes volume
  a = running([['normal', 100, 5], ['normal', 90, 8]]);
  assert.deepEqual(recs(a), { e0s0: ['e1rm', 'weight'], e0s1: ['volume'] });
  same(a);
  // matching the old best isn't a record; warm-ups and unchecked sets can't set one
  assert.deepEqual(recs(running([['normal', 95, 5], ['warmup', 200, 5], ['normal', 120, 5, false]])), {});
  // two entries of the same exercise are compared together
  a = running([['normal', 100, 5]], [['normal', 100, 5]]);
  assert.deepEqual(recs(a), { e0s0: ALL });
  a = running([['normal', 100, 5]], [['normal', 105, 5]]);
  assert.deepEqual(recs(a), { e1s0: ALL });
  same(a);
  // unchecking (or deleting) the winner gives the record back to the earlier set
  a = running([['normal', 100, 5], ['normal', 102.5, 5]]);
  core.uncheckSet(a.exercises[0].sets[1]);
  assert.deepEqual(recs(a), { e0s0: ALL });
  a.exercises[0].sets.splice(0, 1);
  assert.deepEqual(recs(a), {});
  // an exercise's first session is its baseline: no records
  assert.deepEqual(recs(running([['normal', 100, 5]]), new Map()), {});
});

test('set totals (#38): warm-ups are never counted; failure and drop sets are; sides count row by row', () => {
  const rows = [S('warmup', 40, 10), S('warmup', 60, 5), S('normal', 80, 5), S('failure', 80, 4), S('drop', 60, 8)];
  assert.equal(core.setTotal(rows), 3);
  assert.equal(core.setTotal([S('warmup', 40, 10)]), 0, 'a warm-up-only exercise has no sets');
  assert.equal(core.setTotal([]), 0);
  // changing a set's type changes the total
  const changed = rows.map((x, i) => (i === 0 ? { ...x, type: 'normal' } : x));
  assert.equal(core.setTotal(changed), 4);
  // left and right rows are two rows here (the paired totals are #54)
  assert.equal(core.setTotal([S('normal', 20, 10, { side: 'left' }), S('normal', 20, 10, { side: 'right' })]), 2);
  const w = { exercises: [E('a', rows), E('b', [S('warmup', 20, 10)]), E('c', [S('normal', 10, 10)])] };
  assert.equal(core.workoutSetCount(w), 4);
});

test('removing an exercise from a superset (#39): a group left with one dissolves, Undo restores it, other groups stay', () => {
  const list = () => [
    { id: 'a', exerciseId: 'xa', supersetId: 'g1', sets: [] }, { id: 'b', exerciseId: 'xb', supersetId: 'g1', sets: [] },
    { id: 'c', exerciseId: 'xc', supersetId: 'g2', sets: [] }, { id: 'd', exerciseId: 'xd', supersetId: 'g2', sets: [] }, { id: 'e', exerciseId: 'xe', supersetId: 'g2', sets: [] },
    { id: 'f', exerciseId: 'xf', supersetId: null, sets: [{ type: 'normal', w: '1' }] },
  ];
  const shape = (l) => l.map((e) => `${e.id}:${e.supersetId || '-'}`).join(' ');
  // two members: the partner is on its own at once
  let l = list();
  const r = core.removeEntry(l, 'a');
  assert.equal(shape(l), 'b:- c:g2 d:g2 e:g2 f:-');
  assert.equal(core.supersetLetters(l).size, 1, 'only one group still has a letter');
  core.restoreEntry(l, r);
  assert.equal(shape(l), shape(list()), 'Undo: the entry, its place and the group are back');
  core.restoreEntry(l, r);
  assert.equal(l.length, 6, 'a second Undo does nothing');
  // three members: the other two stay a superset
  l = list();
  const r2 = core.removeEntry(l, 'd');
  assert.equal(shape(l), 'a:g1 b:g1 c:g2 e:g2 f:-');
  core.restoreEntry(l, r2);
  assert.equal(shape(l), shape(list()));
  // a partner that joined another group in between stays there
  l = list();
  const r3 = core.removeEntry(l, 'b');
  core.joinSuperset(l, l.find((e) => e.id === 'a'), l.find((e) => e.id === 'f'));
  const joined = l.find((e) => e.id === 'a').supersetId;
  core.restoreEntry(l, r3);
  assert.equal(l.find((e) => e.id === 'a').supersetId, joined);
  // the removed entry's sets come back as they were; unknown ids change nothing
  l = list();
  const r4 = core.removeEntry(l, 'f');
  core.restoreEntry(l, r4);
  assert.deepEqual(l.find((e) => e.id === 'f').sets, [{ type: 'normal', w: '1' }]);
  assert.equal(core.removeEntry(l, 'zz'), null);
  // a stored routine without a deleted exercise: no lone superset, the input untouched
  const stored = list().map(({ id, ...e }) => e);
  const left = core.withoutExercise(stored, 'xa');
  assert.deepEqual(left.map((e) => e.supersetId ?? '-'), ['-', 'g2', 'g2', 'g2', '-']);
  assert.ok(!('supersetId' in left[0]));
  assert.equal(stored[1].supersetId, 'g1');
});

test('estimated 1RM (#41): the chosen formula up to 12 reps, Epley above, for every setting', () => {
  const epley = (w, r) => w * (1 + r / 30);
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  for (const { id } of core.FORMULAS) {
    // 13 reps and the reported high-rep sets: Epley, Average of all included
    for (const r of [13, 30, 33, 36, 37]) assert.ok(near(core.est1RM(20, r, id), epley(20, r)), `${id} at ${r} reps`);
    // one rep and nonsense stay as they were
    assert.equal(core.est1RM(100, 1, id), 100);
    assert.equal(core.est1RM(0, 5, id), 0);
    assert.equal(core.est1RM(100, 0, id), 0);
  }
  // at 12 reps each formula is still its own
  assert.ok(near(core.est1RM(100, 12, 'brzycki'), 100 * 36 / 25));
  assert.ok(near(core.est1RM(100, 12, 'epley'), 140));
  assert.ok(!near(core.est1RM(100, 12, 'average'), 140), 'Average of all still averages at 12');
  assert.ok(core.est1RM(20, 36, 'brzycki') < 50, 'no 720 kg from 20 kg × 36');
  // records go through the same estimate
  const bench = core.SEED_EXERCISES.find((e) => e.id === 'x-bench-press-barbell');
  const w = { id: 'w', startedAt: 1, exercises: [{ exerciseId: bench.id, sets: [{ id: 's', type: 'normal', w: 20, r: 36 }] }] };
  const rec = core.exerciseRecords(core.buildStats([w], new Map([[bench.id, bench]]), 'brzycki').byExercise.get(bench.id), 'barbell', 'brzycki');
  assert.ok(near(rec.e1rm.value, epley(20, 36)));
});

test('exercise charts (#27): Heaviest weight by default, the chosen chart per exercise, cleaned and kept in backups', () => {
  const defaults = Object.fromEntries(core.CATEGORIES.map((c) => [c.id || c, core.defaultChartMetric(c.id || c)]));
  assert.deepEqual(defaults, { barbell: 'weight', dumbbell: 'weight', machine: 'weight', weighted_bw: 'weight', assisted_bw: 'reps', reps: 'reps', cardio: 'distance', duration: 'time' });
  // a chosen metric the category has is kept; anything else falls back to the default
  assert.equal(core.chartMetricFor('barbell', 'e1rm'), 'e1rm');
  assert.equal(core.chartMetricFor('barbell', 'distance'), 'weight');
  assert.equal(core.chartMetricFor('reps', undefined), 'reps');
  assert.equal(core.chartMetricFor('cardio', 42), 'distance');
  // the map keeps only existing exercises with a metric they still have
  const bench = core.SEED_EXERCISES.find((e) => e.id === 'x-bench-press-barbell');
  const run = core.SEED_EXERCISES.find((e) => e.category === 'cardio');
  const map = { [bench.id]: 'e1rm', [run.id]: 'weight', gone: 'weight', [bench.id + 'x']: 'e1rm' };
  assert.deepEqual(core.cleanChartMetrics(map, core.SEED_EXERCISES), { [bench.id]: 'e1rm' });
  assert.deepEqual(core.cleanChartMetrics(map, new Map([[bench.id, bench]])), { [bench.id]: 'e1rm' });
  assert.deepEqual(core.cleanChartMetrics(null, core.SEED_EXERCISES), {});
  // backups carry it (cleaned); older backups without it restore as before
  const data = { exercises: [], workouts: [], templates: [], measurements: [], kv: { chartMetrics: map } };
  const back = core.parseBackup(core.makeBackup(data, '1.0.0', new Date()), core.SEED_EXERCISES);
  assert.deepEqual(back.data.kv.chartMetrics, { [bench.id]: 'e1rm' });
  const old = core.parseBackup(core.makeBackup({ ...data, kv: {} }, '1.0.0', new Date()), core.SEED_EXERCISES);
  assert.equal(old.data.kv.chartMetrics, undefined);
  // the Strong CSV doesn't change: it has no place for it
  const w = { id: 'w', name: 'Push', startedAt: Date.UTC(2026, 10, 3, 9), endedAt: Date.UTC(2026, 10, 3, 10), exercises: [E(bench.id, [S('normal', 80, 8)])] };
  const exercises = new Map([[bench.id, bench]]);
  assert.equal(core.exportCSV({ workouts: [w], exercises, kv: { chartMetrics: map } }), core.exportCSV({ workouts: [w], exercises }));
});

test('Plan rows (#32): a routine\'s muscle groups once each in order, and names with how many more', () => {
  const lib = new Map(core.SEED_EXERCISES.map((e) => [e.id, e]));
  const t = { exercises: [E('x-squat-barbell', []), E('x-bench-press-barbell', []), E('x-pull-up', []), E('x-incline-bench-press-barbell', []), E('gone', [])] };
  assert.deepEqual(core.routineMuscles(t, lib).map((m) => m.label), ['Chest', 'Back', 'Legs']);
  assert.deepEqual(core.routineMuscles({ exercises: [] }, lib), []);
  assert.deepEqual(core.namesPreview(['A', 'B', 'C', 'D', 'E']), { shown: ['A', 'B', 'C'], more: 2 });
  assert.deepEqual(core.namesPreview(['A', 'B']), { shown: ['A', 'B'], more: 0 });
});

test('a routine\'s pinned note (#33): set, replaced and removed; kept by the editor, Duplicate, links and backups', () => {
  const st = core.withDefaults({ unit: 'kg', distUnit: 'km' });
  const exercises = new Map(core.SEED_EXERCISES.map((e) => [e.id, e]));
  const t = { id: 't', name: 'Push', notes: 'Heavy day', exercises: [E('x-bench-press-barbell', [S('normal', 80, 5)])] };
  // set, replaced, removed (blank removes it)
  const pinned = core.withPinnedNote(t, '  Go up 2.5 kg  ');
  assert.equal(pinned.pinnedNote, 'Go up 2.5 kg');
  assert.equal(core.withPinnedNote(pinned, 'Seat 4').pinnedNote, 'Seat 4');
  assert.ok(!('pinnedNote' in core.withPinnedNote(pinned, '   ')));
  assert.equal(t.pinnedNote, undefined, 'the original is untouched');
  // the routine editor shows it and saves it; Cancel never reaches templateFromDraft
  const draft = core.templateDraft({ template: pinned, settings: st });
  assert.equal(draft.pinnedNote, 'Go up 2.5 kg');
  assert.equal(core.templateFromDraft(draft, { settings: st, exercises, existing: pinned }).template.pinnedNote, 'Go up 2.5 kg');
  assert.equal(core.templateFromDraft({ ...draft, pinnedNote: 'Paused reps' }, { settings: st, exercises, existing: pinned }).template.pinnedNote, 'Paused reps');
  assert.ok(!('pinnedNote' in core.templateFromDraft({ ...draft, pinnedNote: '' }, { settings: st, exercises, existing: pinned }).template));
  // Duplicate keeps it; a routine without one has none
  assert.equal(core.copyTemplateRecord(pinned).pinnedNote, 'Go up 2.5 kg');
  assert.ok(!('pinnedNote' in core.copyTemplateRecord(t)));
  // a shared link carries it like Notes; links without it still read
  const opts = { categories: core.CATEGORIES.map((c) => c.id), bodyParts: core.BODY_PARTS.map((b) => b.id) };
  const link = (x) => `#template=${core.encodeTemplate(x, exercises)}`;
  assert.equal(core.decodeTemplate(link(pinned), opts).pinnedNote, 'Go up 2.5 kg');
  const old = core.decodeTemplate(link(t), opts);
  assert.equal(old.name, 'Push');
  assert.ok(!('pinnedNote' in old));
  // backups keep it as it is
  const back = core.parseBackup(core.makeBackup({ exercises: [], workouts: [], templates: [pinned], measurements: [], kv: {} }, '1.0.0', new Date()), core.SEED_EXERCISES);
  assert.equal(back.data.templates[0].pinnedNote, 'Go up 2.5 kg');
});
test('rep ranges (#44): parsed in the editor, fixed bounds, a target that moves inside them', () => {
  // what the editor accepts
  assert.equal(core.parseRepsInput('8'), null);
  assert.equal(core.parseRepsInput(''), null);
  assert.deepEqual(core.parseRepsInput('8-10'), { range: [8, 10] });
  assert.deepEqual(core.parseRepsInput(' 8 – 10 '), { range: [8, 10] });
  assert.deepEqual(core.parseRepsInput('8–8'), { r: 8 }, 'equal bounds are one target');
  for (const bad of ['8-', '–10', '10–8', '0–5', '8.5–10', '8–10–12', 'a–b']) assert.deepEqual(core.parseRepsInput(bad), { problem: true }, bad);
  // stored as rMin/rMax next to the target r
  assert.deepEqual(core.repRange({ r: 9, rMin: 8, rMax: 10 }), [8, 10]);
  for (const s of [{ r: 8 }, { rMin: 10, rMax: 8 }, { rMin: 8, rMax: 8 }, { rMin: 0, rMax: 5 }, { rMin: 8.5, rMax: 10 }]) assert.equal(core.repRange(s), null);
  assert.deepEqual(core.withRepRange({ type: 'normal', w: 80 }, [8, 10]), { type: 'normal', w: 80, r: 8, rMin: 8, rMax: 10 });
  assert.deepEqual(core.withRepRange({ w: 80, r: 12 }, [8, 10]), { w: 80, r: 10, rMin: 8, rMax: 10 });
  assert.deepEqual(core.withRepRange({ w: 80, r: 9, rMin: 8, rMax: 10 }, null), { w: 80, r: 9 });
  assert.equal(core.repsText({ r: 9, rMin: 8, rMax: 10 }), '8–10');
  assert.equal(core.repsText({ r: 9 }), 9);
  assert.deepEqual(core.entryRepRange(E('a', [S('warmup', 40, 10), S('normal', 80, 8, { rMin: 8, rMax: 10 }), S('normal', 80, 8, { rMin: 8, rMax: 10 })])), [8, 10]);
  assert.equal(core.entryRepRange(E('a', [S('normal', 80, 8, { rMin: 8, rMax: 10 }), S('normal', 80, 6, { rMin: 6, rMax: 8 })])), null);
  assert.equal(core.entryRepRange(E('a', [S('normal', 80, 8)])), null);

  // the routine editor: shown as "8–10", saved with the target kept; refused when broken
  const st = core.withDefaults({ unit: 'kg', distUnit: 'km' });
  const exercises = new Map(core.SEED_EXERCISES.map((e) => [e.id, e]));
  const BENCH = 'x-bench-press-barbell';
  const t = { id: 't', name: 'Push', exercises: [E(BENCH, [S('warmup', 40, 10), S('normal', 80, 9, { rMin: 8, rMax: 10 }), S('normal', 80, 5)])] };
  const draft = core.templateDraft({ template: t, settings: st });
  assert.deepEqual(draft.exercises[0].sets.map((x) => x.r), ['10', '8–10', '5']);
  const save = (d) => core.templateFromDraft(d, { settings: st, exercises, existing: t });
  assert.deepEqual(save(draft).template.exercises[0].sets, t.exercises[0].sets, 'untouched: the same bounds and target');
  const edit = (r) => { const d = JSON.parse(JSON.stringify(draft)); d.exercises[0].sets[1].r = r; return save(d); };
  assert.deepEqual(edit('10-12').template.exercises[0].sets[1], S('normal', 80, 10, { rMin: 10, rMax: 12 }), 'a new range keeps the target inside it');
  assert.deepEqual(edit('6–8').template.exercises[0].sets[1], S('normal', 80, 8, { rMin: 6, rMax: 8 }));
  assert.deepEqual(edit('9').template.exercises[0].sets[1], S('normal', 80, 9), 'a single number is an ordinary target');
  assert.deepEqual(edit('10–10').template.exercises[0].sets[1], S('normal', 80, 10));
  for (const bad of ['10–8', '8–', '0–4']) assert.deepEqual(edit(bad), { problem: core.EDIT_MESSAGES.repRange }, bad);
  // a new range on a set without one starts at its low bound
  const d2 = JSON.parse(JSON.stringify(draft)); d2.exercises[0].sets[2].r = '5-8';
  assert.deepEqual(save(d2).template.exercises[0].sets[2], S('normal', 80, 5, { rMin: 5, rMax: 8 }));

  // the running workout: the range sits beside the set; the ghost is last time's reps, else the target; the workout stores no range
  const a = core.newActiveWorkout({ template: t, settings: st, now: 1000 });
  const set = a.exercises[0].sets[1];
  assert.deepEqual(set.range, [8, 10]);
  assert.equal(set.tpl.r, 9);
  assert.equal(core.placeholders(a.exercises[0], [], st)[1].ph.r, '9');
  assert.equal(core.placeholders(a.exercises[0], [S('warmup', 40, 10), S('normal', 80, 7)], st)[1].ph.r, '7');
  core.addSet(a.exercises[0]);
  assert.equal(a.exercises[0].sets[3].range, undefined, 'a set after an unranged one has none');
  const b = core.newActiveWorkout({ template: { ...t, exercises: [E(BENCH, [S('normal', 80, 9, { rMin: 8, rMax: 10 })])] }, settings: st, now: 1000 });
  core.addSet(b.exercises[0]);
  assert.deepEqual(b.exercises[0].sets[1].range, [8, 10], 'Add set carries the range on');
  Object.assign(b.exercises[0].sets[0], { w: '80', r: '9', done: true });
  const entries = core.draftEntries(b, st, exercises, { onlyDone: true });
  assert.deepEqual(Object.keys(entries[0].sets[0]).sort(), ['id', 'r', 'type', 'w']);
});

test('rep ranges (#44): progression moves the target inside the bounds, never the bounds', () => {
  const cat = () => 'barbell';
  const R = (w, r, extra) => S('normal', w, r, { rMin: 8, rMax: 10, ...extra });
  const run = (tpl, sets, o) => core.progressTemplate([E('a', tpl)], { exercises: [E('a', sets)] }, cat, o);
  // 8 → 9 → 10, then 12 reps: the target stops at 10 and the bounds stay 8–10
  let tpl = [R(80, 8)];
  for (const [r, want, raised] of [[9, 9, 1], [10, 10, 1], [12, 10, 0], [11, 10, 0]]) {
    const out = run(tpl, [S('normal', 80, r)]);
    assert.deepEqual(out.exercises[0].sets, [R(80, want)], `${r} reps`);
    assert.equal(out.raised, raised, `${r} reps raised`);
    tpl = out.exercises[0].sets;
  }
  // more weight still counts (no automatic increase): 82.5 × 6 becomes 82.5 × 8, the low bound
  assert.deepEqual(run([R(80, 10)], [S('normal', 82.5, 6)]).exercises[0].sets, [R(82.5, 8)]);
  // fewer reps at the same weight: kept
  assert.deepEqual(run([R(80, 9)], [S('normal', 80, 6)]).exercises[0].sets, [R(80, 9)]);
  // mixed ranged and plain sets, warm-ups and a skipped last set keep their own
  const mixed = [S('warmup', 40, 10), R(80, 8), S('normal', 70, 12), R(80, 8)];
  assert.deepEqual(run(mixed, [S('warmup', 40, 10), S('normal', 80, 11), S('normal', 70, 14)]).exercises[0].sets,
    [S('warmup', 40, 10), R(80, 10), S('normal', 70, 14), R(80, 8)]);
  // sides pair per side and keep their range
  const sided = [R(20, 8, { side: 'left' }), R(20, 8, { side: 'right' })];
  assert.deepEqual(run(sided, [S('normal', 20, 9, { side: 'right' }), S('normal', 20, 12, { side: 'left' })]).exercises[0].sets,
    [R(20, 10, { side: 'left' }), R(20, 9, { side: 'right' })]);
  // the layout: paired sets keep their range, a new set takes the range of the set before it (same type and side), a drop set doesn't
  const lay = run([R(80, 8), R(80, 8)], [S('normal', 80, 9), S('normal', 80, 12), S('normal', 80, 9), S('drop', 60, 10)], { layout: true });
  assert.deepEqual(lay.exercises[0].sets, [R(80, 9), R(80, 10), R(80, 9), S('drop', 60, 10)]);
  // Update values only (applyWorkoutToTemplate) keeps the range too
  assert.deepEqual(core.applyWorkoutToTemplate([E('a', [R(80, 8)])], { exercises: [E('a', [S('normal', 80, 12)])] }, { valuesOnly: true })[0].sets, [R(80, 10)]);
  // the layout diff ignores ranges: same sets, same structure
  assert.equal(core.templateChanges({ exercises: [E('a', [R(80, 8)])] }, { exercises: [E('a', [S('normal', 80, 9)])] }).structure, false);
});

test('rep ranges (#44): Duplicate, shared links and backups keep bounds and target; old data still reads', () => {
  const exercises = new Map(core.SEED_EXERCISES.map((e) => [e.id, e]));
  const opts = { categories: core.CATEGORIES.map((c) => c.id), bodyParts: core.BODY_PARTS.map((b) => b.id) };
  const ranged = S('normal', 80, 9, { rMin: 8, rMax: 10 });
  const t = { id: 't', name: 'Push', exercises: [E('x-bench-press-barbell', [S('warmup', 40, 10), ranged, S('normal', 80, 9, { side: 'left', rMin: 8, rMax: 10 }), S('normal', 70, 12)]), E('x-plank', [{ type: 'normal', t: 60 }])] };
  assert.deepEqual(core.copyTemplateRecord(t).exercises[0].sets, t.exercises[0].sets);
  const link = (x) => `#template=${core.encodeTemplate(x, exercises)}`;
  assert.deepEqual(core.decodeTemplate(link(t), opts).exercises[0].sets, t.exercises[0].sets);
  // an old link (no range) reads as before; a range on a time-only exercise or a broken one is dropped
  const old = core.decodeTemplate(link({ ...t, exercises: [E('x-bench-press-barbell', [S('normal', 80, 9)])] }), opts);
  assert.deepEqual(old.exercises[0].sets, [S('normal', 80, 9)]);
  const forged = (row, c = 'barbell') => core.decodeTemplate(`#template=${Buffer.from(JSON.stringify({ v: 1, n: 'X', e: [{ n: 'Bench Press', c, b: 'chest', s: [row] }] })).toString('base64url')}`, opts).exercises[0].sets[0];
  assert.deepEqual(forged(['n', 80, 9, null, null, null, [10, 8]]), S('normal', 80, 9));
  assert.deepEqual(forged(['n', null, null, null, 60, null, [8, 10]], 'duration'), { type: 'normal', t: 60 });
  assert.deepEqual(forged(['n', 80, 14, null, null, null, [8, 10]]), S('normal', 80, 10, { rMin: 8, rMax: 10 }));
  // a broken range in stored data is cleaned away on Duplicate
  assert.deepEqual(core.copyTemplateRecord({ ...t, exercises: [E('x-bench-press-barbell', [S('normal', 80, 9, { rMin: 10, rMax: 8 })])] }).exercises[0].sets, [S('normal', 80, 9)]);
  const back = core.parseBackup(core.makeBackup({ exercises: [], workouts: [], templates: [t], measurements: [], kv: {} }, '1.0.0', new Date()), core.SEED_EXERCISES);
  assert.deepEqual(back.data.templates[0].exercises[0].sets, t.exercises[0].sets);
});

test('weight increase recommended (#49): every prescribed working set at the top of its range in one workout', () => {
  const cats = { a: 'barbell', b: 'assisted_bw', c: 'reps', d: 'dumbbell' };
  const cat = (id) => cats[id];
  const R = (w, extra) => S('normal', w, 8, { rMin: 8, rMax: 10, ...extra });
  const tpl = (sets, more = []) => ({ id: 't', exercises: [E('a', sets), ...more] });
  const wo = (sets, more = [], extra = {}) => ({ id: 'w', templateId: 't', startedAt: 5000, exercises: [E('a', sets), ...more], ...extra });
  const done = (w, r, extra) => S('normal', w, r, extra);
  const ready = (t, w) => core.routineReadiness(t, w, cat);
  const three = tpl([S('warmup', 40, 10), R(80), R(80), R(80)]);
  // 10/10/10 qualifies; 10/10/9 or a missing set doesn't
  assert.deepEqual(ready(three, wo([S('warmup', 40, 10), done(80, 10), done(80, 10), done(80, 10)])), ['weight']);
  assert.deepEqual(ready(three, wo([done(80, 10), done(80, 10), done(80, 9)])), [null]);
  assert.deepEqual(ready(three, wo([done(80, 10), done(80, 10)])), [null], 'a skipped set');
  assert.deepEqual(ready(three, wo([done(80, 12), done(80, 11), done(82.5, 10)])), ['weight'], 'more reps or weight is fine');
  assert.deepEqual(ready(three, wo([done(80, 10), done(80, 10), done(77.5, 10)])), [null], 'less weight');
  // warm-ups, drop sets and extra sets neither count nor prevent it
  assert.deepEqual(ready(three, wo([done(80, 10), done(80, 10), done(80, 10), S('drop', 60, 6), done(70, 5)])), ['weight']);
  assert.deepEqual(ready(three, wo([S('warmup', 40, 3), done(80, 10), done(80, 10), done(80, 10)])), ['weight']);
  // each set against its own weight and range
  const mixed = tpl([R(80), S('failure', 70, 12, { rMin: 12, rMax: 15 })]);
  assert.deepEqual(ready(mixed, wo([done(80, 10), S('failure', 70, 15)])), ['weight']);
  assert.deepEqual(ready(mixed, wo([done(80, 10), S('failure', 70, 14)])), [null]);
  // a set without a range: no mark until every working set has one
  assert.deepEqual(ready(tpl([R(80), S('normal', 80, 10)]), wo([done(80, 10), done(80, 10)])), [null]);
  // both sides must qualify; a missing right side never passes
  const sided = tpl([R(20, { side: 'left' }), R(20, { side: 'right' })]);
  assert.deepEqual(ready(sided, wo([done(20, 10, { side: 'right' }), done(20, 10, { side: 'left' })])), ['weight']);
  assert.deepEqual(ready(sided, wo([done(20, 10, { side: 'left' }), done(20, 12, { side: 'left' })])), [null]);
  assert.deepEqual(ready(sided, wo([done(20, 10), done(20, 10)])), [null], 'sets without sides don’t stand in for them');
  // repeated entries pair by occurrence; assisted means less assistance; reps only gets no prompt
  const multi = { id: 't', exercises: [E('a', [R(80)]), E('b', [R(30)]), E('a', [R(60)]), E('c', [S('normal', null, 8, { rMin: 8, rMax: 12 })])] };
  const multiDone = (aw2, bw) => ({ id: 'w', templateId: 't', startedAt: 5000,
    exercises: [E('a', [done(80, 10)]), E('b', [done(bw, 10)]), E('a', [done(aw2, 10)]), E('c', [S('normal', null, 12)])] });
  assert.deepEqual(ready(multi, multiDone(60, 25)), ['weight', 'assistance', 'weight', null]);
  assert.deepEqual(ready(multi, multiDone(57.5, 35)), ['weight', null, null, null]);
  // only a workout from this routine, after the prescription last changed
  assert.deepEqual(ready(three, { ...wo([done(80, 10), done(80, 10), done(80, 10)]), templateId: null }), [null]);
  assert.deepEqual(ready({ ...three, prescribedAt: 6000 }, wo([done(80, 10), done(80, 10), done(80, 10)])), [null]);
  assert.deepEqual(ready({ ...three, prescribedAt: 4000 }, wo([done(80, 10), done(80, 10), done(80, 10)])), ['weight']);
  assert.deepEqual(ready(three, null), [null]);
  // more weight next time: progression raises the routine, and the old workout no longer qualifies
  const after = core.progressTemplate(three.exercises, wo([done(82.5, 8), done(82.5, 8), done(82.5, 8)]), cat).exercises;
  assert.deepEqual(ready({ ...three, exercises: after }, wo([done(82.5, 8), done(82.5, 8), done(82.5, 8)])), [null]);
});

test('weight increase recommended (#49): the editor stamps a changed prescription, not a rename or a moved target', () => {
  const st = core.withDefaults({ unit: 'kg', distUnit: 'km' });
  const exercises = new Map(core.SEED_EXERCISES.map((e) => [e.id, e]));
  const t = { id: 't', name: 'Push', exercises: [E('x-bench-press-barbell', [S('normal', 80, 9, { rMin: 8, rMax: 10 }), S('normal', 70, 12)])] };
  const save = (edit) => { const d = core.templateDraft({ template: t, settings: st }); edit(d); return core.templateFromDraft(d, { settings: st, exercises, existing: t, now: 9000 }).template; };
  assert.equal(save((d) => { d.name = 'Push A'; }).prescribedAt, undefined);
  assert.equal(save((d) => { d.exercises[0].sets[0].w = '82.5'; }).prescribedAt, 9000);
  assert.equal(save((d) => { d.exercises[0].sets[0].r = '8-12'; }).prescribedAt, 9000);
  assert.equal(save((d) => { d.exercises[0].sets[1].r = '10'; }).prescribedAt, 9000);
  assert.equal(save((d) => { d.exercises[0].sets.pop(); }).prescribedAt, 9000);
  assert.equal(core.prescriptionKey(t.exercises), core.prescriptionKey([E('x-bench-press-barbell', [S('normal', 80, 10, { rMin: 8, rMax: 10 }), S('normal', 70, 12)])]), 'a moved target is no change');
});
