// A routine's pinned note for next time (#33), at the top of the routine page
// and of a running workout from it: the pin, "Pinned note" and the text, in
// the style of an exercise's pinned note.
import { Text, View } from 'react-native';

import { SPACE, TYPE } from '@/design/tally';
import { useLang } from '@/lib/i18n';
import { useTally } from '@/lib/theme';
import { Icon } from './kit';

export function PinnedNote({ text, testID }: { text: string; testID?: string }) {
  const { tr } = useLang();
  const { colors: t } = useTally();
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: SPACE.s2, alignItems: 'flex-start' }}>
      <Icon name="pin" size={14} color={t.ink2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...TYPE.footnote, color: t.ink2 }}>{tr('Pinned note')}</Text>
        <Text style={{ ...TYPE.subhead, color: t.ink }}>{text}</Text>
      </View>
    </View>
  );
}
