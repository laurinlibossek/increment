// The tally: one stroke per set (docs/design/components.md, Tally). A pending
// set is a hairline, a logged set a solid stem, a record a signal stem. Every
// stroke keeps the same slot, so logging a set never moves anything.
import { View } from 'react-native';

import { SPACE, STROKE } from '@/design/tally';
import { useTally } from '@/lib/theme';

export type StrokeState = 'pending' | 'done' | 'warmup' | 'warmupPending' | 'live' | 'record' | 'skipped';
export type TallySize = 'small' | 'regular' | 'hero';
const HEIGHT: Record<TallySize, number> = { small: 14, regular: STROKE.h, hero: STROKE.hHero };
const SMALL = { slot: STROKE.slot, hair: STROKE.hair, gap: STROKE.gap, group: STROKE.group };
/** Widths per size: hero strokes are wider as well as taller. */
export const STROKE_DIMS: Record<TallySize, { h: number; slot: number; hair: number; gap: number; group: number }> = {
  small: { h: 14, ...SMALL },
  regular: { h: STROKE.h, ...SMALL },
  hero: { h: STROKE.hHero, slot: STROKE.slotHero, hair: STROKE.hairHero, gap: STROKE.gapHero, group: STROKE.groupHero },
};

export function Stroke({ state, size = 'regular' }: { state: StrokeState; size?: TallySize }) {
  const { colors: t } = useTally();
  const { slot, hair } = STROKE_DIMS[size];
  const h = HEIGHT[size] * (state === 'warmup' || state === 'warmupPending' ? 0.55 : 1);
  let mark;
  if (state === 'done' || state === 'warmup') mark = <View style={{ width: slot, height: h, backgroundColor: t.strokeDone }} />;
  else if (state === 'record') {
    mark = <View style={{ width: slot, height: h, backgroundColor: t.signal, borderWidth: t.signalEdge === t.signal ? 0 : 1, borderColor: t.signalEdge }} />;
  } else if (state === 'live') mark = <View style={{ width: slot, height: h, borderWidth: Math.max(1.5, hair), borderColor: t.ink }} />;
  else mark = <View style={{ width: hair, height: h, backgroundColor: t.ink3, opacity: state === 'skipped' ? 0.45 : 1 }} />;
  return <View style={{ width: slot, height: h, alignItems: 'center' }}>{mark}</View>;
}

/**
 * Strokes in groups: one group per exercise, or fives when counting. With `wrap`
 * a group longer than the line goes on in the next one instead of running off
 * the screen (a session header with 40 sets of one exercise).
 */
export function Tally({ groups, size = 'regular', label, wrap }: { groups: StrokeState[][]; size?: TallySize; label: string; wrap?: boolean }) {
  const d = STROKE_DIMS[size];
  const flow = wrap ? { flexWrap: 'wrap' as const, flexShrink: 1, maxWidth: '100%' as const, rowGap: SPACE.s2 } : null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}
      style={[{ flexDirection: 'row', alignItems: 'flex-end', columnGap: d.group }, wrap ? flow : { height: d.h }]}>
      {groups.map((g, i) => (
        <View key={i} style={[{ flexDirection: 'row', alignItems: 'flex-end', columnGap: d.gap }, flow]}>
          {g.map((s, j) => <Stroke key={j} state={s} size={size} />)}
        </View>
      ))}
    </View>
  );
}

/** Groups of five for counting `done` logged and `pending` still to go. */
export function fives(done: number, pending = 0): StrokeState[][] {
  const all: StrokeState[] = [...Array(done).fill('done'), ...Array(pending).fill('pending')];
  const out: StrokeState[][] = [];
  for (let i = 0; i < all.length; i += 5) out.push(all.slice(i, i + 5));
  return out;
}
