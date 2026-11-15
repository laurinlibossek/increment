import { View } from 'react-native';
import { BODY_PARTS, MUSCLES } from '@increment/core';
import { SPACE } from '@/design/tally';
import { useLang } from '@/lib/i18n';
import { ChoiceChips } from '@/ui/tally/ChoiceChips';

export function MuscleFilters({ region, muscle, onRegion, onMuscle, testID }: {
  region: string; muscle: string; onRegion: (value: string) => void; onMuscle: (value: string) => void; testID: string;
}) {
  const { tr } = useLang();
  const muscles = MUSCLES.filter((m) => m.region === region);
  const all = { value: 'all', label: tr('All') };
  return <View style={{ gap: SPACE.s2 }}>
    <ChoiceChips label={tr('Body part')} testID={`${testID}-parts`} value={region}
      onChange={(value) => { onRegion(value); onMuscle('all'); }}
      options={[all, ...BODY_PARTS.map((r) => ({ value: r.id, label: tr(r.label) }))]} />
    {muscles.length > 1 && <ChoiceChips key={region} label={tr('Muscle')} testID={`${testID}-muscles`} value={muscle} onChange={onMuscle}
      options={[all, ...muscles.map((m) => ({ value: m.id, label: tr(m.label) }))]} />}
  </View>;
}
