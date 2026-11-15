// Lifts (Progress → Lifts): the exercises you've done, the most recent first,
// with how often and when. Every exercise in the library is under Search.
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BODY_PARTS, matchExercise } from '@increment/core';

import { allSessions, useAppState } from '@/data/store';
import { SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { useTally } from '@/lib/theme';
import { ENABLE_EXERCISE_THUMBNAILS } from '@/lib/exerciseThumbnails';
import { ExerciseThumbnail, EXERCISE_THUMBNAIL_SIZE } from '@/ui/ExerciseThumbnail';
import { Empty, SearchField } from '@/ui/kit';
import { ListRow } from '@/ui/tally/ListRow';

export default function LiftsScreen() {
  const s = useAppState();
  const f = useFormat();
  const { tr } = f;
  const { colors: t } = useTally();
  const [q, setQ] = useState('');
  const sessions = allSessions(s);
  const done = useMemo(() => [...sessions.entries()]
    .map(([id, list]) => ({ ex: s.exercises.get(id), n: list.length, last: list[0]?.startedAt || 0 }))
    .filter((x) => x.ex && x.n)
    .sort((a, b) => b.last - a.last) as { ex: NonNullable<ReturnType<typeof s.exercises.get>>; n: number; last: number }[], [sessions, s.exercises]);
  const list = useMemo(() => done.filter((x) => matchExercise(x.ex, q)), [done, q]);
  const partLabel = (id: string) => tr(BODY_PARTS.find((b) => b.id === id)?.label || 'Other');

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.paper }}
      contentContainerStyle={{ paddingBottom: SPACE.s8 }}
      contentInsetAdjustmentBehavior="automatic"
      data={list}
      keyExtractor={(x) => x.ex.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={done.length > 8 ? (
        <View style={{ marginHorizontal: SPACE.s5, marginVertical: SPACE.s3 }}>
          <SearchField style={{ paddingHorizontal: 14 }} iconTone="ink2" value={q} onChange={setQ} placeholder={tr('Search {n} lifts', { n: done.length })} label={tr('Search')} testID="lifts-search" />
        </View>
      ) : undefined}
      renderItem={({ item, index }) => (
        <ListRow first={index === 0} title={ENABLE_EXERCISE_THUMBNAILS ? <Text style={[TYPE.body, { color: t.ink }]}>{f.exName(item.ex)}</Text> : f.exName(item.ex)} testID={`lift-${item.ex.id}`}
          lead={ENABLE_EXERCISE_THUMBNAILS ? <ExerciseThumbnail exerciseId={item.ex.id} name={f.exName(item.ex)} /> : undefined}
          leadWidth={ENABLE_EXERCISE_THUMBNAILS ? EXERCISE_THUMBNAIL_SIZE : undefined}
          subtitle={`${partLabel(item.ex.bodyPart)} · ${f.plural(item.n, 'time')} · ${f.relDayLower(item.last)}`}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.ex.id } })} />
      )}
      ListEmptyComponent={done.length
        ? <Empty title={tr('Nothing found')} />
        : <Empty title={tr('No lifts yet')} text={tr('Every exercise you log shows up here, with its charts and records.')} />}
      initialNumToRender={20}
    />
  );
}
