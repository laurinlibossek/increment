// Create a custom exercise (from the picker or the Exercises tab) or edit
// one: name, what it logs, body part and notes. Opened through
// editExercise() in lib/exerciseForm.ts.
import { useEffect, useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BODY_PARTS, CATEGORIES, CATEGORY_HELP, loggedFields,
} from '@increment/core';

import {
  addExercise, allSessions, findExercise, getState, updateExercise,
} from '@/data/store';
import type { Category } from '@/data/types';
import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { currentForm, finishForm } from '@/lib/exerciseForm';
import { useFormat } from '@/lib/format';
import { useColors } from '@/lib/theme';
import {
  Cell, Field, Group, SectionTitle, Txt,
} from '@/ui/kit';
import { OverlayHost, ask, toast } from '@/ui/overlay';

export default function ExerciseForm() {
  const f = useFormat();
  const { tr } = f;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [form] = useState(() => currentForm());
  const ex = form?.id ? getState().exercises.get(form.id) || null : null;
  const [name, setName] = useState(ex?.name || form?.name || '');
  const [category, setCategory] = useState<Category>(ex?.category || 'machine');
  const [bodyPart, setBodyPart] = useState(ex?.bodyPart || 'chest');
  const [notes, setNotes] = useState(ex?.notes || '');
  // closing the screen any other way counts as Cancel
  useEffect(() => () => { if (currentForm() === form) finishForm(null); }, [form]);

  const close = (saved: Parameters<typeof finishForm>[0]) => { finishForm(saved); router.back(); };
  const save = async () => {
    const n = name.trim();
    if (!n) { toast(tr('Give the exercise a name')); return; }
    const dupe = findExercise(n);
    if (dupe && dupe.id !== ex?.id) { toast(tr('“{name}” already exists', { name: dupe.name })); return; }
    const used = ex ? allSessions().get(ex.id)?.length || 0 : 0;
    if (ex && used && category !== ex.category) {
      const same = loggedFields(category).join() === loggedFields(ex.category).join();
      const ok = await ask({
        title: tr('Change what you log?'),
        message: same
          ? tr('“{name}” is in {n}. Their sets stay as they are, but records and volume are worked out the new way.', { name: ex.name, n: f.plural(used, 'workout') })
          : tr('“{name}” is in {n}, logged with other fields. Those sets may show up empty or incomplete afterwards.', { name: ex.name, n: f.plural(used, 'workout') }),
        ok: tr('Change'), cancel: tr('Cancel'), destructive: !same,
      });
      if (!ok) return;
    }
    if (ex) {
      await updateExercise(ex.id, { name: n, category, bodyPart, notes });
      close(getState().exercises.get(ex.id) || null);
    } else {
      close(await addExercise({ name: n, category, bodyPart, notes }));
    }
  };
  const top = Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.bar, { paddingTop: top + SPACE.s3 }]}>
        <Pressable onPress={() => close(null)} hitSlop={SPACE.s2} accessibilityRole="button" testID="exercise-cancel" style={{ flex: 1 }}>
          <Text style={[TYPE.body, { color: c.accentText }]}>{tr('Cancel')}</Text>
        </Pressable>
        <Text style={[TYPE.headline, { color: c.ink }]}>{ex ? tr('Edit exercise') : tr('New exercise')}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Pressable onPress={save} hitSlop={SPACE.s2} accessibilityRole="button" testID="exercise-save">
            <Text style={[TYPE.headline, { color: c.accentText }]}>{tr('Save')}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.s5, paddingBottom: insets.bottom + SPACE.s8 }} keyboardShouldPersistTaps="handled">
        <Field label={tr('Name')} value={name} onChange={setName} placeholder={tr('e.g. Incline Row (Dumbbell)')} testID="exercise-name" />
        <SectionTitle>{tr('What you log')}</SectionTitle>
        <Group>
          {(CATEGORIES as { id: Category; label: string }[]).map((x, i) => (
            <Cell key={x.id} first={i === 0} title={tr(x.label)} checked={category === x.id} onPress={() => setCategory(x.id)} testID={`cat-${x.id}`} />
          ))}
        </Group>
        <Txt tone="ink2" style={[TYPE.footnote, { marginTop: SPACE.s2, paddingHorizontal: SPACE.s1 }]} testID="exercise-category-help">{tr((CATEGORY_HELP as Record<string, string>)[category])}</Txt>
        <SectionTitle>{tr('Body part')}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 }}>
          {(BODY_PARTS as { id: string; label: string }[]).map((b) => {
            const on = bodyPart === b.id;
            return (
              <Pressable key={b.id} onPress={() => setBodyPart(b.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} testID={`part-${b.id}`}
                style={{ minHeight: CONTROL.hitMin, justifyContent: 'center', paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, borderRadius: RADIUS.capsule, backgroundColor: on ? c.chipOn : c.surface }}>
                <Text style={[TYPE.subhead, { color: on ? c.chipOnInk : c.ink2 }]}>{tr(b.label)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: SPACE.s6 }}>
          <Field label={tr('Notes')} value={notes} onChange={setNotes} placeholder={tr('Setup, cues, seat height…')} multiline testID="exercise-notes" />
        </View>
      </ScrollView>
      <OverlayHost />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.s5, paddingBottom: SPACE.s3, gap: SPACE.s2 },
});
