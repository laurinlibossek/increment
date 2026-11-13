// The template editor: a new template, an existing one (?id=) or one made
// from a finished workout (?from=). Numbers entered here are targets; when
// the template is started, last time's numbers take priority.
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EDIT_MESSAGES, newEntries, templateDraft, isUnilateral } from '@increment/core';

import {
  editDraft, getState, patchDraft, previousSets, saveTemplateDraft, templateFolders, useAppSelector,
} from '@/data/store';
import type { TemplateDraft } from '@/data/types';
import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { pickExercises } from '@/lib/picker';
import { useColors } from '@/lib/theme';
import {
  Button, Empty, Field, HeaderButton, Txt,
} from '@/ui/kit';
import { toast } from '@/ui/overlay';
import { DraftBlocks, KeyboardDoneBar } from '@/ui/workout/DraftBlocks';
import { useEditor } from '@/ui/workout/useEditor';
import { attempt } from '@/lib/saving';

export default function TemplateEditScreen() {
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const f = useFormat();
  const { tr } = f;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { draft: d, leave } = useEditor<TemplateDraft>(() => {
    const s = getState();
    const template = id ? s.templates.find((t) => t.id === id) || null : null;
    if (id && !template) return null;
    return templateDraft({
      template, workout: !id && from ? s.workouts.find((w) => w.id === from) || null : null,
      settings: s.settings, hasExercise: (x: string) => s.exercises.has(x),
    }) as TemplateDraft;
  });
  const templates = useAppSelector((s) => s.templates);
  const meta = useAppSelector((s) => s.meta);
  const folders = useMemo(() => templateFolders(getState()), [templates, meta]);

  const save = async () => {
    const r = await attempt(tr, saveTemplateDraft());
    if (!r) return;
    // the core says "template"; the app calls them routines
    if (r.problem) { toast(r.problem === EDIT_MESSAGES.templateName ? tr('Give the routine a name') : tr(r.problem)); return; }
    toast(r.created ? tr('“{name}” created', { name: r.template!.name }) : tr('Routine saved'));
    leave();
  };
  const addExercises = async () => {
    const ids = await pickExercises({ multi: true, title: tr('Add exercises') });
    if (!ids) return;
    editDraft('edit', (x) => { x.exercises.push(...newEntries(ids, { previousSets: (eid: string) => previousSets(eid), kind: 'template', isUnilateral: (eid: string) => isUnilateral(getState().exercises.get(eid)) })); });
  };

  const header = (
    <Stack.Screen options={{
      title: id ? tr('Edit routine') : tr('New routine'),
      headerBackVisible: false,
      headerLeft: () => <HeaderButton title={tr('Cancel')} onPress={() => router.back()} testID="tpl-cancel" />,
      headerRight: () => (d ? <HeaderButton title={tr('Save')} strong onPress={save} testID="template-save" /> : null),
    }} />
  );
  if (!d) return <View style={{ flex: 1, backgroundColor: c.bg }}>{header}<Empty title={tr('Routine not found')} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SPACE.s4, paddingTop: SPACE.s3, paddingBottom: insets.bottom + SPACE.s12 }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={{ gap: SPACE.s3, paddingHorizontal: SPACE.s1 }}>
          <Field value={d.name} onChange={(v) => patchDraft('edit', { name: v })} placeholder={tr('Routine name')} big testID="tpl-name" />
          <Field value={d.folder} onChange={(v) => patchDraft('edit', { folder: v })} placeholder={tr('Folder (optional)')} testID="tpl-folder" />
          {folders.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.s2 }} keyboardShouldPersistTaps="handled">
              {folders.map((name) => {
                const on = d.folder.trim() === name;
                return (
                  <Pressable key={name} onPress={() => patchDraft('edit', { folder: on ? '' : name })} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ minHeight: CONTROL.hitMin, justifyContent: 'center', paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2, borderRadius: RADIUS.capsule, backgroundColor: on ? c.chipOn : c.surface }}>
                    <Text style={[TYPE.subhead, { color: on ? c.chipOnInk : c.ink2 }]}>{name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <Field value={d.notes} onChange={(v) => patchDraft('edit', { notes: v })} placeholder={tr('Notes (optional)')} multiline testID="tpl-notes" />
          <Field value={d.pinnedNote} onChange={(v) => patchDraft('edit', { pinnedNote: v })} placeholder={tr('Pin a note for next time (optional)')} multiline testID="tpl-pinned" />
        </View>
        <DraftBlocks draftKey="edit" mode="template" draft={d} />
        {!d.exercises.length && <Empty title={tr('Build your routine')} text={tr('Add the exercises and sets you want to repeat.')} />}
        <View style={{ marginTop: SPACE.s4 }}>
          <Button large kind="tinted" icon="plus" title={tr('Add exercises')} onPress={addExercises} testID="add-exercises" />
        </View>
        <Txt tone="ink2" style={[TYPE.footnote, { marginTop: SPACE.s3, paddingHorizontal: SPACE.s1 }]} testID="template-target-hint">
          {tr('Numbers you enter here are targets. When you start the routine, your actual numbers from last time take priority.')}
        </Txt>
      </ScrollView>
      <KeyboardDoneBar />
    </View>
  );
}
