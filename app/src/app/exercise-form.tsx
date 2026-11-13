// Create a custom exercise (from the picker or the Exercises tab) or edit
// one: name, what it logs, body part and notes. Opened through
// editExercise() in lib/exerciseForm.ts.
import { useEffect, useRef, useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BODY_PARTS, CATEGORIES, CATEGORY_HELP, exerciseBaseName, exerciseFamily, familyOf, isUnilateral, loggedFields, shippedUnilateral, suggestExerciseFamily,
  usesDistance,
} from '@increment/core';

import {
  addExercise, allSessions, findExercise, getState, updateExercise, useAppSelector,
} from '@/data/store';
import type { Category } from '@/data/types';
import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { currentForm, finishForm } from '@/lib/exerciseForm';
import { useFormat } from '@/lib/format';
import { PICK_NONE, pickExercises } from '@/lib/picker';
import { useColors } from '@/lib/theme';
import {
  Cell, Field, Group, SectionTitle, Txt,
} from '@/ui/kit';
import { OverlayHost, ask, toast } from '@/ui/overlay';
import { ListRow } from '@/ui/tally/ListRow';
import { SwitchSettingRow } from '@/ui/tally/SettingRow';
import { couldntSave } from '@/lib/saving';

export default function ExerciseForm() {
  const f = useFormat();
  const { tr } = f;
  const c = useColors();
  const customFamilies = useAppSelector((s) => s.customFamilies);
  const insets = useSafeAreaInsets();
  const [form] = useState(() => currentForm());
  const ex = form?.id ? getState().exercises.get(form.id) || null : null;
  const [name, setName] = useState(ex?.name || form?.name || '');
  const [category, setCategory] = useState<Category>(ex?.category || 'machine');
  const [bodyPart, setBodyPart] = useState(ex?.bodyPart || 'chest');
  const [notes, setNotes] = useState(ex?.notes || '');
  // unilateral (#54): the ones we ship stay so; any other exercise is bilateral until turned on
  const locked = shippedUnilateral(ex);
  const [unilateral, setUnilateral] = useState(() => isUnilateral(ex));
  // Undefined means the person has not chosen; null is an explicit None.
  const [familySelection, setFamilySelection] = useState<string | null | undefined>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // closing the screen any other way counts as Cancel
  useEffect(() => () => { if (currentForm() === form) finishForm(null); }, [form]);

  const close = (saved: Parameters<typeof finishForm>[0]) => { finishForm(saved); router.back(); };
  const selectFamily = async () => {
    if (savingRef.current) return;
    const choice = familySelection === undefined ? familyOf(ex) : familySelection;
    const ids = await pickExercises({
      title: tr('Variation of'), allowCreate: false, familySelection: true, selected: choice || PICK_NONE,
      currentExerciseId: ex?.id, accepts: (candidate) => candidate.id !== ex?.id,
    });
    if (ids) setFamilySelection(ids[0] === PICK_NONE ? null : ids[0]);
  };
  const selectedExercise = typeof familySelection === 'string' ? getState().exercises.get(familySelection) : undefined;
  const family = exerciseFamily(familySelection === undefined ? familyOf(ex) : familySelection, customFamilies)
    || exerciseFamily(familyOf(selectedExercise), customFamilies);
  const familyName = family ? f.lang === 'de' ? family.nameDe : family.name
    : selectedExercise ? exerciseBaseName(selectedExercise, 'en') : tr('None');
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
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
      let selection = familySelection;
      if (!ex && selection === undefined) {
        const s = getState();
        const suggestion = suggestExerciseFamily(n, s.exercises, s.customFamilies);
        if (suggestion) {
          const label = suggestion.family ? f.lang === 'de' ? suggestion.family.nameDe : suggestion.family.name : f.exName(suggestion.exercise);
          const join = await ask({
            title: suggestion.family ? tr('Add to {name}?', { name: label }) : tr('Group with {name}?', { name: label }),
            message: tr('{name} becomes a variation of {family}. Its records and history stay its own.', {
              name: n, family: suggestion.family ? label : suggestion.name,
            }),
            ok: suggestion.family ? tr('Add to {name}', { name: label }) : tr('Group with {name}', { name: label }),
            cancel: tr('Keep separate'), testID: 'confirm-exercise-family',
          });
          selection = join ? suggestion.family?.id || suggestion.exercise.id : null;
        }
      }
      if (currentForm() !== form) return;
      // only `unilateral: true` is stored (bilateral is the default); cardio has no sides, so its choice stays; old side tags stay
      const sides = usesDistance(category) ? isUnilateral(ex) : unilateral;
      if (ex) {
        await updateExercise(ex.id, { name: n, category, bodyPart, notes, ...(locked ? {} : { unilateral: sides || undefined }) }, selection);
        close(getState().exercises.get(ex.id) || null);
      } else {
        close(await addExercise({ name: n, category, bodyPart, notes, unilateral: sides }, selection));
      }
    } catch (e) {
      couldntSave(tr, e);
    } finally {
      savingRef.current = false; setSaving(false);
    }
  };
  const top = Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.bar, { paddingTop: top + SPACE.s3 }]}>
        <Pressable onPress={() => close(null)} disabled={saving} hitSlop={SPACE.s2} accessibilityRole="button" testID="exercise-cancel" style={{ flex: 1 }}>
          <Text style={[TYPE.body, { color: c.accentText }]}>{tr('Cancel')}</Text>
        </Pressable>
        <Text style={[TYPE.headline, { color: c.ink }]}>{ex ? tr('Edit exercise') : tr('New exercise')}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Pressable onPress={save} disabled={saving} hitSlop={SPACE.s2} accessibilityRole="button" testID="exercise-save">
            <Text style={[TYPE.headline, { color: saving ? c.ink3 : c.accentText }]}>{tr('Save')}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACE.s5, paddingBottom: insets.bottom + SPACE.s8 }} keyboardShouldPersistTaps="handled">
        <Field label={tr('Name')} value={name} onChange={setName} placeholder={tr('e.g. Incline Row (Dumbbell)')} testID="exercise-name" />
        {!ex?.builtin && <View style={{ marginTop: SPACE.s4, marginHorizontal: -SPACE.s5 }}>
          <ListRow title={tr('Variation of')} trailing={familyName} chevron first onPress={selectFamily} testID="exercise-family" />
        </View>}
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
        {!usesDistance(category) && <View style={{ marginTop: SPACE.s6, marginHorizontal: -SPACE.s5 }}>
          <SwitchSettingRow first title={tr('Unilateral')}
            sub={locked ? tr('Always on for this exercise') : tr('Sets can say left or right; a left and a right set count as one set')}
            value={unilateral} onChange={setUnilateral} disabled={locked} testID="exercise-unilateral" />
        </View>}
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
