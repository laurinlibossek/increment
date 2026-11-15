// Reps left in reserve for the set just logged: 0 · 1 · 2+ (components.md,
// EffortPicker). 1 sits in the middle: it's the target; 0 is failure, 2+ a
// lighter set. One tap, no confirmation; tapping the chosen one again clears it.
import { Pressable, Text, View } from 'react-native';

import { CONTROL, RADIUS, SPACE } from '@/design/tally';
import { useTally } from '@/lib/theme';

const OPTIONS = [0, 1, 2] as const;

export function EffortPicker({
  value, onChange, label, optionLabel,
}: {
  value: number | null;
  onChange: (rir: number | null) => void;
  /** Read out for the group, e.g. "Reps left?" */
  label: string;
  /** Read out for one option, e.g. "2 left" */
  optionLabel: (rir: number) => string;
}) {
  const { colors: t } = useTally();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, minHeight: CONTROL.hitMin, marginVertical: -(CONTROL.hitMin - 36) / 2 }} testID="effort">
      {OPTIONS.map((n) => {
        const on = value === n;
        return (
          <Pressable key={n} onPress={() => onChange(on ? null : n)}
            accessibilityRole="radio" accessibilityState={{ checked: on }} aria-pressed={on} accessibilityLabel={optionLabel(n)} testID={`effort-${n}`}
            style={({ pressed }) => ({ minWidth: CONTROL.hitMin, height: CONTROL.hitMin, justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
            <View style={{
              minWidth: CONTROL.hitMin, height: 36, paddingHorizontal: 12, borderRadius: RADIUS.capsule,
              alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.ink : t.paper3,
            }}>
              <Text style={{ color: on ? t.paper : t.ink, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{n === 2 ? '2+' : String(n)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
