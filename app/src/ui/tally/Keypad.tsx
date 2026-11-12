// The number pad for weights, reps and times, drawn by the app in a sheet at
// paper-2 (components.md, Keypad): the value being typed (or last time's in
// ghost ink), plates per side for a barbell, digits, −/+ by the exercise's
// real step, ⌫, and Next (weight → reps → log the set). Dragging its handle or
// title down closes it (#31).
import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RADIUS, SPACE, TYPE } from '@/design/tally';
import { useTally } from '@/lib/theme';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'dec' | 'back' | 'minus' | 'plus' | 'next';

/**
 * The text after a key: digits append (or replace the whole value when
 * `fresh`, the first key after opening a field), the decimal key adds the
 * separator once, ⌫ removes the last character.
 */
export function keypadInput(text: string, key: KeypadKey, { fresh, decimal, maxLength }: { fresh: boolean; decimal: string | null; maxLength: number }): string {
  const cur = fresh ? '' : text;
  if (key === 'back') return text.slice(0, -1);
  if (key === 'dec') {
    if (!decimal || /[.,]/.test(cur)) return fresh ? `0${decimal || ''}` : text;
    return (cur || '0') + decimal;
  }
  if (!/^\d$/.test(key)) return text;
  const next = cur === '0' ? key : cur + key;
  return next.length > maxLength ? text : next;
}

const KEY_H = 52;

/**
 * Dragging the handle or the title down moves the whole keypad (#31). Let go
 * past DISMISS_PX (or a third of the keypad's height, if that is less), or
 * flick down faster than DISMISS_VELOCITY (px per ms, about 500 pt/s) after at
 * least 12 px, and it closes the way a tap on the handle does; anything less
 * springs back. The keys never start a drag, so sliding over them only types.
 */
const DISMISS_PX = 80;
const DISMISS_VELOCITY = 0.5;
export const keypadDismisses = (dy: number, vy: number, height: number) =>
  dy > Math.min(DISMISS_PX, height / 3) || (vy > DISMISS_VELOCITY && dy > 12);
const NATIVE_DRIVER = Platform.OS !== 'web';

