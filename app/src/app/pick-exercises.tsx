// Ordinary picks expand families inline and return exercise ids. The exercise
// form's family selection also accepts a family row directly, or None.
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BODY_PARTS, BODY_PART_LABEL, familyOf } from '@increment/core';

import { allSessions, useAppSelector } from '@/data/store';
import type { Exercise } from '@/data/types';
import { CONTROL, SPACE, TYPE } from '@/design/tally';
import { exerciseBrowserRows, type ExerciseBrowseRow } from '@/lib/exerciseBrowser';
import { useFormat } from '@/lib/format';
import { editExercise } from '@/lib/exerciseForm';
import { currentPick, finishPick, PICK_NONE } from '@/lib/picker';
import { useTally } from '@/lib/theme';
import { Button, Empty, SearchField } from '@/ui/kit';
import { ChoiceChips } from '@/ui/tally/ChoiceChips';
import { ListRow, SymbolIcon } from '@/ui/tally/ListRow';

export default function PickExercises() {
  const exercises = useAppSelector((s) => s.exercises);
  const workouts = useAppSelector((s) => s.workouts);
  const customFamilies = useAppSelector((s) => s.customFamilies);
  const f = useFormat(), { tr } = f;
  const { colors: t } = useTally();
  const insets = useSafeAreaInsets();
  const [pick] = useState(currentPick);
  const familySelection = !!pick?.familySelection;
  const multi = !familySelection && !!pick?.multi;
  const [q, setQ] = useState('');
  const [part, setPart] = useState('all');
  const [chosen, setChosen] = useState<string[]>([]);
  const current = pick?.currentExerciseId ? exercises.get(pick.currentExerciseId) : undefined;
  const currentFamily = familyOf(current);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(currentFamily ? [currentFamily] : []));
  const sessions = useMemo(() => allSessions(), [workouts]);
  useEffect(() => () => { finishPick(null, pick); }, [pick]);

  const list = useMemo(() => {
    const rows = exerciseBrowserRows(exercises, sessions, f, { query: q, part, accepts: pick?.accepts, customFamilies });
    if (!q.trim() && current) {
      const at = rows.findIndex((r) => r.id === currentFamily || r.id === current.id);
      if (at > 0) rows.unshift(...rows.splice(at, 1));
    }
    return rows;
  }, [exercises, sessions, f, q, part, pick, current, currentFamily, customFamilies]);
  const parts = [{ value: 'all', label: tr('All') }, ...BODY_PARTS.map((b) => ({ value: b.id, label: tr(b.label) }))];
  const done = (ids: string[] | null) => { finishPick(ids, pick); router.back(); };
  const tap = (id: string) => {
    if (!multi) { done([id]); return; }
    setChosen((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const create = async () => {
    const ex = await editExercise({ name: q.trim() });
    if (!ex) return;
    if (!multi) { done([ex.id]); return; }
    setChosen((cur) => [...cur, ex.id]);
    setQ(''); setPart('all');
  };
  const toggle = (id: string) => setExpanded((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const version = (ex: Exercise, first = false, nested = false, title = f.exName(ex), summary?: string) => {
    const on = chosen.includes(ex.id), picked = familySelection && pick?.selected === ex.id, isCurrent = current?.id === ex.id;
    const lastAt = sessions.get(ex.id)?.[0]?.startedAt;
    const facts = summary ?? [tr(BODY_PART_LABEL[ex.bodyPart as keyof typeof BODY_PART_LABEL] || 'Other'), lastAt ? f.relDayLower(lastAt) : ''].filter(Boolean).join(' · ');
    const subtitle = [facts, isCurrent ? tr('Current exercise') : ''].filter(Boolean).join(' · ');
    return <Pressable key={ex.id} onPress={() => tap(ex.id)} accessibilityRole={multi ? 'checkbox' : familySelection ? 'radio' : 'button'} aria-checked={multi ? on : familySelection ? picked : undefined}
      aria-current={isCurrent || undefined} testID={`pick-${ex.id}`} style={({ pressed }) => ({ backgroundColor: on ? t.paper3 : pressed ? t.paper2 : t.paper })}>
      <View style={{ minHeight: CONTROL.rowH, paddingVertical: SPACE.s3, paddingLeft: nested ? SPACE.s8 : SPACE.s5, paddingRight: SPACE.s5, flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 }}>
        {!first && <View style={{ position: 'absolute', top: 0, left: nested ? SPACE.s8 : SPACE.s5, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />}
        <View style={{ flex: 1, minWidth: 0, gap: SPACE.s1 }}>
          <Text style={[TYPE.body, { color: t.ink }]}>{title}</Text>
          <Text style={[TYPE.footnote, { color: t.ink2 }]}>{subtitle}</Text>
        </View>
        {(on || picked) && <SymbolIcon name="checkmark" size={18} color={t.ink} />}
      </View>
    </Pressable>;
  };
  const tick = (on: boolean) => (on ? <SymbolIcon name="checkmark" size={18} color={t.ink} /> : undefined);
  const renderRow = (row: ExerciseBrowseRow, index: number) => {
    // Choosing, not opening: the current family is ticked and no row has a chevron.
    if (familySelection && row.family) return <ListRow title={<Text style={[TYPE.body, { color: t.ink }]}>{row.title}</Text>}
      subtitle={<Text style={[TYPE.footnote, { color: t.ink2 }]}>{row.subtitle}</Text>} checked={pick?.selected === row.id} right={tick(pick?.selected === row.id)}
      onPress={() => done([row.id])} testID={`pick-family-${row.id}`} />;
    if (!row.family || row.members.length === 1) return version(row.members[0], index === 0 && !familySelection, false, row.title, row.subtitle);
    const open = expanded.has(row.id);
    return <View>
      <ListRow first={index === 0} title={<Text style={[TYPE.body, { color: t.ink }]}>{row.title}</Text>}
        subtitle={<Text style={[TYPE.footnote, { color: t.ink2 }]}>{row.subtitle}</Text>}
        onPress={() => toggle(row.id)} testID={`pick-family-${row.id}`}
        right={<SymbolIcon name={open ? 'chevron.down' : 'chevron.right'} size={16} color={t.ink2} />} />
      {open && <View testID={`pick-members-${row.id}`}>{row.members.map((ex, i) => version(ex, i === 0, true))}</View>}
    </View>;
  };
  return <View style={{ flex: 1, backgroundColor: t.paper }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.s5, paddingTop: (Platform.OS === 'ios' ? 0 : insets.top) + SPACE.s3, paddingBottom: SPACE.s3 }}>
      <Pressable onPress={() => done(null)} hitSlop={SPACE.s2} accessibilityRole="button" testID="pick-cancel" style={{ minHeight: CONTROL.hitMin, justifyContent: 'center' }}>
        <Text style={[TYPE.body, { color: t.ink }]}>{tr('Cancel')}</Text>
      </Pressable>
      {multi && <Pressable onPress={() => done(chosen)} disabled={!chosen.length} accessibilityRole="button" hitSlop={SPACE.s2} testID="pick-add" style={{ minHeight: CONTROL.hitMin, justifyContent: 'center' }}>
        <Text style={[TYPE.headline, { color: chosen.length ? t.ink : t.ink3 }]}>{chosen.length ? tr('Add {n}', { n: chosen.length }) : tr('Add')}</Text>
      </Pressable>}
    </View>
    <View style={{ paddingHorizontal: SPACE.s5, gap: SPACE.s3, paddingBottom: SPACE.s3 }}>
      <Text style={[TYPE.title1, { color: t.ink }]} testID="pick-title">{pick?.title || tr('Add exercises')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
        <View style={{ flex: 1 }}><SearchField value={q} onChange={setQ} placeholder={tr('Search')} testID="pick-search" /></View>
        {pick?.allowCreate !== false && <Pressable onPress={create} accessibilityRole="button" accessibilityLabel={tr('New exercise')} testID="pick-new" style={{ minHeight: CONTROL.hitMin, paddingHorizontal: SPACE.s3, justifyContent: 'center' }}>
          <SymbolIcon name="plus" color={t.ink} />
        </Pressable>}
      </View>
      <ChoiceChips label={tr('Body part')} testID="pick-parts" value={part} onChange={setPart} options={parts} />
    </View>
    <FlatList data={list} keyExtractor={(r) => r.id} renderItem={({ item, index }) => renderRow(item, index)}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={20}
      contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.s6 }}
      ListHeaderComponent={familySelection ? <ListRow title={tr('None')} first checked={pick?.selected === PICK_NONE} right={tick(pick?.selected === PICK_NONE)}
        onPress={() => done([PICK_NONE])} testID="pick-none" /> : undefined}
      ListEmptyComponent={<Empty title={q.trim() ? tr('No match for “{q}”', { q: q.trim() }) : tr('Nothing found')} text={pick?.allowCreate === false ? undefined : tr('Create it as your own exercise.')}>
        {pick?.allowCreate !== false && <Button kind="tinted" icon="plus" title={tr('Create “{name}”', { name: q.trim() || tr('new exercise') })} onPress={create} testID="pick-create" />}
      </Empty>} />
  </View>;
}
