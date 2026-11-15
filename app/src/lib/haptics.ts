// Haptics (docs/design/motion.md), quietly: the web, a simulator and a phone
// without a motor reject, and a missed tick needs no handling at each call.
import * as Haptics from 'expo-haptics';

const quiet = (p: Promise<void>) => { p.catch(() => {}); };

export const haptic = {
  /** A light tap: a set logged, a rest ending. */
  tap: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A selection tick: a step on a scale, a row moved past another. */
  select: () => quiet(Haptics.selectionAsync()),
  /** A warning: delete, discard. */
  warn: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Success: a record. */
  success: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
