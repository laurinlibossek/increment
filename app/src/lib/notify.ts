// Shared native notification handler, channels and permission ask.
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const supported = Platform.OS === 'ios' || Platform.OS === 'android';
export let setUp = false;
let asked = false;

export function setup() {
  if (setUp || !supported) return;
  setUp = true;
  Notifications.setNotificationHandler({
    // shown only when the app isn't in front (the open app buzzes by itself)
    handleNotification: async () => {
      const away = AppState.currentState !== 'active';
      return { shouldShowBanner: away, shouldShowList: away, shouldPlaySound: away, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('rest', {
      name: 'Rest timer', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250], sound: 'default',
    }).catch(() => {});
    Notifications.setNotificationChannelAsync('reminders', {
      name: 'Workout reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default',
    }).catch(() => {});
  }
}

/** May we notify? Asks once (normally at the first workout’s start). */
export async function allowed(): Promise<boolean> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
    if (asked || !p.canAskAgain) return false;
    asked = true;
    const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return r.granted;
  } catch {
    return false;
  }
}

