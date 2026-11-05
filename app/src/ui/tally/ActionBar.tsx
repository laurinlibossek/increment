// The main action in thumb reach (components.md, ActionBar): log the next set,
// rest or finish in the session; start a routine or log body weight on details.
// It sits on paper with a hairline on top, above the home indicator.
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPACE } from '@/design/tally';
import { useTally } from '@/lib/theme';
import { CapsuleButton, RestBar, type RestBarProps } from './RestBar';

export type ActionBarState =
  | { kind: 'log'; label: string; a11y?: string; onLog: () => void }
  | ({ kind: 'rest' } & RestBarProps)
  /** the exercise on screen is done but others aren't: go on to them */
  | { kind: 'next'; label: string; onNext: () => void }
  | { kind: 'finish'; label: string; onFinish: () => void }
  /** A detail screen's main action, with an optional supporting action. */
  | { kind: 'primary'; label: string; onPress: () => void; testID: string;
    secondary?: { label: string; onPress: () => void; testID: string } }
  /** an empty workout: add the first exercises */
  | { kind: 'add'; label: string; onAdd: () => void };

export function ActionBar({ state, testID = 'action-bar', onLayout }: { state: ActionBarState; testID?: string; onLayout?: (event: LayoutChangeEvent) => void }) {
  const { colors: t } = useTally();
  const insets = useSafeAreaInsets();
  let body;
  if (state.kind === 'rest') body = <RestBar {...state} />;
  else if (state.kind === 'log') body = <CapsuleButton block title={state.label} label={state.a11y} onPress={state.onLog} testID="log-set" />;
  else if (state.kind === 'next') body = <CapsuleButton block title={state.label} onPress={state.onNext} testID="next-exercise" />;
  else if (state.kind === 'finish') body = <CapsuleButton block title={state.label} onPress={state.onFinish} testID="finish-workout" />;
  else if (state.kind === 'primary') body = (
    <View style={{ gap: SPACE.s2 }}>
      <CapsuleButton block title={state.label} onPress={state.onPress} testID={state.testID} />
      {state.secondary && <CapsuleButton block kind="secondary" title={state.secondary.label} onPress={state.secondary.onPress} testID={state.secondary.testID} />}
    </View>
  );
  else body = <CapsuleButton block title={state.label} onPress={state.onAdd} testID="add-exercises" />;
  return (
    <View testID={testID} onLayout={onLayout} style={{
      backgroundColor: t.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line,
      paddingTop: SPACE.s3, paddingHorizontal: SPACE.s5, paddingBottom: Math.max(insets.bottom, SPACE.s4) + SPACE.s1,
    }}>
      {body}
    </View>
  );
}
