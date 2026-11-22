// One local reminder per due time; no repeats and no catch-up after a cold start.
import * as Notifications from 'expo-notifications';
import { allowed, setup, supported } from './notify';

const ID = 'log-reminder';
let seq = 0;

export async function scheduleLogReminder(at: number, title: string, body: string) {
  if (!supported) return;
  setup();
  const mine = ++seq;
  if (!(await allowed()) || mine !== seq) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(ID);
    if (mine !== seq || at <= Date.now() + 500) return;
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: { title, body, sound: true, data: { url: '/active' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
    });
  } catch {
    // The running workout still works when notifications aren't available.
  }
}

export async function cancelLogReminder() {
  if (!supported) return;
  seq++;
  try {
    // Also cancel a reminder left by a previous app process.
    await Notifications.cancelScheduledNotificationAsync(ID);
    await Notifications.dismissNotificationAsync(ID);
  } catch {
    // Nothing scheduled.
  }
}
