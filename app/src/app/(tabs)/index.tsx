// Today: what to do now. The date, the routine that is up next (or the
// workout that's running) with its one Start button, a slot the store version can fill,
// this week's sessions and the sets per muscle of the last 7 days. The avatar
// opens Account. docs/design/navigation.md, phases.md → 2.
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { entryRepRange, routineSize, setsPerMuscle, weekStrip } from '@increment/core';

import { suggestion, useAppState } from '@/data/store';
import type { Template } from '@/data/types';
import { SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { useTally } from '@/lib/theme';
import { beginWorkout, openWorkout } from '@/lib/workout';
import { AccountButton } from '@/ui/tally/AccountButton';
import { MuscleVolume } from '@/ui/tally/MuscleVolume';
import { RoutineCard } from '@/ui/tally/RoutineCard';
import { SectionHeader } from '@/ui/tally/SectionHeader';
import { SearchButton } from '@/ui/tally/SearchButton';
import { TabRoot } from '@/ui/tally/TabRoot';
import type { StrokeState } from '@/ui/tally/Tally';
import { WeekStrip } from '@/ui/tally/WeekStrip';
import { useSessionView } from '@/ui/workout/MiniBar';
import { useToday } from '@/lib/useNow';

type Why = { kind: 'after' | 'weekday' | 'due'; name?: string; day?: number; at?: number };

export default function TodayTab() {
  const s = useAppState();
  const f = useFormat();
  const { tr } = f;
  const { locale } = useLang();
  const { colors: t } = useTally();
  const session = useSessionView();
  // the date, the week, the suggestion and the last seven days follow the day (#36)
  const today = useToday();
  const sug = useMemo(() => (s.active ? null : suggestion(s)), [s.templates, s.workouts, !s.active, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const goal = s.settings.weeklyGoal || 3;
  const week = useMemo(() => weekStrip(s.workouts, { weekStart: s.settings.weekStart, goal }) as {
    days: { start: number; done: number; planned: boolean }[]; today: number; done: number; goal: number;
  }, [s.workouts, s.settings.weekStart, goal, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const muscles = useMemo(() => setsPerMuscle(s.workouts, s.exercises) as { muscle: string; label: string; sets: number }[], [s.workouts, s.exercises, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const date = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(today);

  const why = (w: Why) => {
    if (w.kind === 'weekday') {
      const d = new Date(); d.setDate(d.getDate() + (((w.day ?? 0) - d.getDay() + 7) % 7));
      const day = f.date.weekdayLong(d.getTime());
      return tr('Usually on {days}', { days: f.lang === 'de' ? `${day.toLowerCase()}s` : `${day}s` });
    }
    if (w.kind === 'after') return tr('Usually after {name}', { name: w.name ?? '' });
    return tr('Last done {when}', { when: f.relDayLower(w.at ?? 0) });
  };

  let card;
  if (s.active && session) {
    const a = s.active;
    card = (
      <RoutineCard testID="now-card" context={tr('In progress · since {time}', { time: f.date.time(a.startedAt) })} name={a.name}
        tally={{ groups: session.groups, label: tr('{done} of {total} sets logged', { done: session.done, total: session.total }) }}
        facts={tr('{done} of {total} sets', { done: session.done, total: session.total }) + (session.records ? ` · ${f.plural(session.records, 'record')}` : '')}
        start={{ title: tr('Resume workout'), onPress: openWorkout, testID: 'resume-workout' }} />
    );
  } else if (sug) {
    const tpl = sug.template as Template;
    const entries = tpl.exercises.filter((e) => s.exercises.has(e.exerciseId));
    const size = routineSize(tpl, s.exercises, { defaultRest: s.settings.defaultRest, pair: s.settings.pairSides !== false }) as { exercises: number; sets: number; unpaired: number; minutes: number };
    const groups: StrokeState[][] = entries.map((e) => e.sets.map((x) => (x.type === 'warmup' ? 'warmupPending' : 'pending')));
    card = (
      <RoutineCard testID="up-next" context={`${tr('Up next')} · ${why(sug.why)}`} name={tpl.name}
        // with the range a routine prescribes for an exercise (#44): "Bench Press × 8–10"
        exercises={entries.map((e) => { const r = entryRepRange(e); return `${f.exName(s.exercises.get(e.exerciseId))}${r ? ` × ${r[0]}–${r[1]}` : ''}`; })}
        tally={{ groups, label: f.setsText(size) }}
        facts={[f.plural(size.exercises, 'exercise'), f.setsText(size), size.minutes ? tr('about {n} min', { n: size.minutes }) : ''].filter(Boolean).join(' · ')}
        onPress={() => router.push({ pathname: '/template/[id]', params: { id: tpl.id } })}
        start={{ title: tr('Start'), onPress: () => beginWorkout({ template: tpl }, f), testID: 'start-suggested' }} />
    );
  } else {
    card = (
      <RoutineCard testID="up-next" context={tr('Up next')} name={tr('Empty workout')}
        facts={tr('Add exercises as you go, or start a routine from Plan.')}
        start={{ title: tr('Start an empty workout'), onPress: () => beginWorkout({}, f), testID: 'start-empty' }} />
    );
  }

  const scope = tr('{done} of {goal} sessions', { done: week.done, goal });
  return (
    <TabRoot title={tr('Today')} eyebrow={date} right={<><SearchButton tab="index" /><AccountButton tab="index" /></>}>
      <View style={{ paddingHorizontal: SPACE.s5 }}>{card}</View>

      {/* An empty slot the store version can fill (docs/design/phases.md, phase 7). */}

      <SectionHeader title={tr('This week')} scope={scope} testID="week-head" />
      <WeekStrip testID="week-strip" today={week.today} label={`${tr('This week')}: ${scope}`}
        days={week.days.map((d) => ({ ...d, letter: f.date.weekdayNarrow(d.start) }))} />

      <SectionHeader title={tr('Sets per muscle')} scope={tr('Last 7 days')} />
      {muscles.length ? (
        <MuscleVolume rows={muscles.map((m) => ({ ...m, label: tr(m.label) }))}
          accessibilityLabel={(r) => `${r.label}, ${f.plural(r.sets, 'set')}`} />
      ) : (
        <Text style={[TYPE.subhead, { color: t.ink2, paddingHorizontal: SPACE.s5 }]}>{tr('No sets in the last 7 days.')}</Text>
      )}
    </TabRoot>
  );
}
