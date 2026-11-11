import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { load, reload, startEmpty, useAppState } from '@/data/store';
import { dateStamp, saveTextFile } from '@/lib/files';
import { useLang } from '@/lib/i18n';
import { confirm } from '@/lib/notice';
import { useNavigationTheme, usePalette } from '@/lib/theme';
import { Empty, Loading } from '@/ui/kit';
import { IncomingLinks } from '@/ui/IncomingLinks';
import { OverlayHost } from '@/ui/overlay';
import { SaveWarningFrame } from '@/ui/SaveWarning';
import { CapsuleButton } from '@/ui/tally/RestBar';
import { RestWatcher } from '@/ui/workout/Rest';

export { ErrorBoundary } from 'expo-router';

// A reload or link straight to a pushed screen (/search, /history) still has the tabs
// underneath, so Back leads to Today instead of a dead end.
export const unstable_settings = { anchor: '(tabs)' };

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

/**
 * Storage couldn't be read. Try again; for the browser's old data that can't
 * be read (#34): save it as a file, or start without it, deliberately.
 */
function LoadProblem({ error, unreadable }: { error: string; unreadable: string | null }) {
  const { tr } = useLang();
  const saveOld = () => saveTextFile(`increment-old-data-${dateStamp()}.json`, unreadable || '', 'application/json', 'public.json', tr('Save the old data'));
  const empty = async () => {
    if (await confirm(tr('Start without the old data?'), tr('It stays in this browser, untouched, but the app won’t show it. Save it as a file first.'), tr('Start empty'), tr('Cancel'), true)) startEmpty();
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center' }} testID="load-problem">
      <Empty title={unreadable ? tr('Your saved data can’t be read') : tr('Couldn’t load your data: {error}', { error })}
        text={unreadable ? tr('Nothing was changed or deleted. Save it as a file to keep it, then start without it.') : undefined}>
        <View style={{ gap: 12, alignItems: 'center' }}>
          {unreadable !== null && <CapsuleButton title={tr('Save the old data')} onPress={saveOld} testID="save-old-data" />}
          <CapsuleButton kind="secondary" title={tr('Try again')} onPress={reload} testID="load-retry" />
          {unreadable !== null && <CapsuleButton kind="secondary" title={tr('Start empty')} onPress={empty} testID="start-empty" />}
        </View>
      </Empty>
    </View>
  );
}

export default function RootLayout() {
  const { ready, error, unreadable } = useAppState();
  const theme = useNavigationTheme();
  const palette = usePalette();
  const { tr } = useLang();

  useEffect(() => { load(); }, []);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  // Web: the browser's bar (the status bar of the home-screen app on iPhone, Safari's
  // toolbar) takes the app theme's paper. The page's theme-color tags follow the phone's
  // light/dark setting, which left a black bar above a light theme on a dark phone.
  const paper = palette.colors.bg;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => { meta.removeAttribute('media'); meta.content = paper; });
    document.documentElement.style.backgroundColor = paper;
    document.body.style.backgroundColor = paper;
  }, [paper]);

  if (!ready) return <Loading />;
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={palette.scheme === 'dark' ? 'light' : 'dark'} />
      {error ? <LoadProblem error={error} unreadable={unreadable} /> : (
        <Column background={palette.colors.bg} overlay={<OverlayHost root />}>
          <SaveWarningFrame>
            <Stack screenOptions={{ headerTintColor: palette.colors.accentText, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerStyle: { backgroundColor: palette.colors.bg } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
              <Stack.Screen name="search" options={{ title: '' }} />
              {/* Progress → Workouts, Lifts, Records, Body */}
              <Stack.Screen name="history" options={{ title: tr('Workouts') }} />
              <Stack.Screen name="exercises" options={{ title: tr('Lifts') }} />
              <Stack.Screen name="records" options={{ title: tr('Records') }} />
              <Stack.Screen name="measure" options={{ title: tr('Body') }} />
              {/* the avatar on Today: name and settings in a sheet (Warm-up sets opens over it) */}
              {/* Done closes Account; the web header also needs an empty headerLeft to hide Back. */}
              <Stack.Screen name="account" options={{ presentation: 'modal', title: tr('Account'), headerBackVisible: false, headerLeft: () => null }} />
              <Stack.Screen name="warmup" options={{ title: tr('Warm-up sets') }} />
              <Stack.Screen name="strong-import" options={{ title: '' }} />
              <Stack.Screen name="workout/[id]" options={{ title: '' }} />
              <Stack.Screen name="template/[id]" options={{ title: '' }} />
              <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
              <Stack.Screen name="measure/[type]" options={{ title: '' }} />
              {/* editors: Cancel / Save in the bar; leaving with unsaved changes asks (useDiscardChanges) */}
              <Stack.Screen name="template-edit" options={{ title: '' }} />
              <Stack.Screen name="workout-edit/[id]" options={{ title: '' }} />
              {/* the running workout and what opens from it slide up over the app */}
              <Stack.Screen name="active" options={{ presentation: 'modal', headerShown: false, title: tr('Current workout') }} />
              <Stack.Screen name="pick-exercises" options={{ presentation: 'modal', headerShown: false, title: tr('Add exercises') }} />
              <Stack.Screen name="reorder" options={{ presentation: 'modal', headerShown: false, title: tr('Reorder') }} />
              <Stack.Screen name="summary/[id]" options={{ presentation: 'modal', headerShown: false, title: tr('Workout saved') }} />
              <Stack.Screen name="tools" options={{ presentation: 'modal', headerShown: false, title: tr('Tools') }} />
              <Stack.Screen name="exercise-form" options={{ presentation: 'modal', headerShown: false, title: tr('New exercise') }} />
            </Stack>
          </SaveWarningFrame>
          <RestWatcher />
          <IncomingLinks />
        </Column>
      )}
    </ThemeProvider>
  );
}
