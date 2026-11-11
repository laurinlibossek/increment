// The warning at the top of every screen while changes aren't saved (#34) or
// another tab changed what this one has waiting (#35). It stays until storage
// has everything; Retry, Back up now and Review are the ways forward. The
// screens below get the top safe-area inset taken off, since the warning
// already sits under the status bar (SaveWarningFrame).
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { retrySaves, useAppSelector } from '@/data/store';
import { SPACE, TYPE } from '@/design/tally';
import { backupNow } from '@/lib/backup';
import { useFormat } from '@/lib/format';
import { reviewConflicts } from '@/lib/saving';
import { useTally } from '@/lib/theme';
import { toast } from './overlay';
import { CapsuleButton } from './tally/RestBar';

const useShown = () => useAppSelector((s) => (s.conflicts.length ? 'conflict' : s.saveProblem ? 'unsaved' : null));

function SaveWarning({ top }: { top: number }) {
  const shown = useShown();
  const { colors: t } = useTally();
  const f = useFormat();
  const { tr } = f;
  if (!shown) return null;
  const retry = async () => { if (!(await retrySaves())) toast(tr('Still not saved')); };
  return (
    <View testID="save-warning" accessibilityRole="alert"
      style={[styles.bar, { paddingTop: top + SPACE.s2, backgroundColor: t.paper2, borderBottomColor: t.line }]}>
      <View style={styles.text}>
        <Text style={[TYPE.headline, { color: t.danger }]}>{shown === 'conflict' ? tr('Changed in another tab') : tr('Changes aren’t saved')}</Text>
        <Text style={[TYPE.footnote, { color: t.ink2 }]}>
          {shown === 'conflict' ? tr('Your changes are kept until you choose.') : tr('This device didn’t store the latest changes. They’re still here.')}
        </Text>
      </View>
      <View style={styles.actions}>
        {shown === 'conflict'
          ? <CapsuleButton small title={tr('Review')} onPress={() => reviewConflicts(f)} testID="conflict-review" />
          : <>
            <CapsuleButton small kind="secondary" title={tr('Back up now')} onPress={() => backupNow(tr)} testID="save-backup" />
            <CapsuleButton small title={tr('Retry')} onPress={retry} testID="save-retry" />
          </>}
      </View>
    </View>
  );
}

/** The warning above `children`, which then start below it rather than under the status bar. */
export function SaveWarningFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const shown = !!useShown();
  return (
    <>
      <SaveWarning top={insets.top} />
      <SafeAreaInsetsContext.Provider value={shown ? { ...insets, top: 0 } : insets}>{children}</SafeAreaInsetsContext.Provider>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.s3,
    paddingHorizontal: SPACE.s5, paddingBottom: SPACE.s3, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: 2 },
  actions: { flexDirection: 'row', gap: SPACE.s2, marginLeft: 'auto' },
});
