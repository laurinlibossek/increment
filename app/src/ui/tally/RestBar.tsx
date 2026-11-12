// The rest between sets, in the Action bar (components.md, ActionBar → Resting):
// the countdown, −15, +15, Skip, the drain bar and "Reps left?" for the set
// just logged. The drain bar is one linear animation run by Reanimated on the
// UI thread; the countdown text changes once a second, on the second. RestLine
// is the same rest under the set it follows (#53).
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { useTally } from '@/lib/theme';

/** Whole seconds until `end` (rounded up), updated as each second passes. */
export function useSecondsLeft(end: number) {
  const left = () => Math.max(0, Math.ceil((end - Date.now()) / 1000));
  const [secs, setSecs] = useState(left);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const ms = end - Date.now();
      setSecs(Math.max(0, Math.ceil(ms / 1000)));
      if (ms > 0) timer = setTimeout(tick, (ms % 1000 || 1000) + 4);
    };
    tick();
    return () => clearTimeout(timer);
  }, [end]);
  return secs;
}

/** A capsule button: `primary` in the primary fill (ink unless the theme says otherwise), `secondary` paper-3 with an accent label; `small` is 36 high with a 44 touch area. */
export function CapsuleButton({
  title, onPress, kind = 'primary', small, block, testID, label, icon, disabled,
}: { title: string; onPress: () => void; kind?: 'primary' | 'secondary'; small?: boolean; block?: boolean; testID?: string; label?: string; icon?: ReactNode; disabled?: boolean }) {
  const { colors: t } = useTally();
  const h = small ? 36 : CONTROL.buttonH;
  return (
    <Pressable onPress={onPress} disabled={disabled} aria-disabled={!!disabled} accessibilityState={{ disabled: !!disabled }} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      hitSlop={small ? (CONTROL.hitMin - h) / 2 : undefined}
      style={({ pressed }) => ({
        minHeight: h, paddingHorizontal: small ? SPACE.s4 : SPACE.s6, borderRadius: RADIUS.capsule,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s2,
        backgroundColor: kind === 'primary' ? t.primary : t.paper3, opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        alignSelf: block ? 'stretch' : 'auto',
      })}>
      {icon}
      <Text numberOfLines={1} style={{
        color: kind === 'primary' ? t.onPrimary : t.accent, fontSize: small ? 15 : 17, lineHeight: small ? 20 : 22, fontWeight: '600', fontVariant: ['tabular-nums'],
      }}>{title}</Text>
    </Pressable>
  );
}

/** Empties from right to left in one linear animation from now until `end`. */
export function DrainBar({ end, total }: { end: number; total: number }) {
  const { colors: t } = useTally();
  const p = useSharedValue(1);
  useEffect(() => {
    const ms = Math.max(0, end - Date.now());
    cancelAnimation(p);
    p.value = Math.max(0, Math.min(1, ms / 1000 / Math.max(1, total)));
    // the countdown is information, not decoration: it drains with Reduce Motion too
    p.value = withTiming(0, { duration: ms, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
  }, [end, total, p]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: t.paper3, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 2, backgroundColor: t.ink, transformOrigin: 'left' }, fill]} />
    </View>
  );
}

/**
 * The rest under the set it follows (#53): a line along the divider that
 * drains from right to left until `end`, with the time left at its end. It
 * reads the same timer as the Action bar. With Reduce Motion it steps once a
 * second instead of gliding; only this line re-renders each second.
 */
export function RestLine({ end, total, clock, label, testID }: {
  end: number; total: number; clock: (secs: number) => string; label: (secs: number) => string; testID?: string;
}) {
  const { colors: t } = useTally();
  const secs = useSecondsLeft(end);
  const reduced = useReducedMotion();
  const p = useSharedValue(1);
  useEffect(() => {
    const ms = Math.max(0, end - Date.now());
    cancelAnimation(p);
    p.value = Math.max(0, Math.min(1, ms / 1000 / Math.max(1, total)));
    if (!reduced) p.value = withTiming(0, { duration: ms, easing: Easing.linear });
  }, [end, total, reduced, p]);
  useEffect(() => {
    if (reduced) p.value = Math.max(0, Math.min(1, secs / Math.max(1, total)));
  }, [reduced, secs, total, p]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <View testID={testID} accessible accessibilityLabel={label(secs)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, minHeight: 22, paddingLeft: SPACE.s5, paddingRight: SPACE.s5 }}>
      <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: t.line, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.ink, transformOrigin: 'left' }, fill]} />
      </View>
      <Text style={{ ...TYPE.footnote, fontWeight: '600', color: t.ink2, fontVariant: ['tabular-nums'] }} testID={testID ? `${testID}-left` : undefined}>{clock(secs)}</Text>
    </View>
  );
}

export type RestBarProps = {
  end: number;
  total: number;
  labels: { rest: string; skip: string; minus: string; plus: string; left: (secs: number) => string; clock: (secs: number) => string };
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
  /** "Reps left?" and the EffortPicker, when a logged set can be rated */
  effort?: ReactNode;
};

export function RestBar({ end, total, labels, onAdjust, onSkip, effort }: RestBarProps) {
  const { colors: t } = useTally();
  const secs = useSecondsLeft(end);
  return (
    <View style={{ gap: SPACE.s3 }} testID="rest-bar">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s3 }}>
        <View accessible accessibilityLabel={labels.left(secs)} accessibilityLiveRegion="none">
          <Text style={{ ...TYPE.footnote, color: t.ink2 }}>{labels.rest}</Text>
          <Text style={{ ...TYPE.numberL, color: t.ink, fontVariant: ['tabular-nums'] }} testID="rest-left">{labels.clock(secs)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
          <CapsuleButton small kind="secondary" title="−15" label={labels.minus} onPress={() => onAdjust(-15)} testID="rest-minus" />
          <CapsuleButton small kind="secondary" title="+15" label={labels.plus} onPress={() => onAdjust(15)} testID="rest-plus" />
          <CapsuleButton small title={labels.skip} onPress={onSkip} testID="rest-skip" />
        </View>
      </View>
      <DrainBar end={end} total={total} />
      {effort}
    </View>
  );
}
