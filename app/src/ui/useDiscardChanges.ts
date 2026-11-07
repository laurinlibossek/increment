// Leaving a screen with unsaved changes asks first: Cancel, Back, the swipe
// back (on iOS it snaps back and the question appears) and Android's back.
// Without changes, the screen closes at once.
import { useState } from 'react';
import { router } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';

import { useLang } from '@/lib/i18n';
import { ask } from '@/ui/overlay';

/** Returns `leave()`, which closes the screen without asking (after Save). */
export function useDiscardChanges(changed: boolean) {
  const [leaving, setLeaving] = useState(false);
  const { tr } = useLang();
  // SDK 58: re-dispatching the blocked action while prevention is still on loops
  // (React error #185), so switch it off first, then repeat() the action.
  const disablePrevention = usePreventRemove(changed && !leaving, ({ repeat }) => {
    ask({
      title: tr('Discard changes?'), ok: tr('Discard'), cancel: tr('Keep editing'), destructive: true, testID: 'confirm-discard-changes',
    }).then((ok) => {
      if (!ok) return;
      setLeaving(true);
      repeat();
    });
  });
  return () => { setLeaving(true); disablePrevention(); router.back(); };
}
