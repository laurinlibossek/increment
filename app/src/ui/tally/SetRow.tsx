// One set (docs/design/components.md, SetRow, #48): its label (W, 1, 2, D, F),
// which opens the set's menu; weight × reps (or the exercise's own fields);
// short notes on the set (change since last time, Record, reps in reserve,
// side, rep range); and in the running workout one tick at the end that logs
// and un-logs it. No strokes in rows, no ⋯, no "Previous" column. Swipe left
// to delete. SetHeader names the columns once above the rows.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated as RNAnimated, PanResponder, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';

import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { useTally } from '@/lib/theme';
import { Icon } from '@/ui/kit';
import { Highlight } from './Highlight';

/** The tick: pending (outlined), the set being logged (an ink outline), logged (ink), a record (signal). */
export type TickState = 'pending' | 'live' | 'done' | 'record';

/** A short note on a set: plain (a chip), up (signal: a record, a gain) or down (grey text: less than last time). */
export type SetNote = { text: string; tone?: 'plain' | 'up' | 'down' };

const TICK = 28;

export function Tick({ state }: { state: TickState }) {
  const { colors: t } = useTally();
  const filled = state === 'done' || state === 'record';
  const fill = state === 'record' ? t.signal : t.strokeDone;
  return (
    <View style={{
      width: TICK, height: TICK, borderRadius: TICK / 2, alignItems: 'center', justifyContent: 'center',
      backgroundColor: filled ? fill : 'transparent',
      borderWidth: filled ? (state === 'record' && t.signalEdge !== t.signal ? 1 : 0) : 2,
      borderColor: filled ? t.signalEdge : state === 'live' ? t.ink : t.ink3,
    }}>
      {filled && <Icon name="check" size={16} color={state === 'record' ? t.onSignal : t.paper} />}
    </View>
  );
}

type Props = {
  testID: string;
  label: string;
  first?: boolean;
  /** the set's label (W, 1, 2, D, F): it opens the set's menu */
  lead: { text: string; label: string; testID: string; onPress: () => void };
  /** the values: fields, joined by × */
  children: ReactNode;
  notes: SetNote[];
  notesTestID?: string;
  /** the running workout: the tick that logs the set */
  tick?: { state: TickState; checked: boolean; label: string; testID: string; onPress: () => void };
  deleteLabel: string;
  onDelete: () => void;
  /** changes to shake the row (a set that can't be logged yet) */
  shake?: number;
};

