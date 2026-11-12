// One exercise of a draft: the running workout ('active'), a template in the
// editor ('template') or a finished workout being edited ('edit'). Name, last
// time's sets, focus metric, superset and rest, pinned note, its note, the
// set rows and "Add set". Only this exercise re-renders when one of its sets
// changes (see editDraft in the store). Logging, the keypad and live records
// belong to the running workout only (Session.tsx).
import { memo, useMemo } from 'react';
import {
  Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  placeholders, restFor, addSet, joinSuperset, leaveSuperset, removeEntry, restoreEntry, replaceExercise, addWarmups, rateSet, setRir, setSetType,
  loggedFields, usesWeight, usesDistance, numToInput, parseNum, focusOptions, focusValues, uncheckSet, parseRepsInput, readinessKind,
  REST_CHOICES, RPE_CHOICES, RIR_CHOICES, SET_TYPES, FOCUS_LABEL, BODY_PART_LABEL,
} from '@increment/core';

import {
  changeExercise, editDraft, getDraft, getState,
} from '@/data/store';
import type {
  DraftKey, EntryDraft, Exercise, SetDraft, Settings, SetType, WorkSet,
} from '@/data/types';
import { SPACE, TYPE, CONTROL } from '@/design/tally';
import { setLabels, useFormat } from '@/lib/format';
import { pickExercises } from '@/lib/picker';
import { useTally } from '@/lib/theme';
import { Icon } from '@/ui/kit';
import { actionSheet, prompt, toast } from '@/ui/overlay';
import { SetRow, Times, type Chip } from '@/ui/tally/SetRow';
import type { StrokeState } from '@/ui/tally/Tally';
import { CAPTION_H, SetField, type Field } from './SetRow';
import { useSession } from './Session';
import { effortText, lastTimeText, setValueText } from './text';
import { readyText, type Readiness } from '@/lib/workout';
import { Highlight } from '@/ui/tally/Highlight';

export type EditorMode = 'active' | 'edit' | 'template';

type Props = {
  draftKey: DraftKey;
  mode: EditorMode;
  entry: EntryDraft;
  ex: Exercise | undefined;
  prevSets: WorkSet[] | null;
  /** running workout: the ids of this entry's record sets, space-separated (a string, so blocks whose records didn't change don't render again) */
  recordSets: string;
  settings: Settings;
  superset?: { index: number; letter: string };
  /** running workout: the id of the set being logged */
  live?: string | null;
  /** running workout: "Weight increase recommended" (or less assistance) from the routine's latest workout (#49) */
  ready?: Readiness;
};

const SET_TYPE_NAME: Record<SetType, string> = { normal: 'Normal', warmup: 'Warm-up', drop: 'Drop set', failure: 'Failure' };
const SET_TYPE_CHIP: Record<SetType, string> = { normal: '', warmup: 'Warm-up', drop: 'Drop', failure: 'Failure' };

type FocusKey = keyof typeof FOCUS_LABEL;

