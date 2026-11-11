// The Account avatar in Today's and Progress's titles, beside Search (#30):
// the name's initial, or the person symbol before a name is set. It opens the
// Account sheet. Today's keeps the test ID `open-account`; the others add their tab.
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';

import { useAppSelector } from '@/data/store';
import { RADIUS } from '@/design/tally';
import { useLang } from '@/lib/i18n';
import { useTally } from '@/lib/theme';
import { SymbolIcon } from '@/ui/tally/ListRow';

export function AccountButton({ tab }: { tab: 'index' | 'progress' }) {
  const { tr } = useLang();
  const { colors: t } = useTally();
  const name = useAppSelector((s) => s.profile.name).trim();
  return (
    <Pressable onPress={() => router.push('/account')} accessibilityRole="button" testID={tab === 'index' ? 'open-account' : `open-account-${tab}`}
      accessibilityLabel={name ? tr('Account, {name}', { name }) : tr('Account')} hitSlop={4}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: RADIUS.capsule, alignItems: 'center', justifyContent: 'center', backgroundColor: t.paper3, opacity: pressed ? 0.6 : 1 })}>
      {name
        ? <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{name.charAt(0).toUpperCase()}</Text>
        : <SymbolIcon name="person.crop.circle" size={20} color={t.ink} />}
    </Pressable>
  );
}
