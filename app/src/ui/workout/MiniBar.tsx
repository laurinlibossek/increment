// The running workout, minimized: the Now Lifting accessory above the tab bar
// (docs/design/components.md → NowLifting). On iOS 26 and later it lives in
// the system's bottom accessory (src/app/(tabs)/_layout.tsx); elsewhere the
// app draws it: above the tab bar on the web, floating at the bottom of each
// tab on Android and older iPhones (NowLiftingDock). Tap to open the session.
import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { isUnilateral, sessionProgress, sessionState, setSlots, sideOf } from '@increment/core';

import { activeRecords, skipRest, useAppSelector, useAppState } from '@/data/store';
import type { ActiveWorkout, EntryDraft, Exercise, SetDraft } from '@/data/types';
import { useFormat } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { openWorkout } from '@/lib/workout';
import { CONTROL, SPACE } from '@/design/tally';
import { NowLifting } from '@/ui/tally/NowLifting';
import { setStroke, type StrokeState } from '@/ui/tally/Tally';

/** The system draws the accessory (iOS 26+); everywhere else the app does. */
export const SYSTEM_ACCESSORY = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;
/** Room to leave at the bottom of a tab's content for the dock. */
export const DOCK_SPACE = CONTROL.accessoryH + SPACE.s4;

/**
 * The session as strokes (one group per exercise), the set being logged and
 * the counts: what the accessory and Today's card show. The set being logged
 * is the session's own next set (sessionState: the exercise jumped to, supersets
 * round by round); warm-ups are drawn but not counted (#38), and a unilateral
 * set counts once both sides are logged (sessionProgress, #72).
 */
export function sessionView(a: ActiveWorkout, records: Map<string, unknown>, exercises: Map<string, Exercise>, pair: boolean) {
  type Next = { next: { entry: EntryDraft; set: SetDraft } | null };
  // a finished exercise stays on the workout's screen (#60); Now Lifting already names the set that comes next in order
  const next = (sessionState(a, { current: a.current ?? null }) as Next).next || (sessionState(a) as Next).next;
  let recordCount = 0;
  const all: StrokeState[][] = a.exercises.map((e) => e.sets.map((s) => {
    if (s.done && records.has(s.id)) recordCount++;
    return setStroke(s, next?.set.id, records);
  }));
  const { done, total, percent } = sessionProgress(a.exercises, exercises, { pair });
  const cur = next ? { entry: a.exercises.indexOf(next.entry), set: next.entry.sets.indexOf(next.set) } : null;
  // the exercise being logged (or the last one once every set is done), for the accessory
  let last = a.exercises.length - 1;
  while (last > 0 && !all[last].length) last--;
  const exercise = all[cur ? cur.entry : last] || [];
  return { groups: all.filter((g) => g.length), exercise, current: cur, done, total, percent, records: recordCount };
}

export function useSessionView() {
  const s = useAppState();
  return useMemo(() => (s.active ? sessionView(s.active, activeRecords(s), s.exercises, s.settings.pairSides !== false) : null),
    [s.active, s.exercises, s.settings, s.workouts]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function MiniBar({ placement = 'regular', surface = 'raised' }: { placement?: 'regular' | 'inline'; surface?: 'none' | 'raised' }) {
  const a = useAppSelector((s) => s.active);
  const exercises = useAppSelector((s) => s.exercises);
  const pair = useAppSelector((s) => s.settings.pairSides !== false);
  const view = useSessionView();
  const now = useNow(1000, !!a);
  const f = useFormat();
  const { tr, clock } = f;
  if (!a || !view) return null;
  const elapsed = clock(Math.max(0, Math.floor((now - a.startedAt) / 1000)));
  const rest = a.rest ? clock(Math.max(0, Math.ceil((a.rest.end - now) / 1000))) : null;
  const cur = view.current;
  const entry = cur ? a.exercises[cur.entry] : null;
  const title = entry ? `${f.exName(exercises.get(entry.exerciseId)) || tr('Exercise')} · ${setText(entry, cur!.set)}` : a.name;
  // the set's number counts a left and a right as one set (#72): "set 2 of 3"; its side leads the
  // second line, since a long exercise name cuts the first one short: "Right · Legs · 25:01"
  function setText(e: EntryDraft, index: number) {
    const set = e.sets[index];
    if (set.type === 'warmup') return tr('warm-up set');
    const slots = setSlots(e.sets, isUnilateral(exercises.get(e.exerciseId)), { pair }) as SetDraft[][];
    return tr('set {n} of {total}', { n: slots.findIndex((slot) => slot.includes(set)) + 1, total: slots.length });
  }
  const side = entry && entry.sets[cur!.set].type !== 'warmup' ? sideOf(entry.sets[cur!.set]) : undefined;
  const sideWord = side ? tr(side === 'left' ? 'Left' : 'Right') : '';
  const subtitle = rest ? tr('Rest {time}', { time: rest }) : entry ? [sideWord, a.name, elapsed].filter(Boolean).join(' · ') : elapsed;
  return (
    <NowLifting placement={placement} surface={surface} testID="mini-bar"
      tally={[view.exercise]} tallyLabel={f.progressText(view).label}
      title={title} subtitle={subtitle} short={rest || elapsed}
      onOpen={openWorkout} openLabel={tr('Open current workout')}
      skip={rest ? { label: tr('Skip rest'), onPress: skipRest } : undefined} />
  );
}

/** Where the system has no accessory: the bar floats at the bottom of a tab's content. */
export function NowLiftingDock() {
  const running = useAppSelector((s) => !!s.active);
  if (SYSTEM_ACCESSORY || Platform.OS === 'web' || !running) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: SPACE.s4, right: SPACE.s4, bottom: SPACE.s2 }}>
      <MiniBar />
    </View>
  );
}