export const ExerciseBlock = memo(function ExerciseBlock({
  draftKey, mode, entry, ex, prevSets, recordSets, settings, superset, live = null, ready = null,
}: Props) {
  const f = useFormat();
  const { tr } = f;
  const { colors: t } = useTally();
  const session = useSession();
  const rows = useMemo(() => placeholders(entry, prevSets, settings) as { prev: WorkSet | null; ph: Record<string, string> }[], [entry, prevSets, settings]);
  if (!ex) return null;
  const cat = ex.category;
  const fields = loggedFields(cat) as Field[];
  const rest = restFor(entry, ex, settings.defaultRest) as number;
  const labels = setLabels(entry.sets);
  const active = mode === 'active';
  const edit = (fn: (e: EntryDraft) => void) => editDraft(draftKey, (_a, e) => fn(e), entry.id);
  const records = recordSets ? recordSets.split(' ') : [];
  const name = f.exName(ex);

  // ---------- sets ----------
  const toggle = (i: number) => {
    const set = entry.sets[i];
    if (set.done) { edit((e) => { uncheckSet(e.sets[i]); }); return; }
    session?.logSet(entry.id, set.id);
  };
  const removeSet = (i: number) => {
    const set = entry.sets[i];
    edit((e) => { e.sets.splice(i, 1); });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    toast(tr('Set deleted'), { label: tr('Undo'), fn: () => edit((e) => { e.sets.splice(Math.min(i, e.sets.length), 0, set); }) });
  };
  const setMenu = async (i: number) => {
    const set = entry.sets[i];
    // effort: reps left in reserve on a logged set; a template keeps its RPE target
    const rir = setRir(set) as number | null;
    const effort = mode === 'template'
      ? (usesWeight(cat) || cat === 'reps' ? { label: set.rpe ? `RPE (${set.rpe})` : tr('Add RPE'), value: 'rpe', testID: 'set-rpe' } : null)
      : { label: rir === null ? tr('Reps left') : `${tr('Reps left')} · ${effortText(rir, tr)}`, value: 'rir', testID: 'set-rir' };
    const choice = await actionSheet<string>({
      title: tr('Set {label}', { label: labels[i] }),
      actions: [
        ...(SET_TYPES as SetType[]).map((x) => ({ label: tr(SET_TYPE_NAME[x]), value: x, checked: set.type === x, testID: `type-${x}` })),
        effort,
        !usesDistance(cat) ? { label: set.side ? `${tr('Side')} · ${set.side === 'left' ? tr('Left') : tr('Right')}` : tr('Side'), value: 'side', testID: 'set-side' } : null,
        { label: tr('Delete set'), value: 'delete', destructive: true, testID: 'set-delete' },
      ],
    });
    if (!choice) return;
    if (choice === 'delete') { removeSet(i); return; }
    if (choice === 'side') {
      const side = await actionSheet<'left' | 'right' | 'clear'>({
        title: tr('Which side?'),
        actions: [
          { label: tr('Left'), value: 'left', checked: set.side === 'left', testID: 'side-left' },
          { label: tr('Right'), value: 'right', checked: set.side === 'right', testID: 'side-right' },
          set.side ? { label: tr('Clear'), value: 'clear', destructive: true, testID: 'side-clear' } : null,
        ],
      });
      if (side) edit((e) => {
        if (side === 'clear') delete e.sets[i].side;
        else e.sets[i].side = side;
      });
      return;
    }
    if (choice === 'rir') {
      const v = await actionSheet<string>({
        title: tr('Reps left?'), message: tr('How many more reps you could have done.'),
        actions: [
          ...(RIR_CHOICES as number[]).map((n) => ({ label: effortText(n, tr), value: String(n), checked: rir === n, testID: `rir-${n}` })),
          rir !== null ? { label: tr('Clear'), value: 'clear', destructive: true, testID: 'rir-clear' } : null,
        ],
      });
      if (!v) return;
      edit((e) => { rateSet(e.sets[i], v === 'clear' ? null : Number(v)); });
      return;
    }
    if (choice === 'rpe') {
      const v = await actionSheet<string>({
        title: tr('Rate of perceived exertion'), message: tr('10 = nothing left, 8 = two reps left'),
        actions: [
          ...(RPE_CHOICES as number[]).map((n) => ({ label: f.num(n, 1), value: String(n), checked: parseNum(set.rpe) === n, testID: `rpe-${n}` })),
          set.rpe ? { label: tr('Clear RPE'), value: 'clear', destructive: true } : null,
        ],
      });
      if (!v) return;
      edit((e) => { e.sets[i].rpe = v === 'clear' ? '' : numToInput(Number(v), 1); });
      return;
    }
    // a template's Failure is a target; elsewhere a failure set has 0 reps left
    if (mode === 'template') edit((e) => { e.sets[i].type = choice as SetType; });
    else edit((e) => { setSetType(e.sets[i], choice as SetType); });
  };

  // ---------- the exercise ----------
  const menu = async () => {
    const a = getDraft(draftKey);
    if (!a) return;
    const others = a.exercises.filter((e) => e.id !== entry.id);
    const choice = await actionSheet<string>({
      title: name,
      actions: [
        { label: entry.showNotes ? tr('Remove note') : tr('Add note'), value: 'note', icon: 'note' },
        { label: ex.pinnedNote ? tr('Edit pinned note') : tr('Pin a note to this exercise'), value: 'pin', icon: 'pin' },
        { label: tr('Replace exercise'), value: 'replace', icon: 'swap' },
        others.length ? { label: entry.supersetId ? tr('Change superset') : tr('Superset with…'), value: 'superset', icon: 'link', testID: 'menu-superset' } : null,
        entry.supersetId ? { label: tr('Remove from superset'), value: 'unsuperset', icon: 'unlink' } : null,
        { label: tr('Rest timer: {time}', { time: rest ? f.clock(rest) : tr('off') }), value: 'rest', icon: 'timer', testID: 'menu-rest' },
        usesWeight(cat) && cat !== 'assisted_bw' ? { label: tr('Add warm-up sets'), value: 'warmup', icon: 'flame', testID: 'menu-warmup' } : null,
        cat === 'barbell' ? { label: tr('Plate calculator'), value: 'plates', icon: 'plate', testID: 'menu-plates' } : null,
        a.exercises.length > 1 ? { label: tr('Reorder exercises'), value: 'reorder', icon: 'reorder', testID: 'menu-reorder' } : null,
        { label: tr('History & records'), value: 'info', icon: 'history' },
        { label: tr('Remove exercise'), value: 'remove', destructive: true, icon: 'trash', testID: 'menu-remove' },
      ],
    });
    if (!choice) return;
    if (choice === 'note') edit((e) => { e.showNotes = !e.showNotes; if (!e.showNotes) e.notes = ''; });
    if (choice === 'pin') {
      const v = await prompt({
        title: tr('Pinned note'), message: tr('Shown every time you do this exercise.'), value: ex.pinnedNote || '', placeholder: tr('Seat height 4, grip on the rings…'), multiline: true,
      });
      if (v !== null) changeExercise(draftKey, ex.id, { pinnedNote: v.trim() });
    }
    if (choice === 'replace') {
      const ids = await pickExercises({ multi: false, title: tr('Replace exercise'), currentExerciseId: ex.id });
      const nex = ids && getState().exercises.get(ids[0]);
      if (nex) edit((e) => replaceExercise(e, ex, nex));
    }
    if (choice === 'superset') {
      const target = await actionSheet<string>({
        title: tr('Superset with'),
        actions: others.map((o) => ({ label: f.exName(getState().exercises.get(o.exerciseId)) || tr('Exercise'), value: o.id, testID: `ss-${o.exerciseId}` })),
      });
      if (!target) return;
      // only this exercise moves: it joins the other one's group (or they start a new one)
      editDraft(draftKey, (d) => joinSuperset(d.exercises, d.exercises.find((e) => e.id === entry.id), d.exercises.find((e) => e.id === target)));
    }
    if (choice === 'unsuperset') editDraft(draftKey, (d) => leaveSuperset(d.exercises, d.exercises.find((e) => e.id === entry.id)));
    if (choice === 'rest') {
      const v = await actionSheet<string>({
        title: `${tr('Rest timer')} · ${name}`, message: tr('Starts when you check off a set. Saved for this exercise.'),
        actions: (REST_CHOICES as number[]).map((sec) => ({ label: sec ? f.clock(sec) : tr('Off'), value: String(sec), checked: rest === sec, testID: `rest-${sec}` })),
      });
      if (v === undefined) return;
      edit((e) => { e.restSec = Number(v); });
      changeExercise(draftKey, ex.id, { restSec: Number(v) });
    }
    if (choice === 'warmup') {
      let r: { added?: number; problem?: string } = {};
      edit((e) => { r = addWarmups(e, rows, cat, settings); });
      toast(r.problem ? tr(r.problem) : tr('{n} warm-up sets added', { n: r.added ?? 0 }));
    }
    if (choice === 'plates') {
      const k = entry.sets.findIndex((x) => x.type !== 'warmup');
      const w = k >= 0 ? (parseNum(entry.sets[k].w) ?? parseNum(rows[k]?.ph.w)) : null;
      router.push({ pathname: '/tools', params: w ? { w: String(w) } : {} });
    }
    if (choice === 'reorder') router.push({ pathname: '/reorder', params: { draft: draftKey } });
    if (choice === 'info') {
      if (active) {
        // the exercise page opens behind the workout, which minimizes first
        router.back();
        setTimeout(() => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } }), Platform.OS === 'web' ? 50 : 450);
      } else {
        router.push({ pathname: '/exercise/[id]', params: { id: ex.id } });
      }
    }
    if (choice === 'remove') {
      // a superset left with one exercise dissolves; Undo puts both back (#39)
      let removed: unknown = null;
      editDraft(draftKey, (d) => { removed = removeEntry(d.exercises, entry.id); });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast(tr('{name} removed', { name }), { label: tr('Undo'), fn: () => editDraft(draftKey, (d) => { restoreEntry(d.exercises, removed); }) });
    }
  };

  // ---------- focus metric ----------
  // The number to push for this exercise (Strong's "focus metric"), from the
  // sets as they stand (typed, else the ghost values), against last time.
  const focusOpts = focusOptions(cat) as FocusKey[];
  const focus = focusOpts.includes(entry.focus as FocusKey) ? (entry.focus as FocusKey) : null;
  const focusVals = focusOpts.length ? focusValues(entry, rows, cat, prevSets, settings) as Record<FocusKey, number | null> : null;
  const fmtFocus = (k: FocusKey) => {
    const x = focusVals?.[k];
    if (x === null || x === undefined) return '—';
    if (k === 'volume') return f.volume(x);
    if (k === 'reps') return f.plural(x, 'rep');
    if (k === 'weightPerRep') return `${f.w(x, 1)} ${f.unit}`;
    const pct = Math.round(x * 100);
    return `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${Math.abs(pct)}%`;
  };
  const pickFocus = async () => {
    const v = await actionSheet<FocusKey>({
      title: tr('Set a focus metric'),
      message: tr('The number you want to push for this exercise. It shows next to the name and updates as you log; increases compare with last time. Tap it again to turn it off.'),
      actions: focusOpts.map((k) => ({ label: `${tr(FOCUS_LABEL[k])} · ${fmtFocus(k)}`, value: k, checked: focus === k, testID: `focus-${k}` })),
    });
    if (!v) return;
    edit((e) => { e.focus = v === focus ? null : v; });
  };

  const fieldNames: Record<Field, string> = { w: tr('Weight'), r: tr('Reps'), d: tr('Distance'), t: tr('Time') };
  const last = lastTimeText(prevSets, cat, f, tr);
  const part = BODY_PART_LABEL[ex.bodyPart as keyof typeof BODY_PART_LABEL];
  const facts = [active ? f.exEquipment(ex) : '', part ? tr(part) : '', last ? tr('last time {sets}', { sets: last }) : ''].filter(Boolean).join(' · ');
  const target = session?.target;
  // the routine editor: "Weight increase recommended" needs a range on every working set (#49)
  const kind = mode === 'template' ? readinessKind(cat) as Readiness : null;
  const working = kind ? entry.sets.filter((x) => x.type === 'normal' || x.type === 'failure') : [];
  const ranged = working.filter((x) => parseRepsInput(x.r)?.range).length;
  const rangeHint = ranged > 0 && ranged < working.length
    ? tr(kind === 'assistance' ? 'Less assistance is recommended once every working set has a rep range' : 'Weight increases are recommended once every working set has a rep range')
    : '';

  const row = (set: SetDraft, i: number) => {
    const ph = rows[i]?.ph || {};
    const record = active && set.done && records.includes(set.id);
    const warm = set.type === 'warmup';
    const isLive = active && set.id === live;
    const state: StrokeState = set.done ? (record ? 'record' : warm ? 'warmup' : 'done') : isLive ? 'live' : warm ? 'warmupPending' : 'pending';
    const chips: Chip[] = [];
    const side = set.side ? set.side === 'left' ? tr('Left side') : tr('Right side') : '';
    if (side) chips.push({ text: side });
    if (set.type !== 'normal') chips.push({ text: tr(SET_TYPE_CHIP[set.type]) });
    // the routine's rep range, apart from the ghost (last time's reps) (#44)
    if (set.range && mode !== 'template') chips.push({ text: tr('{range} reps', { range: `${set.range[0]}–${set.range[1]}` }) });
    const rir = setRir(set) as number | null;
    // a failure set's chip already says 0 left
    if (mode === 'template') { if (set.rpe) chips.push({ text: `RPE ${set.rpe}` }); } else if (rir !== null && set.type !== 'failure' && (set.done || !active)) chips.push({ text: effortText(rir, tr) });
    if (record) chips.push({ text: tr('Record'), record: true });
    const shown = Object.fromEntries(fields.map((k) => [k, set[k] || ph[k] || ''])) as Record<Field, string>;
    const setName = tr('Set {label}', { label: labels[i] });
    const value = setValueText(shown, cat, f, tr);
    const rowLabel = [setName, side ? side.toLocaleLowerCase(f.lang) : '', value, set.done ? tr('logged') : tr('not logged')].filter(Boolean).join(', ');
    // field boxes (with their captions) on the set being logged, the set the keypad types into, and every set in an editor
    const boxed = !active || isLive || (!!target && target.setId === set.id);
    const inputs = fields.map((k) => (
      <SetField key={k} field={k} value={set[k]} ghost={ph[k] || ''} single={fields.length === 1} range={mode === 'template' && k === 'r'}
        boxed={boxed} caption={fieldNames[k]} editing={!!target && target.setId === set.id && target.field === k}
        label={`${fieldNames[k]}, ${setName}`} testID={`in-${k}-${set.id}`}
        onChange={(v) => edit((e) => { e.sets[i][k] = v; })}
        onKeypad={session ? () => session.open({ entryId: entry.id, setId: set.id, field: k }) : undefined}
        register={session ? (r) => session.register(`${set.id}:${k}`, r) : undefined} />
    ));
    return (
      <SetRow key={set.id} testID={`set-${set.id}`} label={rowLabel} first={i === 0} chips={chips}
        stroke={active ? {
          state, checked: set.done, testID: `check-${set.id}`, onPress: () => toggle(i),
          label: rowLabel,
        } : undefined}
        lead={active ? undefined : { text: labels[i], label: tr('Set {label}, change type', { label: labels[i] }), onPress: () => setMenu(i) }}
        meta={{
          label: tr('Set {label}, change type', { label: labels[i] }), testID: `label-${set.id}`, onPress: () => setMenu(i),
          more: { label: tr('Options for {name}', { name: setName }), testID: `set-menu-${set.id}` },
        }}
        deleteLabel={tr('Delete')} onDelete={() => removeSet(i)}
        shake={session?.shake && session.shake.id === set.id ? session.shake.n : 0}>
        <Times lower={boxed ? CAPTION_H : 0}>{inputs.length === 2 ? [inputs[0], inputs[1]] : inputs[0]}</Times>
      </SetRow>
    );
  };

  return (
    <View accessibilityLabel={name} testID={`block-${ex.id}`} style={styles.block}>
      <View style={styles.head}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
          <Pressable onPress={menu} style={{ flex: 1, minWidth: 0, paddingVertical: 2 }} accessibilityRole="button" testID={`ex-title-${ex.id}`}>
            <Text style={{ ...TYPE.title3, color: t.ink }} testID={`exercise-header-${ex.id}`}>{active ? f.exBase(ex) : name}</Text>
          </Pressable>
          {focusOpts.length > 0 && (
            <Pressable onPress={pickFocus} hitSlop={6} accessibilityRole="button" testID={`focus-${ex.id}`}
              accessibilityLabel={focus ? `${tr(FOCUS_LABEL[focus])}: ${fmtFocus(focus)}` : tr('Focus metric for {name}', { name })}
              style={({ pressed }) => [styles.focus, { backgroundColor: focus || pressed ? t.paper3 : 'transparent' }]}>
              <Icon name="trend" size={15} color={focus ? t.ink : t.ink3} />
              {focus && <Text style={{ color: t.ink, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }} numberOfLines={1}>{fmtFocus(focus)}</Text>}
            </Pressable>
          )}
          <Pressable onPress={menu} hitSlop={4} accessibilityRole="button" accessibilityLabel={tr('Options for {name}', { name })} testID={`ex-menu-${ex.id}`}
            style={({ pressed }) => [styles.more, { backgroundColor: pressed ? t.paper3 : 'transparent' }]}>
            <Icon name="more" size={20} color={t.ink} />
          </Pressable>
        </View>
        {!!facts && <Text style={{ ...TYPE.footnote, color: t.ink2 }} testID={`last-${ex.id}`}>{facts}</Text>}
        {!!ready && active && <View style={{ marginTop: SPACE.s1 }}><Highlight chip testID={`ready-${ex.id}`}>{readyText(ready, tr)}</Highlight></View>}
        {!!rangeHint && <Text style={{ ...TYPE.footnote, color: t.ink2 }} testID={`range-hint-${ex.id}`}>{rangeHint}</Text>}
        {(superset || (active && rest > 0)) && (
          <Text style={{ ...TYPE.footnote, color: t.ink2 }}>
            {superset ? <Text>{tr('Superset {letter}', { letter: superset.letter })}</Text> : null}
            {superset && active && rest > 0 ? ' · ' : ''}
            {active && rest > 0 ? <Text testID={`rest-tag-${ex.id}`} style={{ fontVariant: ['tabular-nums'] }}>{tr('Rest {time}', { time: f.clock(rest) })}</Text> : null}
          </Text>
        )}
        {!!ex.pinnedNote && (
          <View style={styles.pinned}>
            <Icon name="pin" size={14} color={t.ink2} />
            <Text style={{ ...TYPE.subhead, color: t.ink, flex: 1 }}>{ex.pinnedNote}</Text>
          </View>
        )}
        {entry.showNotes && (
          <TextInput value={entry.notes} onChangeText={(v) => edit((e) => { e.notes = v; })} onFocus={session?.close} multiline placeholder={tr('Note for this exercise')} placeholderTextColor={t.ink3}
            style={[styles.note, { color: t.ink, backgroundColor: t.paper3 }]} testID={`ex-note-${ex.id}`} />
        )}
      </View>
      <View style={{ marginTop: SPACE.s2 }}>{entry.sets.map(row)}</View>
      <Pressable onPress={() => edit((e) => addSet(e))} accessibilityRole="button" testID={`add-set-${ex.id}`}
        style={({ pressed }) => [styles.addSet, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon name="plus" size={17} color={t.ink2} />
        <Text style={{ ...TYPE.body, color: t.ink2 }}>{tr('Add set')}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  block: { marginTop: SPACE.s6 },
  head: { paddingHorizontal: SPACE.s5, gap: 2 },
  more: { width: CONTROL.hitMin, height: CONTROL.hitMin, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  focus: { height: 30, minWidth: 30, maxWidth: 140, borderRadius: 15, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  pinned: { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s2, alignItems: 'flex-start' },
  note: { marginTop: SPACE.s2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 44 },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, alignSelf: 'flex-start', minHeight: CONTROL.hitMin, paddingHorizontal: SPACE.s5 },
});
