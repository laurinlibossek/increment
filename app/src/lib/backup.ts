// "Back up now": the whole log as one file through the share sheet (Save to
// Files, iCloud Drive…), the same format the web app writes and reads.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { backupText, markBackedUp } from '@/data/store';
import { toast } from '@/ui/overlay';
import { dateStamp, saveTextFile } from './files';
import type { Tr } from './i18n';

export const appVersion = () => Constants.expoConfig?.version || '';

export async function backupNow(tr: Tr) {
  const r = await saveTextFile(`increment-backup-${dateStamp()}.json`, backupText(appVersion()), 'application/json', 'public.json', tr('Back up now'));
  if (r === 'failed') { toast(tr('Couldn’t make the backup')); return; }
  // the file is made either way: storage failing may be why the person backs up
  markBackedUp().catch(() => {});
  toast(r === 'shared' ? tr('Backup ready') : tr('Backup downloaded'));
}

// Where the data lives and where to keep the backup file, said per platform
// (#42): iCloud Drive on iPhone, Google Drive on Android, and no "phone" or
// cloud named in the web app, which runs on computers too.

/** The backup reminder's second sentence (Progress). */
export const backupWhy = (tr: Tr) => Platform.select({
  ios: tr('It lives only on this phone — a backup file in iCloud Drive protects it if the phone is lost or reset.'),
  android: tr('It lives only on this phone — a backup file in Google Drive protects it if the phone is lost or reset.'),
  default: tr('It lives only in this browser on this device — a backup file kept in a safe place protects it if the browser’s data is cleared or the device is lost.'),
});

/** The line under Account's backup and import rows. */
export const storageNote = (tr: Tr) => Platform.select({
  ios: tr('Everything stays on this phone. Nothing is uploaded anywhere — back up regularly and keep the file in iCloud Drive or another safe place.'),
  android: tr('Everything stays on this phone. Nothing is uploaded anywhere — back up regularly and keep the file in Google Drive or another safe place.'),
  default: tr('Everything stays on this device. Nothing is uploaded anywhere — back up regularly and keep the file in a safe place.'),
});
