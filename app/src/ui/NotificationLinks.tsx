// SDK 58's Expo Router pattern, mounted only once storage and the Stack are ready.
import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { getState } from '@/data/store';

export function NotificationLinks() {
  useEffect(() => {
    function redirect(response: Notifications.NotificationResponse) {
      const request = response.notification.request;
      if (request.identifier !== 'log-reminder' || request.content.data?.url !== '/active') return;
      Notifications.clearLastNotificationResponse();
      if (getState().active) router.push('/active');
    }
    const response = Notifications.getLastNotificationResponse();
    if (response) redirect(response);
    const subscription = Notifications.addNotificationResponseReceivedListener(redirect);
    return () => subscription.remove();
  }, []);
  return null;
}
