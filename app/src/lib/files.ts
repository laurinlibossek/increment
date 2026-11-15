// Handing a file to the user: the share sheet on the phone (Save to Files,
// AirDrop, Mail…), a download in a browser.
import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { pad2 } from '@increment/core';

/**
 * 'dismissed': the iPhone's share sheet was closed without saving or sending the
 * file (#85). Android's sheet and a browser download can't tell, so they say
 * 'shared' and 'downloaded' either way.
 */
export type SaveResult = 'shared' | 'downloaded' | 'dismissed' | 'failed';

export const dateStamp = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export async function saveTextFile(name: string, text: string, mime: string, uti: string, dialogTitle: string): Promise<SaveResult> {
  if (Platform.OS === 'web') {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }
  try {
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    await file.write(text);
    // React Native's own sheet on iPhone says whether the file went anywhere; expo-sharing's
    // resolves the same way when it is just closed. Android's can't share a file.
    if (Platform.OS === 'ios') {
      const r = await Share.share({ url: file.uri });
      return r.action === 'sharedAction' ? 'shared' : 'dismissed';
    }
    if (!(await Sharing.isAvailableAsync())) return 'failed';
    await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: uti, dialogTitle });
    return 'shared';
  } catch {
    return 'failed';
  }
}
