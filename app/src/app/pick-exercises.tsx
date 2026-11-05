// Picking exercises for the running workout (several at once) or a single one
// (Replace exercise). Opened through pickExercises() in lib/picker.ts.
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BODY_PARTS, matchExercise } from '@increment/core';

import { allSessions, useAppSelector } from '@/data/store';
import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { editExercise } from '@/lib/exerciseForm';
import { currentPick, finishPick } from '@/lib/picker';
import { useColors } from '@/lib/theme';
import {
  Button, Empty, Icon, SearchField,
} from '@/ui/kit';

export default function PickExercises() {
  const exercises = useAppSelector((s) => s.exercises);
  const workouts = useAppSelector((s) => s.workouts);
  const f = useFormat();
  const { tr } = f;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [pick] = useState(() => currentPick());
  const multi = !!pick?.multi;
  const [q, setQ] = useState('');
  const [part, setPart] = useState('all');
  const [chosen, setChosen] = useState<string[]>([]);
  const sessions = useMemo(() => allSessions(), [workouts]);
  // closing the screen any other way counts as Cancel
  useEffect(() => () => { if (currentPick() === pick) finishPick(null); }, [pick]);

  const list = useMemo(() => [...exercises.values()]
    .filter((e) => !e.hidden && (part === 'all' || e.bodyPart === part) && matchExercise(e, q))
    .sort((a, b) => f.exName(a).localeCompare(f.exName(b))), [exercises, q, part, f]);
  const parts = [{ id: 'all', label: tr('All') }, ...(BODY_PARTS as { id: string; label: string }[]).map((b) => ({ id: b.id, label: tr(b.label) }))];
  const partLabel = (id: string) => tr((BODY_PARTS as { id: string; label: string }[]).find((b) => b.id === id)?.label || 'Other');

  const done = (ids: string[] | null) => { finishPick(ids); router.back(); };
  const tap = (id: string) => {
    if (!multi) { done([id]); return; }
    setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const create = async () => {
    const ex = await editExercise({ name: q.trim() });
    if (!ex) return;
    if (!multi) { done([ex.id]); return; }
    setChosen((cur) => [...cur, ex.id]);
    setQ('');
    setPart('all');
  };
  const top = Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.bar, { paddingTop: top + SPACE.s3 }]}>
        <Pressable onPress={() => done(null)} hitSlop={SPACE.s2} accessibilityRole="button" testID="pick-cancel" style={styles.side}>
          <Text style={[TYPE.body, { color: c.accentText }]}>{tr('Cancel')}</Text>
        </Pressable>
        <Text style={[TYPE.headline, { color: c.ink }]} numberOfLines={1}>{pick?.title || tr('Add exercises')}</Text>
        <View style={[styles.side, { alignItems: 'flex-end' }]}>
          {multi && (
            <Pressable onPress={() => done(chosen)} disabled={!chosen.length} hitSlop={SPACE.s2} accessibilityRole="button" testID="pick-add">
              <Text style={[TYPE.headline, { color: chosen.length ? c.accentText : c.ink3 }]}>{chosen.length ? tr('Add {n}', { n: chosen.length }) : tr('Add')}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={{ paddingHorizontal: SPACE.s5, gap: SPACE.s3, paddingBottom: SPACE.s3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
          <View style={{ flex: 1 }}><SearchField value={q} onChange={setQ} placeholder={tr('Search')} testID="pick-search" /></View>
          <Pressable onPress={create} hitSlop={SPACE.s2} accessibilityRole="button" accessibilityLabel={tr('New exercise')} testID="pick-new"
            style={({ pressed }) => ({ height: CONTROL.hitMin, borderRadius: RADIUS.capsule, paddingHorizontal: SPACE.s3, flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, backgroundColor: pressed ? c.surface3 : c.accentSoft })}>
            <Icon name="plus" size={15} color={c.accentText} />
            <Text style={[TYPE.subhead, { color: c.accentText }]}>{tr('New')}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.s2 }} keyboardShouldPersistTaps="handled">
          {parts.map((p) => {
            const on = p.id === part;
            return (
              <Pressable key={p.id} onPress={() => setPart(p.id)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ minHeight: CONTROL.hitMin, justifyContent: 'center', paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2, borderRadius: RADIUS.capsule, backgroundColor: on ? c.chipOn : c.surface }}>
                <Text style={[TYPE.subhead, { color: on ? c.chipOnInk : c.ink2 }]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: SPACE.s5, paddingBottom: insets.bottom + SPACE.s6 }}
        initialNumToRender={20}
        ListEmptyComponent={(
          <Empty title={q.trim() ? tr('No match for “{q}”', { q: q.trim() }) : tr('Nothing found')} text={tr('Create it as your own exercise.')}>
            <Button kind="tinted" icon="plus" title={tr('Create “{name}”', { name: q.trim() || tr('new exercise') })} onPress={create} testID="pick-create" />
          </Empty>
        )}
        renderItem={({ item, index }) => {
          const n = sessions.get(item.id)?.length || 0;
          const on = chosen.includes(item.id);
          return (
            <Pressable onPress={() => tap(item.id)} accessibilityRole={multi ? 'checkbox' : 'button'} aria-checked={multi ? on : undefined} testID={`pick-${item.id}`}
              style={({ pressed }) => [styles.row, {
                backgroundColor: on ? c.accentSoft : pressed ? c.surface2 : c.surface,
                borderTopLeftRadius: index === 0 ? RADIUS.m : 0, borderTopRightRadius: index === 0 ? RADIUS.m : 0,
                borderBottomLeftRadius: index === list.length - 1 ? RADIUS.m : 0, borderBottomRightRadius: index === list.length - 1 ? RADIUS.m : 0,
              }]}>
              {index > 0 && <View style={[styles.hairline, { backgroundColor: c.line }]} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[TYPE.body, { color: c.ink }]} numberOfLines={1}>{f.exName(item)}</Text>
                <Text style={[TYPE.footnote, { color: c.ink2, marginTop: SPACE.s1 }]} numberOfLines={1}>{partLabel(item.bodyPart) + (n ? ` · ${f.plural(n, 'time')}` : '')}</Text>
              </View>
              {on && <Icon name="check" size={18} color={c.accentText} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.s5, paddingBottom: SPACE.s3, gap: SPACE.s2 },
  side: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, minHeight: CONTROL.rowH, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2 },
  hairline: { position: 'absolute', top: 0, left: SPACE.s4, right: 0, height: StyleSheet.hairlineWidth },
});
