// Workouts (Progress → Workouts): finished workouts by month, or a month
// calendar (the button in the navigation bar switches). The calendar's maths
// is core's calendarMonth().
import { useMemo, useState } from 'react';
import {
  FlatList, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import {
  startOfMonth, startOfDay, addMonths, calendarMonth, workoutVolume,
} from '@increment/core';

import { stats, useAppState, type State } from '@/data/store';
import type { Workout } from '@/data/types';
import { useFormat, type Format } from '@/lib/format';
import { useColors, useTally } from '@/lib/theme';
import { SPACE, TYPE } from '@/design/tally';
import { hm, workoutStrokes, WorkoutTally } from '@/ui/facts';
import { ListRow } from '@/ui/tally/ListRow';
import { SectionHeader } from '@/ui/tally/SectionHeader';
import {
  Button, Empty, Icon, IconButton, Txt,
} from '@/ui/kit';

type Row = { kind: 'month'; m: number; count: number } | { kind: 'workout'; w: Workout; first: boolean };

export default function HistoryTab() {
  const s = useAppState();
  const f = useFormat();
  const { tr } = f;
  const { colors: t } = useTally();
  const [limit, setLimit] = useState(40);
  const [view, setView] = useState<'list' | 'cal'>('list');

  const rows = useMemo(() => {
    const out: Row[] = [];
    const counts = new Map<number, number>();
    for (const w of s.workouts) { const m = startOfMonth(w.startedAt); counts.set(m, (counts.get(m) || 0) + 1); }
    let cur = -1;
    for (const w of s.workouts.slice(0, limit)) {
      const m = startOfMonth(w.startedAt);
      const first = m !== cur;
      if (first) { out.push({ kind: 'month', m, count: counts.get(m) || 0 }); cur = m; }
      out.push({ kind: 'workout', w, first });
    }
    return out;
  }, [s.workouts, limit]);

  if (!s.workouts.length) {
    return (
      <View style={{ flex: 1, backgroundColor: t.paper }}>
        <Empty title={tr('No workouts yet')} text={tr('Bring your workouts over from the Setlog web app: make a backup there, then restore it here in Account.')}>
          <Button kind="tinted" icon="download" title={tr('Restore from backup')} onPress={() => router.push('/account')} testID="history-restore" />
        </Empty>
      </View>
    );
  }
  const toggle = (
    <IconButton icon={view === 'list' ? 'calendar' : 'list'} label={view === 'list' ? tr('Show calendar') : tr('Show list')}
      onPress={() => setView(view === 'list' ? 'cal' : 'list')} testID="history-view" />
  );
  const bar = <Stack.Screen options={{ headerRight: () => toggle }} />;
  if (view === 'cal') {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.paper }} contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }} contentInsetAdjustmentBehavior="automatic">
        {bar}
        <Calendar s={s} f={f} />
      </ScrollView>
    );
  }
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.paper }}
      contentContainerStyle={{ paddingTop: SPACE.s4, paddingBottom: SPACE.s8 }}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      keyExtractor={(r) => (r.kind === 'month' ? 'm' + r.m : r.w.id)}
      ListHeaderComponent={bar}
      renderItem={({ item, index }) => (item.kind === 'month'
        ? <SectionHeader first={index === 0} title={f.date.monthYear(item.m)} scope={f.plural(item.count, 'workout')} testID={`history-month-${item.m}`} />
        : <WorkoutRow w={item.w} s={s} f={f} first={item.first} />)}
      ListFooterComponent={s.workouts.length > limit
        ? <View style={{ paddingHorizontal: SPACE.s5, marginTop: SPACE.s6 }}><Button kind="tinted" testID="history-older" title={tr('Show older workouts')} onPress={() => setLimit(limit + 60)} /></View>
        : undefined}
      initialNumToRender={12}
      windowSize={7}
    />
  );
}

const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

/**
 * A month of days with workouts highlighted; tap one to see its workouts below.
 * Only the month's own days are drawn: the cells before and after stay empty, so
 * the grid shows exactly what the totals under it count.
 */
