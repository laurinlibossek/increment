// Account → Import from Strong → review. No record is written until Import.
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { BODY_PARTS, BODY_PART_LABEL, CATEGORIES, CATEGORY_LABEL, canMergeExercises, exerciseFamily, strongExerciseFamily, strongImportProblems } from '@increment/core';

import { saveStrongImport, useAppState, type StrongChoice, type StrongChoices, type StrongReview } from '@/data/store';
import { SPACE, TYPE } from '@/design/tally';
import { currentStrongImport, closeStrongImport } from '@/lib/strongImport';
import { useFormat } from '@/lib/format';
import { notice } from '@/lib/notice';
import { pickExercises } from '@/lib/picker';
import { useTally } from '@/lib/theme';
import { Empty, Field, HeaderButton } from '@/ui/kit';
import { actionSheet, OverlayHost } from '@/ui/overlay';
import { useDiscardChanges } from '@/ui/useDiscardChanges';
import { ActionBar } from '@/ui/tally/ActionBar';
import { SettingRow } from '@/ui/tally/SettingRow';

type ReviewRow = StrongReview['review'][number];

function ExerciseReviewRow({ row, index, choice, change, problem }: {
  row: ReviewRow; index: number; choice?: StrongChoice; change: (choice: StrongChoice) => void; problem?: string;
}) {
  const { exercises, customFamilies } = useAppState();
  const { colors: t } = useTally();
  const f = useFormat(), { tr } = f;
  const newChoice = choice?.kind === 'new' ? choice : { kind: 'new' as const, name: row.name, category: row.category, bodyPart: row.bodyPart };
  const familyId = strongExerciseFamily(newChoice.name, exercises);
  // the catalogue's families and the person's own (Kelso Shrug (Band) → Kelso Shrug)
  const family = exerciseFamily(familyId, customFamilies);
  const picked = choice?.kind === 'existing' && !row.suggestions.some((s) => s.id === choice.exerciseId) ? exercises.get(choice.exerciseId) : undefined;
  const chooseExisting = async () => {
    const ids = await pickExercises({ title: tr('Use an existing exercise'), allowCreate: false,
      accepts: (ex) => row.categories.includes(ex.category) && canMergeExercises({ id: null, category: row.category }, ex) });
    if (ids?.[0]) change({ kind: 'existing', exerciseId: ids[0] });
  };
  const chooseField = async (field: 'category' | 'bodyPart') => {
    const options = field === 'category' ? CATEGORIES.filter((c) => row.categories.includes(c.id)) : BODY_PARTS;
    const value = await actionSheet<string>({
      title: tr(field === 'category' ? 'What you log' : 'Body part'),
      actions: options.map((o) => ({ label: tr(o.label), value: o.id, checked: newChoice[field] === o.id, testID: `strong-option-${o.id}` })),
    });
    if (value) change({ ...newChoice, [field]: value });
  };
  return (
    <View testID={`strong-row-${index}`} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line, paddingVertical: SPACE.s4 }}>
      <View style={{ paddingHorizontal: SPACE.s5, gap: SPACE.s1, marginBottom: SPACE.s2 }}>
        <Text style={[TYPE.title3, { color: t.ink }]}>{row.name}</Text>
        <Text style={[TYPE.footnote, { color: t.ink2 }]}>{tr(row.sessions === 1 ? '1 session' : '{n} sessions', { n: row.sessions })}</Text>
      </View>
      {!!row.suggestions.length && <Text style={[TYPE.footnote, { color: t.ink2, paddingHorizontal: SPACE.s5, paddingVertical: SPACE.s2 }]}>{tr('Use an existing exercise')}</Text>}
      {row.suggestions.map((suggestion, i) => {
        const ex = exercises.get(suggestion.id);
        return ex && <SettingRow key={ex.id} title={f.exName(ex)} first={i === 0} checked={choice?.kind === 'existing' && choice.exerciseId === ex.id}
          onPress={() => change({ kind: 'existing', exerciseId: ex.id })} testID={`strong-use-${index}-${ex.id}`} />;
      })}
      <SettingRow title={picked ? f.exName(picked) : tr('Choose another exercise')} checked={picked ? true : undefined}
        onPress={chooseExisting} testID={`strong-choose-${index}`} />
      <SettingRow title={tr('Create new')} first={!row.suggestions.length} checked={choice?.kind === 'new'}
        onPress={() => change(newChoice)} testID={`strong-new-${index}`} />
      {choice?.kind === 'new' && <>
        <View style={{ paddingHorizontal: SPACE.s5, paddingVertical: SPACE.s3 }}>
          <Field label={tr('Name')} value={choice.name} onChange={(name) => change({ ...choice, name })} testID={`strong-name-${index}`} />
        </View>
        <SettingRow title={tr('What you log')} value={tr(CATEGORY_LABEL[choice.category as keyof typeof CATEGORY_LABEL])}
          onPress={() => chooseField('category')} testID={`strong-category-${index}`} />
        <SettingRow title={tr('Body part')} value={choice.bodyPart ? tr(BODY_PART_LABEL[choice.bodyPart as keyof typeof BODY_PART_LABEL]) : tr('Choose')}
          onPress={() => chooseField('bodyPart')} testID={`strong-body-${index}`} />
        {family && <Text testID={`strong-family-${index}`} style={[TYPE.footnote, { color: t.ink2, paddingHorizontal: SPACE.s5, paddingTop: SPACE.s3 }]}>
          {tr('Joins {family}', { family: f.lang === 'de' ? family.nameDe : family.name })}
        </Text>}
      </>}
      {problem && <Text testID={`strong-problem-${index}`} style={[TYPE.footnote, { color: t.ink2, paddingHorizontal: SPACE.s5, paddingTop: SPACE.s2 }]}>{tr(problem)}</Text>}
    </View>
  );
}

