// Working sets per muscle over the last 7 days, as tallies in fives. Given a
// target range (the store version may pass one), hairlines show the sets still
// missing to its lower end; the open app passes none. With `onPress` each row
// opens what makes up its number (#89): no chevron, a pressed state, and each
// row at least 44 pt tall across the full width (Apple's minimum touch target;
// Laurin, 14 Nov 2026). docs/design/components.md
import { halfText } from '@increment/core';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CONTROL, SPACE, STROKE, TYPE } from '@/design/tally';
import { useTally } from '@/lib/theme';
import { fives, Tally } from './Tally';

export type MuscleRow = { muscle: string; label: string; sets: number; direct: number; helper: number; floor?: number; ceiling?: number };

const FIVE = 5 * STROKE.slot + 4 * STROKE.gap; // one full group of strokes

// a pressable row is a 44 pt touch target to the screen's edges; the rows meet
const PRESS_AREA = { marginHorizontal: -SPACE.s5, paddingHorizontal: SPACE.s5, minHeight: CONTROL.hitMin };

export function MuscleVolume({ rows, accessibilityLabel, onPress, testID }: {
  rows: MuscleRow[]; accessibilityLabel: (r: MuscleRow) => string; onPress?: (r: MuscleRow) => void; testID?: string;
}) {
  const { colors: t } = useTally();
  // as many strokes as fit; the count on the right includes a final half
  const [width, setWidth] = useState(0);
  const room = width ? Math.max(1, Math.floor((width + STROKE.group) / (FIVE + STROKE.group))) * 5 : 0;
  return (
    <View style={{ paddingHorizontal: SPACE.s5, gap: onPress ? 0 : SPACE.s3 }} testID={testID}>
      {rows.map((r, i) => {
        const missing = r.floor ? Math.max(0, Math.ceil(r.floor - r.sets)) : 0;
        const done = Math.min(r.direct, room);
        const helper = Math.min(Math.floor(r.helper), room - done);
        const over = r.ceiling !== undefined && r.sets > r.ceiling;
        const row = { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 } as const;
        const content = (
          <>
            <Text style={[TYPE.subhead, { color: t.ink, width: 84 }]}>{r.label}</Text>
            <View style={{ flex: 1, overflow: 'hidden' }} onLayout={i === 0 ? (e) => setWidth(e.nativeEvent.layout.width) : undefined}>
              {room > 0 && <Tally groups={fives(done, Math.min(missing, room - done - helper), helper)} label="" />}
            </View>
            <Text style={[TYPE.headline, { color: over ? t.ink2 : t.ink, minWidth: 28, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{halfText(r.sets)}</Text>
          </>
        );
        if (!onPress) {
          return <View key={r.muscle} accessible accessibilityLabel={accessibilityLabel(r)} testID={`muscle-${r.muscle}`} style={row}>{content}</View>;
        }
        return (
          <Pressable key={r.muscle} onPress={() => onPress(r)} accessibilityRole="button" accessibilityLabel={accessibilityLabel(r)} testID={`muscle-${r.muscle}`}
            style={({ pressed }) => [row, PRESS_AREA, { backgroundColor: pressed ? t.paper2 : 'transparent' }]}>
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}