export function SetRow({
  testID, label, first, lead, children, notes, notesTestID, tick, deleteLabel, onDelete, shake = 0,
}: Props) {
  const { colors: t } = useTally();
  const native = Platform.OS !== 'web';
  const dx = useRef(new RNAnimated.Value(0)).current;
  const shakeX = useRef(new RNAnimated.Value(0)).current;
  const del = useRef(onDelete);
  del.current = onDelete;

  useEffect(() => {
    if (!shake) return;
    RNAnimated.sequence([-5, 5, -4, 4, 0].map((v) => RNAnimated.timing(shakeX, { toValue: v, duration: 60, useNativeDriver: native }))).start();
  }, [shake, shakeX, native]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderMove: (_, g) => dx.setValue(Math.min(0, g.dx)),
    onPanResponderRelease: (_, g) => {
      if (g.dx < -90) RNAnimated.timing(dx, { toValue: -600, duration: 160, useNativeDriver: native }).start(() => del.current());
      else RNAnimated.spring(dx, { toValue: 0, useNativeDriver: native }).start();
    },
    onPanResponderTerminate: () => RNAnimated.spring(dx, { toValue: 0, useNativeDriver: native }).start(),
  }), [dx, native]);

  return (
    <View style={styles.wrap}>
      <View style={[StyleSheet.absoluteFill, styles.delBg, { backgroundColor: t.danger }]}><Text style={[styles.delText, { color: t.paper }]}>{deleteLabel}</Text></View>
      <RNAnimated.View {...pan.panHandlers} testID={testID} accessibilityLabel={label}
        style={[styles.row, { backgroundColor: t.paper, transform: [{ translateX: RNAnimated.add(dx, shakeX) }] }]}>
        {!first && <View style={[styles.hairline, { backgroundColor: t.line }]} />}
        <Pressable onPress={lead.onPress} accessibilityRole="button" accessibilityLabel={lead.label} testID={lead.testID}
          style={({ pressed }) => [styles.lead, { opacity: pressed ? 0.5 : 1 }]}>
          <Text style={{ ...TYPE.headline, color: t.ink2, fontVariant: ['tabular-nums'] }}>{lead.text}</Text>
        </Pressable>
        <View style={styles.values}>{children}</View>
        <View style={styles.notes} testID={notesTestID}>
          {notes.map((n) => (n.tone === 'up'
            ? <Highlight key={n.text} chip>{n.text}</Highlight>
            : n.tone === 'down'
              ? <Text key={n.text} style={{ ...TYPE.caption, fontWeight: '600', color: t.ink2, fontVariant: ['tabular-nums'] }}>{n.text}</Text>
              : (
                <View key={n.text} style={[styles.chip, { backgroundColor: t.paper3 }]}>
                  <Text style={{ ...TYPE.caption, fontWeight: '600', color: t.ink2, fontVariant: ['tabular-nums'] }}>{n.text}</Text>
                </View>
              )))}
        </View>
        {tick && (
          <Pressable onPress={tick.onPress} accessibilityRole="checkbox" aria-checked={tick.checked} accessibilityState={{ checked: tick.checked }}
            accessibilityLabel={tick.label} testID={tick.testID} style={styles.tick}>
            <Tick state={tick.state} />
          </Pressable>
        )}
      </RNAnimated.View>
    </View>
  );
}

/**
 * The column names once above an exercise's sets (#48): "Set", then each
 * field's ("kg", "Reps", "Time", "km") over its column, at the fields' own
 * widths so they line up with the numbers below.
 */
export function SetHeader({ columns, testID }: { columns: { text: string; width: number }[]; testID?: string }) {
  const { colors: t } = useTally();
  const cell = (text: string, width: number) => (
    <Text numberOfLines={1} style={{ ...TYPE.caption, color: t.ink2, width, textAlign: 'center' }}>{text}</Text>
  );
  return (
    <View testID={testID} style={[styles.row, styles.head]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <View style={styles.lead}>{cell(columns[0].text, CONTROL.hitMin)}</View>
      <Times hidden>{columns.length === 3 ? [cell(columns[1].text, columns[1].width), cell(columns[2].text, columns[2].width)] : cell(columns[1].text, columns[1].width)}</Times>
    </View>
  );
}

/** Two values joined by a light ×, like "82.5 × 8"; `hidden` keeps the ×'s room without showing it (the header). */
export function Times({ children, hidden }: { children: [ReactNode, ReactNode] | ReactNode; hidden?: boolean }) {
  const { colors: t } = useTally();
  if (!Array.isArray(children)) return <>{children}</>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {children[0]}
      <Text style={{ ...TYPE.numberM, fontWeight: '400', color: hidden ? 'transparent' : t.ink2, marginHorizontal: 2, height: hidden ? 0 : undefined }} importantForAccessibility="no">×</Text>
      {children[1]}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  delBg: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: 22 },
  delText: { fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: CONTROL.rowH, paddingLeft: SPACE.s5 - 14, paddingRight: SPACE.s5 - 8, paddingVertical: 4 },
  head: { minHeight: 0, paddingVertical: 0 },
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  lead: { width: CONTROL.hitMin, minHeight: CONTROL.hitMin, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.s2 },
  values: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  notes: { flex: 1, minHeight: CONTROL.hitMin, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', justifyContent: 'flex-end', gap: 6, paddingLeft: SPACE.s2 },
  tick: { width: CONTROL.hitMin, height: CONTROL.hitMin, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  chip: { minHeight: 26, paddingHorizontal: 10, borderRadius: RADIUS.capsule, justifyContent: 'center' },
});
