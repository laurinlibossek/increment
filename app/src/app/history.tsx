// Workouts (Progress → Workouts): finished workouts by month, or a month
// calendar (the button in the navigation bar switches). The calendar's maths
// is core's calendarMonth().
import { useMemo, useState } from 'react';
import {
  FlatList, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import {
  startOfMonth, startOfDay, addMonths, calendarMonth, workoutVolume, bestSet,
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
  Button, Card, Empty, Icon, IconButton, Txt,
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

/** A month of days with workouts highlighted; tap one to see its workouts below. */
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
    <View style={{ paddingHorizontal: 16 }}>
      <View style={[st.cal, { backgroundColor: c.surface }]}>
        <View style={st.calHead}>
          <MonthButton icon="chevronLeft" label={tr('Previous month')} onPress={() => go(-1)} testID="cal-prev" />
          <Txt style={{ fontSize: 17, fontWeight: '700' }} testID="cal-month">{f.date.monthYear(month)}</Txt>
          <MonthButton icon="chevron" label={tr('Next month')} onPress={() => go(1)} testID="cal-next" />
        </View>
        <View style={st.week}>
          {cal.days.slice(0, 7).map((d) => (
            <Text key={'w' + d} style={[st.wd, { color: c.ink3 }]}>{f.date.weekdayNarrow(d)}</Text>
          ))}
        </View>
        {weeks.map((wk) => (
          <View key={wk[0]} style={st.week}>
            {wk.map((d) => {
              const n = cal.byDay.get(d)?.length || 0;
              const out = d < cal.start || d >= cal.next;
              const on = sel === d;
              return (
                <View key={d} style={st.dayWrap}>
                  <Pressable onPress={() => setSel(n ? d : null)} testID={`cal-${dayKey(d)}`}
                    accessibilityRole="button" accessibilityState={{ selected: on }}
                    accessibilityLabel={n ? `${f.date.full(d)}, ${f.plural(n, 'workout')}` : f.date.full(d)}
                    style={[st.day, {
                      backgroundColor: n ? c.primary : 'transparent', opacity: out ? 0.3 : 1,
                      borderColor: on ? c.ink : 'transparent',
                    }]}>
                    <Text style={{
                      fontSize: 15, fontVariant: ['tabular-nums'],
                      color: n ? c.primaryInk : d === today ? c.accentText : c.ink2,
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
          <View style={[st.month, { paddingHorizontal: 4 }]}>
            <Txt style={{ fontSize: 20, fontWeight: '700' }}>{f.date.full(sel)}</Txt>
          </View>
          {selected.map((w) => <View key={w.id} style={{ marginBottom: 10 }}><WorkoutCard w={w} s={s} f={f} /></View>)}
        </>
      )}
      {sel === null && cal.workouts > 0 && (
        <Txt tone="ink3" style={{ fontSize: 13, textAlign: 'center', marginTop: 14 }}>{tr('Tap a highlighted day to see that workout.')}</Txt>
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
      <Txt style={{ fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Txt>
      <Txt tone="ink3" style={{ fontSize: 12 }}>{label}</Txt>
    </View>
  );
}

/** One finished workout: the same set strokes and record sets as its detail page. */
function WorkoutRow({ w, s, f, first }: { w: Workout; s: State; f: Format & { tr: (t: string, v?: Record<string, string | number>) => string }; first: boolean }) {
  const { colors: t } = useTally();
  const { tr } = f;
  const prs = stats(s).prsByWorkout.get(w.id) || [];
  const recordSets = new Set<string>(prs.map((p: { setId: string }) => p.setId));
  const sets = w.exercises.reduce((n, e) => n + e.sets.length, 0);
  const tallyLine = [f.plural(sets, 'set'), recordSets.size ? f.plural(recordSets.size, 'record') : ''].filter(Boolean).join(' · ');
  const vol = workoutVolume(w, s.exercises);
  const meta = [f.date.workoutDay(w.startedAt), hm((w.endedAt || w.startedAt) - w.startedAt), vol > 0 ? f.volume(vol) : ''].filter(Boolean).join(' · ');
  const exercises = w.exercises.map((e) => f.exName(s.exercises.get(e.exerciseId)) || tr('Unknown exercise')).join(', ');
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
        {!!exercises && <Text style={[TYPE.subhead, { color: t.ink2 }]} numberOfLines={1} testID={`history-exercises-${w.id}`}>{exercises}</Text>}
      </View>
    </ListRow>
  );
}

/** Calendar cards keep their layout; the list above uses Tally rows. */
export function WorkoutCard({ w, s, f }: { w: Workout; s: State; f: Format & { tr: (t: string, v?: Record<string, string | number>) => string } }) {
  const c = useColors();
  const { tr } = f;
  // record sets, as in the list and on the workout page (one set can break several records)
  const prs = new Set((stats(s).prsByWorkout.get(w.id) || []).map((p: { setId: string }) => p.setId)).size;
  const vol = workoutVolume(w, s.exercises);
  return (
    <Card onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })} testID={`workout-${w.id}`}>
      <Txt style={{ fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{w.name}</Txt>
      <Txt tone="ink3" style={{ fontSize: 13, marginTop: 2 }}>{`${f.date.medium(w.startedAt)} · ${f.date.time(w.startedAt)}`}</Txt>
      <View style={st.facts}>
        <Fact icon="clock" text={hm((w.endedAt || w.startedAt) - w.startedAt)} color={c.ink2} />
        {vol > 0 && <Fact icon="weight" text={f.volume(vol)} color={c.ink2} />}
        {prs > 0 && <Fact icon="trophy" text={f.plural(prs, 'record')} color={c.gold} />}
      </View>
      <View style={st.linesHead}>
        <Txt tone="ink3" style={st.head}>{tr('Exercise')}</Txt>
        <Txt tone="ink3" style={st.head}>{tr('Best set')}</Txt>
      </View>
      {w.exercises.slice(0, 6).map((e) => {
        const ex = s.exercises.get(e.exerciseId);
        const b = bestSet(e.sets, ex?.category, s.settings.formula);
        return (
          <View key={e.id} style={st.line}>
            <Txt tone="ink2" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>{`${e.sets.length} × ${f.exName(ex) || tr('Unknown exercise')}`}</Txt>
            <Txt tone="ink2" style={{ fontSize: 14, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{b ? f.setText(b, ex?.category) : ''}</Txt>
          </View>
        );
      })}
      {w.exercises.length > 6 && <Txt tone="ink3" style={{ fontSize: 13, marginTop: 4 }}>{tr('+ {n} more', { n: w.exercises.length - 6 })}</Txt>}
    </Card>
  );
}

function Fact({ icon, text, color }: { icon: 'clock' | 'weight' | 'trophy'; text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={13} color={color} />
      <Txt style={{ fontSize: 13, color }}>{text}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  month: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 14, marginBottom: 8 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  linesHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 2 },
  head: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  line: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  cal: { borderRadius: 14, padding: 12 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  monthBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', paddingVertical: 4 },
  dayWrap: { flex: 1, padding: 2 },
  day: { aspectRatio: 1, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
