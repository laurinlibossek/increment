// Search: browse families or query exact variations. The field focuses on
// open; body-part chips filter the list, and + creates an exercise. (Routines and past workouts
// join this list later; docs/design/navigation.md.)
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList, Pressable, Text, type TextInputInstance, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allSessions, useAppState } from '@/data/store';
import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { exerciseBrowserRows } from '@/lib/exerciseBrowser';
import { MuscleFilters } from '@/ui/MuscleFilters';
import { editExercise } from '@/lib/exerciseForm';
import { useFormat } from '@/lib/format';
import { useTally } from '@/lib/theme';
import { ENABLE_EXERCISE_THUMBNAILS } from '@/lib/exerciseThumbnails';
import { ExerciseThumbnail, EXERCISE_THUMBNAIL_SIZE } from '@/ui/ExerciseThumbnail';
import { Button, Empty, SearchField } from '@/ui/kit';
import { ListRow, SymbolIcon } from '@/ui/tally/ListRow';
import { TabTitle } from '@/ui/tally/TabRoot';

export default function SearchScreen() {
  const s = useAppState();
  const f = useFormat();
  const { tr } = f;
  const { colors: t } = useTally();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [part, setPart] = useState('all');
  const [muscle, setMuscle] = useState('all');
  const input = useRef<TextInputInstance>(null);
  const sessions = allSessions(s);
  // Focus on every arrival, including Back from an exercise.
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => input.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []));

  const list = useMemo(() => exerciseBrowserRows(s.exercises, sessions, f, { query: q, part, muscle, customFamilies: s.customFamilies }), [s.exercises, s.customFamilies, sessions, q, part, muscle, f]);
  const total = useMemo(() => [...s.exercises.values()].filter((e) => !e.hidden).length, [s.exercises]);
  const create = async () => {
    const ex = await editExercise({ name: q.trim() });
    if (ex) router.push({ pathname: '/exercise/[id]', params: { id: ex.id } });
  };
  const plus = (
    <Pressable onPress={create} accessibilityRole="button" accessibilityLabel={tr('New exercise')} testID="new-exercise"
      style={({ pressed }) => ({ width: CONTROL.hitMin, height: CONTROL.hitMin, borderRadius: RADIUS.capsule, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.paper2 : t.paper3 })}>
      <SymbolIcon name="plus" size={22} color={t.ink} />
    </Pressable>
  );

  const header = (
    <View>
      <TabTitle title={tr('Search')} right={plus} />
      <View style={{ paddingHorizontal: SPACE.s5, gap: SPACE.s3, marginBottom: SPACE.s3 }}>
        <SearchField style={{ paddingHorizontal: 14 }} iconTone="ink2" value={q} onChange={setQ} placeholder={tr('Search {n} exercises', { n: total })} label={tr('Search')} testID="exercise-search" inputRef={input} />
        <MuscleFilters region={part} muscle={muscle} onRegion={setPart} onMuscle={setMuscle} testID="search" />
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
              lead={ENABLE_EXERCISE_THUMBNAILS ? <ExerciseThumbnail exerciseId={item.exercise.id} name={f.exName(item.exercise)} /> : undefined}
              leadWidth={ENABLE_EXERCISE_THUMBNAILS ? EXERCISE_THUMBNAIL_SIZE : undefined}
              testID={item.family ? `family-${item.id}` : `exercise-${item.exercise.id}`}
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
