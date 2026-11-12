import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { EXAMPLE_TEMPLATES, setTotal, usesWeight } from '@increment/core';

import { copyTemplate, useAppState } from '@/data/store';
import type { Template } from '@/data/types';
import { SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { useTally } from '@/lib/theme';
import { PinnedNote } from '@/ui/PinnedNote';
import { templateMenu } from '@/lib/templates';
import { readyText, routineReady } from '@/lib/workout';
import { Highlight } from '@/ui/tally/Highlight';
import { beginWorkout } from '@/lib/workout';
import {
  Empty, IconButton, Page,
} from '@/ui/kit';
import { toast } from '@/ui/overlay';
import { ActionBar } from '@/ui/tally/ActionBar';
import { ListRow } from '@/ui/tally/ListRow';
import { SectionHeader } from '@/ui/tally/SectionHeader';
import { attempt } from '@/lib/saving';

export default function TemplatePreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const f = useFormat();
  const { tr } = f;
  const { colors } = useTally();
  const [barHeight, setBarHeight] = useState(0);
  const own = s.templates.find((t) => t.id === id);
  const ex = !own && (EXAMPLE_TEMPLATES as Template[]).find((t) => t.id === id);
  const t: Template | undefined = own || (ex ? { ...ex, name: tr(ex.name), folder: tr(ex.folder || '') } : undefined);
  if (!t) return <Page><Stack.Screen options={{ title: '' }} /><Empty title={tr('Routine not found')} /></Page>;

  let at = 0;
  if (!t.example) {
    at = t.lastUsedAt || 0;
    if (!at) for (const w of s.workouts) if (w.templateId === t.id) { at = w.startedAt; break; }
  }
  const info = t.example
    ? `${tr('Example')} · ${t.folder}`
    : [t.archived ? tr('Archived') : '', t.folder, at ? tr('Last done {when}', { when: f.relDayLower(at) }) : tr('Not done yet')].filter(Boolean).join(' · ');
  const rows = t.exercises.filter((e) => s.exercises.has(e.exerciseId));
  // "Weight increase recommended" from the latest workout of this routine (#49)
  const readyList = routineReady(t);
  const ready = new Map(t.exercises.map((e, i) => [e, readyList[i]]));
  const menu = async () => {
    const r = await templateMenu(t, f);
    if (r === 'deleted' && router.canGoBack()) router.back();
  };
  const saveExample = async () => {
    const copy = await attempt(tr, copyTemplate(t, { name: t.name, folder: t.folder || '' }));
    if (!copy) return;
    toast(tr('“{name}” added to your routines', { name: copy.name }));
    router.replace({ pathname: '/template/[id]', params: { id: copy.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack.Screen options={{
        title: '',
        headerRight: t.example ? undefined : () => <IconButton icon="more" label={tr('Routine options')} onPress={menu} testID="template-options" />,
      }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: SPACE.s3, paddingBottom: barHeight + SPACE.s5 }} contentInsetAdjustmentBehavior="automatic" testID="template-scroll">
        <Text style={[TYPE.title1, { color: colors.ink, paddingHorizontal: SPACE.s5 }]} accessibilityRole="header" testID="template-title">{t.name}</Text>
        <Text style={[TYPE.footnote, { color: colors.ink2, paddingHorizontal: SPACE.s5, marginTop: SPACE.s1 }]}>{info}</Text>
        {!!t.pinnedNote && !t.example && <View style={{ paddingHorizontal: SPACE.s5, marginTop: SPACE.s4 }}><PinnedNote text={t.pinnedNote} testID="template-pinned" /></View>}
        {!!t.notes && <>
          <SectionHeader title={tr('Notes')} />
          <Text style={[TYPE.subhead, { color: colors.ink, paddingHorizontal: SPACE.s5 }]} testID="template-notes">{t.notes}</Text>
        </>}
        <SectionHeader title={tr('Exercises')} />
        {rows.map((e, i) => {
          const exr = s.exercises.get(e.exerciseId)!;
          const targets = e.sets.map((x) => {
            if (usesWeight(exr.category) && (x.w === undefined || x.w === null) && x.r) return f.reps(x);
            return x.w || x.r || x.t || x.d ? f.setText(x, exr.category, true) : null;
          }).filter(Boolean);
          const sub = f.plural(setTotal(e.sets), 'set')
            + (targets.length ? ' · ' + [...new Set(targets)].join(', ') : '')
            + (e.restSec ? ` · ${tr('rest {time}', { time: f.clock(e.restSec) })}` : '');
          const r = ready.get(e);
          return <ListRow key={i} first={i === 0} testID={`template-exercise-${i}`}
            title={<Text style={[TYPE.body, { color: colors.ink }]}>{f.exName(exr)}</Text>}
            subtitle={<>
              <Text style={[TYPE.footnote, { color: colors.ink2, fontVariant: ['tabular-nums'] }]}>{sub}</Text>
              {!!r && <View style={{ marginTop: SPACE.s1 }}><Highlight chip testID={`template-ready-${i}`}>{readyText(r, tr)}</Highlight></View>}
            </>} />;
        })}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <ActionBar testID="template-action-bar" onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)} state={{
          kind: 'primary', label: tr('Start workout'), onPress: () => beginWorkout({ template: t }, f), testID: 'start-template',
          secondary: t.example ? { label: tr('Add to my routines'), onPress: saveExample, testID: 'add-example' } : undefined,
        }} />
      </View>
    </View>
  );
}
