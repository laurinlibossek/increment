// A section of a page on its own `paper-2` card, its header inside at the top:
// where one section ends and the next begins is visible at a glance (Laurin,
// 22 Nov 2026). Rows inside keep their own margins and hairlines; the card clips
// their pressed fill to its corners. docs/design/components.md → SectionCard
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { SPACE } from '@/design/tally';
import { useTally } from '@/lib/theme';
import { CARD_GAP, OnCard, cardStyle } from './ground';
import { SectionHeader } from './SectionHeader';

type Props = {
  title?: string;
  scope?: string;
  action?: Parameters<typeof SectionHeader>[0]['action'];
  children: ReactNode;
  /** The first section under a title: no space above. */
  first?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  headerTestID?: string;
};

export function SectionCard({ title, scope, action, children, first, style, testID, headerTestID }: Props) {
  const { colors: t } = useTally();
  return (
    <View testID={testID} style={[cardStyle(t), { marginTop: first ? 0 : CARD_GAP, paddingTop: title ? SPACE.s4 : SPACE.s1, paddingBottom: SPACE.s3 }, style]}>
      <OnCard.Provider value>
        {!!title && <SectionHeader first title={title} scope={scope} action={action} testID={headerTestID} />}
        {children}
      </OnCard.Provider>
    </View>
  );
}
