// Reordering the exercises of a draft (the running workout, or the template
// or workout being edited: ?draft=edit): drag the ≡ handle, or press and
// hold a row and drag it. The others slide out of the way.
import { useRef } from 'react';
import {
  Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { exerciseSetCount, isUnilateral, moveItem } from '@increment/core';

import { editDraft, getDraft, useAppSelector } from '@/data/store';
import type { DraftKey, EntryDraft } from '@/data/types';
import { useFormat } from '@/lib/format';
import { useColors } from '@/lib/theme';
import { CONTROL } from '@/design/tally';
import { useDragList, useScrollHost, type DragApi } from '@/ui/drag';
import { hitTarget, Icon } from '@/ui/kit';

const ROW = 64;

export default function Reorder() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const key: DraftKey = draft === 'edit' ? 'edit' : 'active';
  const a = useAppSelector((s) => getDraft(key, s));
  const exercises = useAppSelector((s) => s.exercises);
  const pair = useAppSelector((s) => s.settings.pairSides);
  const f = useFormat();
  const { tr } = f;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const list = a?.exercises || [];
  const scroll = useScrollHost();
  const drag = useDragList({
    ids: list.map((e) => e.id), rowH: ROW, scroll: scroll.host,
    onDrop: (from, to) => { editDraft(key, (x) => { moveItem(x.exercises, from, to); }); },
    onFold: scroll.host.lock,
  });
  const top = Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.bar, { paddingTop: top + 10 }]}>
        <View style={{ flex: 1 }} />
        <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700' }}>{tr('Reorder')}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Pressable onPress={() => router.back()} style={{ ...hitTarget, alignItems: 'flex-end', marginVertical: -(CONTROL.hitMin - 20) / 2 }} accessibilityRole="button" testID="reorder-done">
            <Text style={{ color: c.accentText, fontSize: 17, fontWeight: '700' }}>{tr('Done')}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView {...scroll.props} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <View {...drag.pan} style={[styles.group, { backgroundColor: c.surface }]}>
          {list.map((e, i) => {
            const item = drag.item(e.id, i, c.surface);
            const lifted = drag.drag?.from === i;
            return (
              <Animated.View key={e.id} onLayout={item.onLayout} style={[item.style, lifted && styles.lifted]}>
                <Row entry={e} name={f.exName(exercises.get(e.exerciseId)) || ''} sub={f.setsText(exerciseSetCount(e.sets, isUnilateral(exercises.get(e.exerciseId)), { pair })) + (e.supersetId ? ` · ${tr('superset')}` : '')}
                  lifted={lifted} api={drag.api} first={i === 0} moveLabel={tr('Move {name}', { name: f.exName(exercises.get(e.exerciseId)) || '' })} />
              </Animated.View>
            );
          })}
        </View>
        <Text style={{ color: c.ink2, fontSize: 13, marginTop: 10, paddingHorizontal: 4 }} testID="reorder-hint">{tr('Drag ≡ to move an exercise, or press and hold it.')}</Text>
      </ScrollView>
    </View>
  );
}

function Row({
  entry, name, sub, lifted, api, first, moveLabel,
}: { entry: EntryDraft; name: string; sub: string; lifted: boolean; api: { current: DragApi }; first: boolean; moveLabel: string }) {
  const c = useColors();
  // the handle drags right away, and keeps the finger
  const handle = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => api.current.begin(entry.id),
    onPanResponderMove: (_, g) => api.current.move(g.dy, g.moveY),
    onPanResponderRelease: () => api.current.end(),
    onPanResponderTerminate: () => api.current.end(),
    onPanResponderTerminationRequest: () => false,
  })).current;
  return (
    <View testID={`reorder-${entry.exerciseId}`} style={[styles.row, { backgroundColor: c.surface }]}>
      {!first && !lifted && <View style={[styles.hairline, { backgroundColor: c.line }]} />}
      {/* the rest of the row after a long press */}
      <Pressable onLongPress={() => api.current.begin(entry.id)} delayLongPress={320} onPressOut={() => api.current.release(entry.id)}
        style={{ flex: 1, minWidth: 0, justifyContent: 'center', height: '100%' }}>
        <Text style={{ color: c.ink, fontSize: 16 }} numberOfLines={1}>{name}</Text>
        <Text style={{ color: c.ink2, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
      </Pressable>
      <View {...handle.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={moveLabel} testID={`grip-${entry.exerciseId}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(ev) => api.current.step(entry.id, ev.nativeEvent.actionName === 'decrement' ? 1 : -1)}
        style={styles.grip}>
        <Icon name="grip" size={20} color={c.ink3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  group: { borderRadius: 14 },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, borderRadius: 14 },
  lifted: { borderRadius: 14 },
  hairline: { position: 'absolute', top: 0, left: 16, right: 0, height: StyleSheet.hairlineWidth },
  grip: { width: 52, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
