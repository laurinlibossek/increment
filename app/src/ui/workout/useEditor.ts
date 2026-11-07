// The editing screens (template editor, Edit workout) keep their draft in the
// store while they are open, so the shared exercise blocks, the exercise
// picker and the reorder screen work on it like on the running workout.
// Leaving with unsaved changes asks first (useDiscardChanges).
import { useLayoutEffect, useState } from 'react';

import { closeEdit, openEdit, useAppSelector } from '@/data/store';
import type { EditDraft } from '@/data/types';
import { useDiscardChanges } from '@/ui/useDiscardChanges';

export function useEditor<D extends EditDraft>(make: () => D | null) {
  const [init] = useState(make);
  useLayoutEffect(() => {
    if (!init) return undefined;
    openEdit(init);
    return () => closeEdit(init.id);
  }, [init]);
  const cur = useAppSelector((s) => s.edit);
  const draft = (cur && init && cur.id === init.id ? cur : init) as D | null;
  const leave = useDiscardChanges(!!draft?.dirty);
  return { draft, leave };
}