export default function StrongImportScreen() {
  const [preview] = useState(currentStrongImport);
  const { exercises } = useAppState();
  const { colors: t } = useTally();
  const f = useFormat(), { tr } = f;
  const [initial] = useState<StrongChoices>(() => Object.fromEntries((preview?.review || []).flatMap((r) => {
    const suggested = r.suggestions.find((s) => s.preselect);
    return suggested ? [[r.name, { kind: 'existing', exerciseId: suggested.id }]] : [];
  })));
  const [choices, setChoices] = useState(initial);
  // Leaving after a change asks first; the preselected suggestions alone are no change.
  const leave = useDiscardChanges(choices !== initial);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [barHeight, setBarHeight] = useState(0);
  useEffect(() => () => { if (preview) closeStrongImport(preview); }, [preview]);
  const close = () => { if (!saving.current) router.back(); };
  const problems = preview ? strongImportProblems(preview, choices, exercises) : [];
  const save = async () => {
    if (!preview || problems.length || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const stats = await saveStrongImport(preview, choices);
      closeStrongImport(preview);
      leave();
      notice(tr('Import from Strong'), stats.workouts ? tr('Imported {n}', { n: f.plural(stats.workouts, 'workout') })
        : stats.notesAdded ? tr('Notes added to {n}', { n: f.plural(stats.notesAdded, 'workout') })
          : tr('All {n} are already imported', { n: f.plural(stats.duplicates, 'workout') }));
    } catch (e) {
      notice(tr('Import from Strong'), tr('Couldn’t save the import. Your data has not changed.'));
    } finally { saving.current = false; setBusy(false); }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.paper }}>
      <Stack.Screen options={{ title: '', headerBackVisible: false, headerLeft: () => <HeaderButton title={tr('Cancel')} onPress={close} testID="strong-cancel" /> }} />
      {!preview ? <Empty title={tr('Pick a Strong export in Account to review its exercises')} /> : <>
        <ScrollView testID="strong-review" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: barHeight + SPACE.s6 }}>
          <View style={{ padding: SPACE.s5, gap: SPACE.s3 }}>
            <Text style={[TYPE.title1, { color: t.ink }]}>{tr('Review exercises')}</Text>
            <Text style={[TYPE.body, { color: t.ink }]} testID="strong-matched">{tr(preview.stats.matchedExercises === 1 ? '1 exercise matched' : '{n} exercises matched', { n: preview.stats.matchedExercises })}</Text>
            <Text style={[TYPE.footnote, { color: t.ink2 }]}>{f.plural(preview.stats.workouts, 'workout')}{' · '}{f.plural(preview.stats.sets, 'set')}</Text>
            {!!preview.stats.duplicates && <Text style={[TYPE.footnote, { color: t.ink2 }]}>{tr('{n} already in Increment will be skipped.', { n: f.plural(preview.stats.duplicates, 'workout') })}</Text>}
            {!!preview.review.length && <Text style={[TYPE.footnote, { color: t.ink2 }]}>{tr('Choose how to import each exercise. Your choices will be remembered.')}</Text>}
            {!!preview.review.length && <Text style={[TYPE.headline, { color: t.ink }]} testID="strong-decided">{tr('{done} of {total} decided', { done: preview.review.length - problems.length, total: preview.review.length })}</Text>}
          </View>
          {preview.review.map((row, i) => <ExerciseReviewRow key={row.name} row={row} index={i} choice={choices[row.name]}
            change={(choice) => setChoices((prev) => ({ ...prev, [row.name]: choice }))} problem={problems.find((p) => p.name === row.name)?.problem} />)}
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <ActionBar onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)} state={{ kind: 'primary', label: tr('Import'), onPress: save,
            disabled: busy || !!problems.length, testID: 'strong-confirm' }} />
        </View>
      </>}
      <OverlayHost />
    </KeyboardAvoidingView>
  );
}
