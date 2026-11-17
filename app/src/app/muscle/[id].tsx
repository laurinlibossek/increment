// The sets behind one muscle's number in Today's Sets per muscle (#89): the
// muscle with its total for the last 7 days and those sets as a tally, then
// one block per exercise (most sets first; its name opens the exercise) with
// its count, and under it each workout (newest first; it opens the workout):
// the day and routine, then the sets counted and the rows a left/right
// pairing leaves out. Exercises where the muscle only helps follow under
// "Indirect sets" (#127). Always adds up to the number on Today (muscleSets in
// core/today.js). One number per exercise, sets as the content and a hairline
// between exercises, so the screen reads at a glance (Laurin, 17 Nov 2026).
// docs/design/navigation.md
import { useMemo } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { halfText, muscleSets } from '@increment/core';

import { useAppState } from '@/data/store';
import type { WorkSet } from '@/data/types';
import { CONTROL, SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { useTally } from '@/lib/theme';
import { useToday } from '@/lib/useNow';
import {
  MARGIN, SectionHeadLink, tnum, WorkoutTally,
} from '@/ui/facts';

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
  const total = tr('{sets} in the last 7 days', { sets: f.setsCount(b.sets) });
  const hasHelpers = b.exercises.some((e) => e.helper);
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
              <WorkoutTally groups={[...b.exercises.filter((e) => !e.helper && e.sets).map((e) => Array(e.sets).fill('done')), ...(Math.floor(b.helper) ? [Array(Math.floor(b.helper)).fill('helper')] : [])]} size="regular" label={total} testID="muscle-tally" />
            </View>
          </>
        )}
      </View>

      {!b.exercises.length && (
        <Text style={{ ...TYPE.subhead, color: t.ink2, paddingHorizontal: MARGIN, marginTop: name ? SPACE.s5 : 0 }} testID="muscle-empty">{tr('No sets in the last 7 days.')}</Text>
      )}

      {b.exercises.map((e, i) => {
        const ex = s.exercises.get(e.exerciseId);
        const exName = f.exName(ex) || tr('Unknown exercise');
        const prev = b.exercises[i - 1];
        // "Indirect sets" always heads the helpers and says how they count; "Direct sets" only when helpers follow
        const group = e.helper ? !prev || !prev.helper : i === 0 && hasHelpers;
        return (
          <View key={e.exerciseId} testID={`muscle-ex-${e.exerciseId}`}>
            {group && (
              <View style={{ paddingHorizontal: MARGIN, marginTop: i ? SPACE.s8 : SPACE.s6, gap: SPACE.s1 }} testID={`muscle-group-${e.helper ? 'indirect' : 'direct'}`}>
                <Text style={{ ...TYPE.subhead, fontWeight: '600', color: t.ink2 }} accessibilityRole="header">{tr(e.helper ? 'Indirect sets' : 'Direct sets')}</Text>
                {e.helper && <Text style={{ ...TYPE.footnote, color: t.ink2 }} testID="muscle-helper-note">{tr('Exercises where this muscle helps count half a set.')}</Text>}
              </View>
            )}
            {!group && i > 0 && <View style={{ height: 0.5, marginLeft: MARGIN, marginTop: SPACE.s4, backgroundColor: t.line }} />}
            <SectionHeadLink title={exName} count={halfText(e.sets)} lines={2} testID={`muscle-ex-link-${e.exerciseId}`}
              accessibilityLabel={`${exName}, ${f.setsText(e)}`}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.exerciseId } })} />
            {e.workouts.map((w) => {
              const when = `${f.date.workoutDay(w.startedAt)} · ${w.name}`;
              // a set never breaks across lines ("28 kg × 8"); the list wraps between sets
              const sets = w.rows.map((x) => `${side(x)}${f.setText(x, ex?.category)}`.replace(/ /g, '\u00A0')).join(' · ');
              const unpaired = w.unpaired ? tr('{n} unpaired', { n: f.num(w.unpaired, 0) }) : '';
              return (
                <Pressable key={w.id} testID={`muscle-workout-${e.exerciseId}-${w.id}`} accessibilityRole="button"
                  accessibilityLabel={`${when}, ${sets.replace(/\u00A0/g, ' ')}, ${f.setsText(w)}`}
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                  style={({ pressed }) => ({ minHeight: CONTROL.hitMin, justifyContent: 'center', paddingHorizontal: MARGIN, paddingVertical: SPACE.s1, backgroundColor: pressed ? t.paper2 : 'transparent' })}>
                  <Text style={{ ...TYPE.footnote, color: t.ink2 }} numberOfLines={1}>{when}</Text>
                  <Text style={[{ ...TYPE.subhead, color: t.ink }, tnum]}>{sets}</Text>
                  {!!unpaired && <Text style={{ ...TYPE.footnote, color: t.ink2 }}>{unpaired}</Text>}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}
