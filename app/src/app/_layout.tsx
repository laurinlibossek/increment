import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { load, useAppState } from '@/data/store';
import { useLang } from '@/lib/i18n';
import { useNavigationTheme, usePalette } from '@/lib/theme';
import { Empty, Loading } from '@/ui/kit';
import { IncomingLinks } from '@/ui/IncomingLinks';
import { OverlayHost } from '@/ui/overlay';
import { RestWatcher } from '@/ui/workout/Rest';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** On the web, a wide window shows the phone layout as a centred column. */
const WEB_MAX_WIDTH = 600;

/** Dialogs and toasts (`overlay`) cover the whole window, not just the column. */
function Column({ background, overlay, children }: { background: string; overlay: React.ReactNode; children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <View style={{ flex: 1 }}>{children}{overlay}</View>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: background }}>
      <View style={{ flex: 1, width: '100%', maxWidth: WEB_MAX_WIDTH }}>{children}</View>
      {overlay}
    </View>
  );
}

export default function RootLayout() {
  const { ready, error } = useAppState();
  const theme = useNavigationTheme();
  const palette = usePalette();
  const { tr } = useLang();

  useEffect(() => { load(); }, []);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  if (!ready) return <Loading />;
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={palette.scheme === 'dark' ? 'light' : 'dark'} />
      {error ? <Empty title={tr('Couldn’t load your data: {error}', { error })} /> : (
        <Column background={palette.colors.bg} overlay={<OverlayHost root />}>
          <Stack screenOptions={{ headerTintColor: palette.colors.accentText, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerStyle: { backgroundColor: palette.colors.bg } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
            {/* Progress → Workouts, Lifts, Records, Body */}
            <Stack.Screen name="history" options={{ title: tr('Workouts') }} />
            <Stack.Screen name="exercises" options={{ title: tr('Lifts') }} />
            <Stack.Screen name="records" options={{ title: tr('Records') }} />
            <Stack.Screen name="measure" options={{ title: tr('Body') }} />
            {/* the avatar on Today: name and settings in a sheet (Warm-up sets opens over it) */}
            {/* Done closes Account; the web header also needs an empty headerLeft to hide Back. */}
            <Stack.Screen name="account" options={{ presentation: 'modal', title: tr('Account'), headerBackVisible: false, headerLeft: () => null }} />
            <Stack.Screen name="warmup" options={{ title: tr('Warm-up sets') }} />
            <Stack.Screen name="workout/[id]" options={{ title: '' }} />
            <Stack.Screen name="template/[id]" options={{ title: '' }} />
            <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
            <Stack.Screen name="measure/[type]" options={{ title: '' }} />
            {/* editors: Cancel / Save in the bar, no swipe-back past unsaved changes */}
            <Stack.Screen name="template-edit" options={{ title: '', gestureEnabled: false }} />
            <Stack.Screen name="workout-edit/[id]" options={{ title: '', gestureEnabled: false }} />
            {/* the running workout and what opens from it slide up over the app */}
            <Stack.Screen name="active" options={{ presentation: 'modal', headerShown: false, title: tr('Current workout') }} />
            <Stack.Screen name="pick-exercises" options={{ presentation: 'modal', headerShown: false, title: tr('Add exercises') }} />
            <Stack.Screen name="reorder" options={{ presentation: 'modal', headerShown: false, title: tr('Reorder') }} />
            <Stack.Screen name="summary/[id]" options={{ presentation: 'modal', headerShown: false, title: tr('Workout saved') }} />
            <Stack.Screen name="tools" options={{ presentation: 'modal', headerShown: false, title: tr('Tools') }} />
            <Stack.Screen name="exercise-form" options={{ presentation: 'modal', headerShown: false, title: tr('New exercise') }} />
          </Stack>
          <RestWatcher />
          <IncomingLinks />
        </Column>
      )}
    </ThemeProvider>
  );
}
