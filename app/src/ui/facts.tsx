// Small Tally pieces for the summary, the workout page, the exercise page and
// Sets per muscle (docs/design/phases.md, phase 4) that ui/tally/ has no
// component for: the screen margin, tabular figures, a workout's length, an
// exercise's header link and a finished workout's tally. The stat strip,
// highlight, section header and list row are the shared ones in ui/tally/ (#100).
import { useContext } from 'react';
import {
  Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { pad2 } from '@increment/core';

import { CONTROL, SPACE, TYPE } from '@/design/tally';
import type { Workout } from '@/data/types';
import { useTally } from '@/lib/theme';
import { OnCard } from '@/ui/tally/ground';
import { STROKE_DIMS, Tally, type StrokeState } from '@/ui/tally/Tally';

/** The screen margin every left edge lines up on. */
export const MARGIN = SPACE.s5;

/** Tabular figures, for every number that changes or is compared. */
export const tnum: TextStyle = { fontVariant: ['tabular-nums'] };

/** Workout length as h:mm ("1:04"). */
export function hm(ms: number) {
  const min = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(min / 60)}:${pad2(min % 60)}`;
}

/**
 * An exercise's name as a section header that opens its page, with an optional
 * count on the trailing side, lined up with the counts of its rows (the
 * workout page, Sets per muscle's breakdown).
 */
export function SectionHeadLink({ title, count, lines = 1, onPress, accessibilityLabel, testID }: {
  title: string; count?: string; lines?: number; onPress: () => void; accessibilityLabel?: string; testID?: string;
}) {
  const { colors: t } = useTally();
  // on a card the title starts `space-4` under the card's top, on the page `space-6` under what's above
  const above = useContext(OnCard) ? SPACE.s4 : SPACE.s6;
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={accessibilityLabel} testID={testID}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: MARGIN, minHeight: CONTROL.hitMin, paddingTop: CONTROL.hitMin - TYPE.title3.lineHeight, marginTop: above - (CONTROL.hitMin - TYPE.title3.lineHeight), marginBottom: SPACE.s1, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ ...TYPE.title3, color: t.ink, flexShrink: 1 }} numberOfLines={lines}>{title}</Text>
      {/* in the column of the counts in the rows below; halves never wrap */}
      {count !== undefined && <Text numberOfLines={1} style={[{ ...TYPE.headline, color: t.ink, flexShrink: 0, marginLeft: 'auto', paddingLeft: SPACE.s3, minWidth: 28, textAlign: 'right' }, tnum]}>{count}</Text>}
    </Pressable>
  );
}

/** A finished workout as strokes: one group per exercise, warm-ups short, record sets in signal. */
export function workoutStrokes(w: Workout, recordSets: Set<string>): StrokeState[][] {
  return w.exercises.filter((e) => e.sets.length).map((e) => e.sets.map((s): StrokeState => (
    s.type === 'warmup' ? 'warmup' : recordSets.has(s.id) ? 'record' : 'done')));
}

/**
 * Strokes in groups that wrap onto a new line when a long workout runs out of
 * width, inside a long exercise too, so nothing runs off the screen; read out
 * as one element.
 */
export function WorkoutTally({ groups, label, size = 'hero', testID, style }: { groups: StrokeState[][]; label: string; size?: 'regular' | 'hero'; testID?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} testID={testID}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: STROKE_DIMS[size].group, rowGap: SPACE.s2 }, style]}>
      {groups.map((g, i) => <Tally key={i} groups={[g]} size={size} label="" wrap />)}
    </View>
  );
}
