// Search: browse families or query exact variations. The field focuses on
// open; body-part chips filter the list, and + creates an exercise. (Routines and past workouts
// join this list later; docs/design/navigation.md.)
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList, Pressable, Text, TextInput, type TextInputInstance, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BODY_PARTS } from '@increment/core';

import { allSessions, useAppState } from '@/data/store';
import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { exerciseBrowserRows } from '@/lib/exerciseBrowser';
import { ChoiceChips } from '@/ui/tally/ChoiceChips';
import { editExercise } from '@/lib/exerciseForm';
import { useFormat } from '@/lib/format';
import { useSearchFocus } from '@/ui/useSearchFocus';
import { useTally } from '@/lib/theme';
import { Button, Empty } from '@/ui/kit';
import { ListRow, SymbolIcon } from '@/ui/tally/ListRow';
import { TabTitle } from '@/ui/tally/TabRoot';

export default function SearchScreen() {
  const s = useAppState();
  const f = useFormat();
  const { tr } = f;
  const { colors: t } = useTally();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const focus = useSearchFocus();
  const [part, setPart] = useState('all');
  const input = useRef<TextInputInstance>(null);
  const sessions = allSessions(s);
  // Focus on every arrival, including Back from an exercise.
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => input.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []));

  const list = useMemo(() => exerciseBrowserRows(s.exercises, sessions, f, { query: q, part }), [s.exercises, sessions, q, part, f]);
  const total = useMemo(() => [...s.exercises.values()].filter((e) => !e.hidden).length, [s.exercises]);
  const parts = [{ id: 'all', label: tr('All') }, ...(BODY_PARTS as { id: string; label: string }[]).map((b) => ({ id: b.id, label: tr(b.label) }))];
  const create = async () => {
    const ex = await editExercise({ name: q.trim() });
    if (ex) router.push({ pathname: '/exercise/[id]', params: { id: ex.id } });
  };
  const plus = (
    <Pressable onPress={create} accessibilityRole="button" accessibilityLabel={tr('New exercise')} testID="new-exercise" hitSlop={4}
      style={({ pressed }) => ({ width: CONTROL.hitMin, height: CONTROL.hitMin, borderRadius: RADIUS.capsule, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.paper2 : t.paper3 })}>
      <SymbolIcon name="plus" size={22} color={t.ink} />
    </Pressable>
  );

  const header = (
    <View>
      <TabTitle title={tr('Search')} right={plus} />
      <View style={{ paddingHorizontal: SPACE.s5, gap: SPACE.s3, marginBottom: SPACE.s3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, borderRadius: RADIUS.capsule, paddingHorizontal: 14, backgroundColor: t.paper3, ...focus.containerStyle }}>
          <SymbolIcon name="magnifyingglass" size={16} color={t.ink2} />
          <TextInput ref={input} value={q} onChangeText={setQ} placeholder={tr('Search {n} exercises', { n: total })} placeholderTextColor={t.ink3}
            testID="exercise-search" accessibilityLabel={tr('Search')} onFocus={focus.onFocus} onBlur={focus.onBlur} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" returnKeyType="search"
            style={[TYPE.body, { flex: 1, minWidth: 0, color: t.ink, paddingVertical: 10 }, focus.inputStyle]} />
        </View>
        <ChoiceChips label={tr('Body part')} testID="search-parts" value={part} onChange={setPart} options={parts.map((p) => ({ value: p.id, label: p.label }))} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: SPACE.s8 + insets.bottom }}
        contentInsetAdjustmentBehavior="automatic"
        data={list}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item, index }) => {
          return (
            <ListRow first={index === 0} title={<Text style={[TYPE.body, { color: t.ink }]}>{item.title}</Text>}
              testID={item.family ? `family-${item.id}` : `exercise-${item.exercise.id}`} chevron
              subtitle={<Text style={[TYPE.footnote, { color: t.ink2 }]}>{item.subtitle}</Text>}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.exercise.id } })} />
          );
        }}
        ListEmptyComponent={(
          <Empty title={tr('Nothing found')} text={tr('Try another word, or create your own exercise.')}>
            <Button kind="tinted" icon="plus" title={tr('Create “{name}”', { name: q.trim() || tr('new exercise') })} onPress={create} />
          </Empty>
        )}
        initialNumToRender={20}
      />
    </View>
  );
}
