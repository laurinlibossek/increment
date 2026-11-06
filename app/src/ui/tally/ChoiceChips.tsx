// Search-style choices: ink on paper, with a horizontal row for long families.
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';
import { CONTROL, RADIUS, SPACE } from '@/design/tally';
import { useTally } from '@/lib/theme';

export function ChoiceChips({ options, value, onChange, label, testID }: {
  options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; label: string; testID?: string;
}) {
  const { colors: t } = useTally();
  const scroll = useRef<ScrollViewInstance>(null);
  const positions = useRef(new Map<string, { x: number; width: number }>());
  const viewport = useRef(0), offset = useRef(0);
  const reveal = () => {
    const pos = positions.current.get(value);
    if (!pos || !viewport.current) return;
    const next = pos.x < offset.current || pos.width > viewport.current ? pos.x
      : pos.x + pos.width > offset.current + viewport.current ? pos.x + pos.width - viewport.current : offset.current;
    if (next !== offset.current) { offset.current = next; scroll.current?.scrollTo({ x: next, animated: false }); }
  };
  useEffect(reveal, [value]);
  return <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" testID={testID}
    onLayout={(e) => { viewport.current = e.nativeEvent.layout.width; reveal(); }}
    onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.x; }} scrollEventThrottle={16}
    accessibilityLabel={label} contentContainerStyle={{ gap: SPACE.s2 }}>
    {options.map((o) => <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" aria-selected={o.value === value}
      accessibilityLabel={o.label} testID={testID ? `${testID}-${o.value}` : undefined}
      onLayout={(e) => { positions.current.set(o.value, e.nativeEvent.layout); if (o.value === value) reveal(); }}
      style={{ minHeight: CONTROL.hitMin, justifyContent: 'center' }}>
      <View style={{ minHeight: 32, justifyContent: 'center', borderRadius: RADIUS.capsule, paddingHorizontal: SPACE.s3, backgroundColor: o.value === value ? t.ink : t.paper3 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: o.value === value ? t.paper : t.ink2 }}>{o.label}</Text>
      </View>
    </Pressable>)}
  </ScrollView>;
}