function Calendar({ s, f }: { s: State; f: Format & { tr: (t: string, v?: Record<string, string | number>) => string } }) {
  const c = useColors();
  const { tr } = f;
  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const [sel, setSel] = useState<number | null>(null);
  const cal = useMemo(() => calendarMonth(s.workouts, month, { weekStart: s.settings.weekStart }) as {
    start: number; next: number; days: number[]; byDay: Map<number, Workout[]>; workouts: number; daysTrained: number; time: number;
  }, [s.workouts, month, s.settings.weekStart]);
  const today = startOfDay(Date.now());
  const go = (n: number) => { setMonth(addMonths(month, n)); setSel(null); };
  const selected = sel !== null ? cal.byDay.get(sel) || [] : [];
  const weeks: number[][] = [];
  for (let i = 0; i < cal.days.length; i += 7) weeks.push(cal.days.slice(i, i + 7));
  return (
    <View>
      <View style={[st.cal, { backgroundColor: c.surface, marginHorizontal: 16 }]}>
        <View style={st.calHead}>
          <MonthButton icon="chevronLeft" label={tr('Previous month')} onPress={() => go(-1)} testID="cal-prev" />
          <Txt style={TYPE.headline} testID="cal-month">{f.date.monthYear(month)}</Txt>
          <MonthButton icon="chevron" label={tr('Next month')} onPress={() => go(1)} testID="cal-next" />
        </View>
        <View style={st.week}>
          {cal.days.slice(0, 7).map((d) => (
            <Text key={'w' + d} style={[st.wd, { color: c.ink2 }]}>{f.date.weekdayNarrow(d)}</Text>
          ))}
        </View>
        {weeks.map((wk) => (
          <View key={wk[0]} style={st.week}>
            {wk.map((d) => {
              if (d < cal.start || d >= cal.next) return <View key={d} style={st.dayWrap} />;
              const n = cal.byDay.get(d)?.length || 0;
              const on = sel === d;
              return (
                <View key={d} style={st.dayWrap}>
                  <Pressable onPress={() => setSel(n ? d : null)} testID={`cal-${dayKey(d)}`}
                    accessibilityRole="button" accessibilityState={{ selected: on }}
                    accessibilityLabel={n ? `${f.date.full(d)}, ${f.plural(n, 'workout')}` : f.date.full(d)}
                    style={[st.day, {
                      backgroundColor: n ? c.chipOn : 'transparent',
                      borderColor: on ? c.ink : 'transparent',
                    }]}>
                    <Text style={{
                      fontSize: 15, fontVariant: ['tabular-nums'],
                      color: n ? c.chipOnInk : d === today ? c.accentText : c.ink2,
                      fontWeight: n || d === today ? '700' : '400',
                    }}>{new Date(d).getDate()}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
        <View style={[st.stats, { borderTopColor: c.line }]} testID="cal-stats">
          <Stat value={f.num(cal.workouts, 0)} label={tr('Workouts')} />
          <Stat value={f.num(cal.daysTrained, 0)} label={tr('Days trained')} />
          <Stat value={hm(cal.time)} label={tr('Time')} />
        </View>
      </View>
      {sel !== null && (
        <>
          {/* the same rows as the list; the heading already says the day */}
          <SectionHeader title={f.date.full(sel)} style={{ marginTop: SPACE.s6 }} testID="cal-day" />
          {selected.map((w, i) => <WorkoutRow key={w.id} w={w} s={s} f={f} first={i === 0} day={false} />)}
        </>
      )}
      {sel === null && cal.workouts > 0 && (
        <Txt tone="ink2" style={[TYPE.footnote, { textAlign: 'center', marginTop: SPACE.s4, paddingHorizontal: SPACE.s4 }]} testID="cal-hint">{tr('Tap a highlighted day to see that workout.')}</Txt>
      )}
    </View>
  );
}

function MonthButton({ icon, label, onPress, testID }: { icon: 'chevron' | 'chevronLeft'; label: string; onPress: () => void; testID: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={({ pressed }) => [st.monthBtn, { backgroundColor: pressed ? c.surface3 : 'transparent' }]}>
      <Icon name={icon} size={17} color={c.accentText} />
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Txt style={[TYPE.title3, { fontVariant: ['tabular-nums'] }]}>{value}</Txt>
      <Txt tone="ink2" style={TYPE.caption}>{label}</Txt>
    </View>
  );
}

/**
 * One finished workout: the same set strokes and record sets as its detail page.
 * In the calendar the day is the heading above, so the row leaves it out (`day={false}`).
 */
function WorkoutRow({ w, s, f, first, day = true }: { w: Workout; s: State; f: Format & { tr: (t: string, v?: Record<string, string | number>) => string }; first: boolean; day?: boolean }) {
  const { colors: t } = useTally();
  const { tr } = f;
  const prs = stats(s).prsByWorkout.get(w.id) || [];
  const recordSets = new Set<string>(prs.map((p: { setId: string }) => p.setId));
  const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
  const tallyLine = [f.plural(sets, 'set'), recordSets.size ? f.plural(recordSets.size, 'record') : ''].filter(Boolean).join(' · ');
  const vol = workoutVolume(w, s.exercises);
  const meta = [day ? f.date.workoutDay(w.startedAt) : '', hm((w.endedAt || w.startedAt) - w.startedAt), vol > 0 ? f.volume(vol) : ''].filter(Boolean).join(' · ');
  // Exact variations, each once, so history says which equipment was used.
  const exercises = [...new Set(w.exercises.map((e) => f.exName(s.exercises.get(e.exerciseId)) || tr('Unknown exercise')))].join(', ');
  return (
    <ListRow first={first}
      title={<Text style={[TYPE.headline, { color: t.ink }]} numberOfLines={2}>{w.name}</Text>}
      subtitle={<Text style={[TYPE.footnote, { color: t.ink2, fontVariant: ['tabular-nums'] }]} numberOfLines={1} testID={`history-meta-${w.id}`}>{meta}</Text>}
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })} testID={`workout-${w.id}`}
      accessibilityLabel={[w.name, meta, tallyLine, exercises].filter(Boolean).join('. ')}>
      <View style={{ gap: SPACE.s2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <WorkoutTally groups={workoutStrokes(w, recordSets)} size="regular" label={tallyLine} testID={`history-tally-${w.id}`} />
          </View>
          {recordSets.size > 0 && <Text style={[TYPE.footnote, { color: t.ink2, fontVariant: ['tabular-nums'] }]} testID={`history-records-${w.id}`}>{f.plural(recordSets.size, 'record')}</Text>}
        </View>
        {!!exercises && <Text style={[TYPE.subhead, { color: t.ink2 }]} testID={`history-exercises-${w.id}`}>{exercises}</Text>}
      </View>
    </ListRow>
  );
}

const st = StyleSheet.create({
  cal: { borderRadius: 14, padding: 12 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  monthBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', paddingVertical: 4 },
  dayWrap: { flex: 1, padding: 2 },
  day: { aspectRatio: 1, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
