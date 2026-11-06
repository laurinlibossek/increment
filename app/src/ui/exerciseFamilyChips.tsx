// These choices navigate to sibling exercises; the page still shows one id.
import { router } from 'expo-router';
import { familyMemberGroups, familyOf, lastLoggedExercise } from '@increment/core';
import { View } from 'react-native';
import { allSessions, useAppState } from '@/data/store';
import type { Exercise } from '@/data/types';
import { SPACE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { ChoiceChips } from '@/ui/tally/ChoiceChips';

export function ExerciseFamilyChips({ exercise }: { exercise: Exercise }) {
  const s = useAppState(), f = useFormat();
  const groups = familyMemberGroups(familyOf(exercise), s.exercises);
  const selected = groups.find((g) => g.members.some((m) => m.exercise.id === exercise.id));
  const sessions = allSessions(s);
  const switchTo = (id: string) => { if (id !== exercise.id) router.setParams({ id }); };
  if (groups.reduce((n, g) => n + g.members.length, 0) < 2) return null;
  return <View style={{ gap: SPACE.s1, marginTop: SPACE.s4 }}>
    {groups.length > 1 && <ChoiceChips label={f.tr('Exercise')} testID="family-exercises" value={selected?.members[0].exercise.id || ''}
      options={groups.map((g) => ({ value: g.members[0].exercise.id, label: f.exBase(g.members[0].exercise) }))}
      onChange={(value) => {
        const group = groups.find((g) => g.members[0].exercise.id === value);
        if (group) switchTo(lastLoggedExercise(group.members.map((m) => m.exercise), sessions).id);
      }} />}
    {selected && selected.members.length > 1 && <ChoiceChips label={f.tr('Equipment')} testID="family-equipment" value={exercise.id}
      options={selected.members.map(({ exercise: ex }) => ({ value: ex.id,
        label: f.exEquipment(ex) || f.tr(ex.category === 'reps' || ex.category === 'duration' ? 'Bodyweight' : 'Unspecified') }))} onChange={switchTo} />}
  </View>;
}