export function Keypad({
  title, value, ghost, unit, aside, decimal, steps, labels, onKey, onClose,
}: {
  title: string;
  /** the value as it reads (a time as m:ss) */
  value: string;
  /** shown in ghost ink while nothing is typed */
  ghost: string;
  unit?: string;
  /** e.g. plates per side */
  aside?: { label: string; value: string } | null;
  /** the person's decimal separator, or null where the field takes whole numbers */
  decimal: string | null;
  /** the −/+ keys, e.g. ['−2.5', '+2.5'] */
  steps: [string, string];
  labels: { next: string; close: string; delete: string; minus: string; plus: string };
  onKey: (k: KeypadKey) => void;
  onClose: () => void;
}) {
  const { colors: t } = useTally();
  const insets = useSafeAreaInsets();
  // ---------- drag down to close ----------
  const y = useRef(new Animated.Value(0)).current;
  const height = useRef(320);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reduceMotion = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { reduceMotion.current = r; }).catch(() => {});
  }, []);
  const back = () => {
    if (reduceMotion.current) y.setValue(0);
    else Animated.spring(y, { toValue: 0, useNativeDriver: NATIVE_DRIVER, bounciness: 0, speed: 20 }).start();
  };
  // the finger's own speed over its last moves (PanResponder's vy is unreliable in a browser);
  // a finger that rested for 100 ms before letting go didn't flick
  const speed = useRef({ at: 0, dy: 0, v: 0 });
  const pan = useRef(PanResponder.create({
    // taken over from the handle's tap once the finger moves mostly down
    onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
    onPanResponderGrant: () => { speed.current = { at: Date.now(), dy: 0, v: 0 }; },
    onPanResponderMove: (_, g) => {
      const at = Date.now(), last = speed.current;
      if (at > last.at) speed.current = { at, dy: g.dy, v: 0.6 * ((g.dy - last.dy) / (at - last.at)) + 0.4 * last.v };
      y.setValue(Math.max(0, g.dy));
    },
    onPanResponderRelease: (_, g) => {
      const v = Date.now() - speed.current.at > 100 ? 0 : Math.max(g.vy, speed.current.v);
      if (!keypadDismisses(g.dy, v, height.current)) { back(); return; }
      const done = () => { closeRef.current(); y.setValue(0); };
      if (reduceMotion.current) done();
      else Animated.timing(y, { toValue: height.current, duration: 160, useNativeDriver: NATIVE_DRIVER }).start(done);
    },
    onPanResponderTerminate: back,
    onPanResponderTerminationRequest: () => false,
  })).current;
  const key = (k: KeypadKey, text: ReactNode, opts: { fn?: boolean; label?: string; disabled?: boolean; side?: boolean } = {}) => (
    <Pressable key={k} onPress={() => onKey(k)} disabled={opts.disabled} accessibilityRole="button" accessibilityLabel={opts.label} testID={`key-${k}`}
      style={({ pressed }) => [opts.side ? styles.sideKey : styles.key, { backgroundColor: opts.fn ? t.paper3 : t.paper, opacity: pressed ? 0.7 : 1 }]}>
      {typeof text === 'string'
        ? <Text style={[opts.fn ? styles.fnText : styles.digit, { color: t.ink }]}>{text}</Text>
        : text}
    </Pressable>
  );
  const shown = value || ghost;
  return (
    <Animated.View testID="keypad" accessibilityViewIsModal={false} onLayout={(e) => { height.current = e.nativeEvent.layout.height; }}
      style={[styles.sheet, { backgroundColor: t.paper2, borderTopColor: t.line, paddingBottom: Math.max(insets.bottom, SPACE.s4), transform: [{ translateY: y }] }]}>
      <View {...pan.panHandlers} testID="keypad-drag">
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={labels.close} testID="keypad-close" hitSlop={8} style={styles.grabHit}>
          <View style={[styles.grab, { backgroundColor: t.paper3 }]} />
        </Pressable>
        <View style={styles.head}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ ...TYPE.footnote, color: t.ink2 }} numberOfLines={1}>{title}</Text>
            <Text style={{ ...TYPE.numberL, color: value ? t.ink : t.ink3, fontVariant: ['tabular-nums'] }} testID="keypad-value" numberOfLines={1}>
              {shown || '0'}
              {!!unit && <Text style={{ fontSize: 17, fontWeight: '600', color: t.ink2 }}>{` ${unit}`}</Text>}
            </Text>
          </View>
          {!!aside && (
            <View style={{ alignItems: 'flex-end', flexShrink: 1 }} testID="keypad-aside">
              <Text style={{ ...TYPE.footnote, color: t.ink2 }} numberOfLines={1}>{aside.label}</Text>
              <Text style={{ ...TYPE.headline, color: t.ink, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{aside.value}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.grid}>
        <View style={styles.digits}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row) => (
            <View key={row[0]} style={styles.row}>{row.map((d) => key(d as KeypadKey, d))}</View>
          ))}
          <View style={styles.row}>
            {key('dec', decimal || '', { disabled: !decimal, label: decimal || undefined })}
            {key('0', '0')}
            {key('back', '⌫', { fn: true, label: labels.delete })}
          </View>
        </View>
        <View style={styles.side}>
          {key('minus', steps[0], { fn: true, label: labels.minus, side: true })}
          {key('plus', steps[1], { fn: true, label: labels.plus, side: true })}
          <Pressable onPress={() => onKey('next')} accessibilityRole="button" testID="key-next"
            style={({ pressed }) => [styles.sideKey, styles.next, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={{ color: t.onPrimary, fontSize: 17, fontWeight: '600' }}>{labels.next}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: RADIUS.l, borderTopRightRadius: RADIUS.l, paddingHorizontal: SPACE.s4, borderTopWidth: StyleSheet.hairlineWidth },
  grabHit: { alignSelf: 'center', paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s6 },
  grab: { width: 36, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SPACE.s3, paddingHorizontal: 6, paddingBottom: SPACE.s3 },
  grid: { flexDirection: 'row', gap: SPACE.s2 },
  digits: { flex: 3, gap: SPACE.s2 },
  side: { flex: 1.15, gap: SPACE.s2, justifyContent: 'flex-start' },
  row: { flexDirection: 'row', gap: SPACE.s2 },
  key: { flex: 1, height: KEY_H, borderRadius: RADIUS.m, alignItems: 'center', justifyContent: 'center' },
  sideKey: { height: KEY_H, borderRadius: RADIUS.m, alignItems: 'center', justifyContent: 'center' },
  next: { height: KEY_H * 2 + SPACE.s2 },
  digit: { fontSize: 24, fontWeight: '500', fontVariant: ['tabular-nums'] },
  fnText: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
