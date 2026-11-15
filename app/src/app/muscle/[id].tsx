// The sets behind one muscle's number in Today's Sets per muscle (#89): the
// muscle with its total for the last 7 days and those sets as a tally, then
// one section per exercise (most sets first; its name opens the exercise) with
// a row per workout (newest first; it opens the workout): the sets counted,
// the rows a left/right pairing leaves out, and the count. Always adds up to
// the number on Today (muscleSets in core/today.js). docs/design/navigation.md
import { useMemo } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { muscleSets } from '@increment/core';

import { useAppState } from '@/data/store';
import type { WorkSet } from '@/data/types';
import { SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { useTally } from '@/lib/theme';
import { useToday } from '@/lib/useNow';
import {
  MARGIN, SectionHeadLink, tnum, WorkoutTally,
} from '@/ui/facts';
import { ListRow } from '@/ui/tally/ListRow';

export default function MuscleSets() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const f = useFormat();
  const { tr } = f;
  const { colors: t } = useTally();
  // the same window as Today's, moving on at midnight (#36)
  const today = useToday();
  const b = useMemo(() => muscleSets(s.workouts, s.exercises, String(id)), [s.workouts, s.exercises, id, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = b.label ? tr(b.label) : '';
  const total = tr('{sets} in the last 7 days', { sets: f.plural(b.sets, 'set') });
  const side = (x: WorkSet) => (x.side === 'left' ? `${tr('Left')} ` : x.side === 'right' ? `${tr('Right')} ` : '');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.paper }} contentContainerStyle={{ paddingTop: SPACE.s1, paddingBottom: SPACE.s12 }} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: '' }} />
      <View style={{ paddingHorizontal: MARGIN }}>
        {!!name && <Text style={{ ...TYPE.title1, color: t.ink }} accessibilityRole="header" testID="muscle-title">{name}</Text>}
        {b.sets > 0 && (
          <>
            <Text style={{ ...TYPE.footnote, color: t.ink2 }} testID="muscle-total">{total}</Text>
            <View style={{ marginTop: SPACE.s5 }}>
              <WorkoutTally groups={b.exercises.filter((e) => e.sets).map((e) => Array(e.sets).fill('done'))} size="regular" label={total} testID="muscle-tally" />
            </View>
          </>
        )}
      </View>

      {!b.exercises.length && (
        <Text style={{ ...TYPE.subhead, color: t.ink2, paddingHorizontal: MARGIN, marginTop: name ? SPACE.s5 : 0 }} testID="muscle-empty">{tr('No sets in the last 7 days.')}</Text>
      )}

      {b.exercises.map((e) => {
        const ex = s.exercises.get(e.exerciseId);
        const exName = f.exName(ex) || tr('Unknown exercise');
        return (
          <View key={e.exerciseId} testID={`muscle-ex-${e.exerciseId}`}>
            <SectionHeadLink title={exName} count={f.num(e.sets, 0)} lines={2} testID={`muscle-ex-link-${e.exerciseId}`}
              accessibilityLabel={`${exName}, ${f.setsText(e)}`}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.exerciseId } })} />
            {e.workouts.map((w, i) => {
              const when = `${f.date.workoutDay(w.startedAt)} · ${w.name}`;
              // a set never breaks across lines ("28 kg × 8"); the list wraps between sets
              const sets = w.rows.map((x) => `${side(x)}${f.setText(x, ex?.category)}`.replace(/ /g, '\u00A0')).join(' · ');
              const unpaired = w.unpaired ? tr('{n} unpaired', { n: f.num(w.unpaired, 0) }) : '';
              return (
                <ListRow key={w.id} first={i === 0} chevron testID={`muscle-workout-${e.exerciseId}-${w.id}`}
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                  title={when}
                  subtitle={(
                    <>
                      <Text style={[{ ...TYPE.footnote, color: t.ink2 }, tnum]}>{sets}</Text>
                      {!!unpaired && <Text style={{ ...TYPE.footnote, color: t.ink2 }}>{unpaired}</Text>}
                    </>
                  )}
                  right={<Text style={[{ ...TYPE.headline, color: t.ink, minWidth: 28, textAlign: 'right' }, tnum]}>{f.num(w.sets, 0)}</Text>} />
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}
