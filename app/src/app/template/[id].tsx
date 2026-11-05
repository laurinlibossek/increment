import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { EXAMPLE_TEMPLATES, usesWeight } from '@increment/core';

import { copyTemplate, useAppState } from '@/data/store';
import type { Template } from '@/data/types';
import { SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { useTally } from '@/lib/theme';
import { templateMenu } from '@/lib/templates';
import { beginWorkout } from '@/lib/workout';
import {
  Button, Empty, IconButton, Page,
} from '@/ui/kit';
import { toast } from '@/ui/overlay';
import { ListRow } from '@/ui/tally/ListRow';
import { SectionHeader } from '@/ui/tally/SectionHeader';

export default function TemplatePreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const f = useFormat();
  const { tr } = f;
  const { colors } = useTally();
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
  const menu = async () => {
    const r = await templateMenu(t, f);
    if (r === 'deleted' && router.canGoBack()) router.back();
  };
  const saveExample = async () => {
    const copy = await copyTemplate(t, { name: t.name, folder: t.folder || '' });
    toast(tr('“{name}” added to your routines', { name: copy.name }));
    router.replace({ pathname: '/template/[id]', params: { id: copy.id } });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingTop: SPACE.s3, paddingBottom: SPACE.s12 }} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{
        title: t.name,
        headerRight: t.example ? undefined : () => <IconButton icon="more" label={tr('Routine options')} onPress={menu} testID="template-options" />,
      }} />
      <Text style={[TYPE.footnote, { color: colors.ink2, paddingHorizontal: SPACE.s5 }]}>{info}</Text>
      {!!t.notes && <>
        <SectionHeader title={tr('Notes')} />
        <Text style={[TYPE.subhead, { color: colors.ink, paddingHorizontal: SPACE.s5 }]} testID="template-notes">{t.notes}</Text>
      </>}
      <SectionHeader title={tr('Exercises')} />
      {rows.map((e, i) => {
        const exr = s.exercises.get(e.exerciseId)!;
        const targets = e.sets.map((x) => {
          if (usesWeight(exr.category) && (x.w === undefined || x.w === null) && x.r) return f.plural(x.r, 'rep');
          return x.w || x.r || x.t || x.d ? f.setText(x, exr.category, true) : null;
        }).filter(Boolean);
        const sub = f.plural(e.sets.length, 'set')
          + (targets.length ? ' · ' + [...new Set(targets)].join(', ') : '')
          + (e.restSec ? ` · ${tr('rest {time}', { time: f.clock(e.restSec) })}` : '');
        return <ListRow key={i} first={i === 0} testID={`template-exercise-${i}`}
          title={<Text style={[TYPE.body, { color: colors.ink }]}>{f.exName(exr)}</Text>}
          subtitle={<Text style={[TYPE.footnote, { color: colors.ink2, fontVariant: ['tabular-nums'] }]}>{sub}</Text>} />;
      })}
      <View style={{ marginTop: SPACE.s5, gap: SPACE.s2, paddingHorizontal: SPACE.s5 }}>
        <Button large icon="play" title={tr('Start workout')} onPress={() => beginWorkout({ template: t }, f)} testID="start-template" />
        {t.example && <Button kind="tinted" title={tr('Add to my routines')} onPress={saveExample} testID="add-example" />}
      </View>
    </ScrollView>
  );
}
