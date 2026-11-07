// The same Search entry in each tab title, independent of the tab navigator.
import { Pressable } from 'react-native';
import { router } from 'expo-router';

import { CONTROL, RADIUS } from '@/design/tally';
import { useLang } from '@/lib/i18n';
import { useTally } from '@/lib/theme';
import { SymbolIcon } from '@/ui/tally/ListRow';

export function SearchButton({ tab }: { tab: 'index' | 'plan' | 'progress' }) {
  const { tr } = useLang();
  const { colors: t } = useTally();
  return (
    <Pressable onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel={tr('Search')}
      testID={`open-search-${tab}`}
      style={({ pressed }) => ({ width: CONTROL.hitMin, height: CONTROL.hitMin, borderRadius: RADIUS.capsule,
        alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.paper3 : 'transparent' })}>
      <SymbolIcon name="magnifyingglass" size={22} color={t.ink} />
    </Pressable>
  );
}
