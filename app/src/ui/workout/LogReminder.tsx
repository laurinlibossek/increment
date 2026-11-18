import { useEffect } from 'react';
import { logReminderAt, workoutNameKey } from '@increment/core';
import { getState, useAppSelector } from '@/data/store';
import { useLang } from '@/lib/i18n';
import { cancelLogReminder, scheduleLogReminder } from '@/lib/logReminder';

export function LogReminderWatcher() {
  const due = useAppSelector((s) => logReminderAt(s.active));
  const enabled = useAppSelector((s) => s.settings.logReminder);
  const { tr } = useLang();
  useEffect(() => {
    if (!due || !enabled) { cancelLogReminder(); return; }
    const a = getState().active;
    if (!a) return;
    const name = a.name.trim() || tr(workoutNameKey(a.startedAt));
    scheduleLogReminder(due, tr('Don’t forget to log your set'), tr('{name} is still running.', { name }));
  }, [due, enabled]); // Renaming or changing language doesn't move the reminder.
  return null;
}
