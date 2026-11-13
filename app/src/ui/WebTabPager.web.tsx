// One browser scroll container for all tab pages. Native scrolling owns the
// gesture, direction lock, momentum and snap, including touches on Pressables.
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  createBaseTabProps, createStandardRouterNavigator, TabRouter, unstable_useReconcileTabHistory, useIsFocused,
  type NavigatorContentProps,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RADIUS, SPACE } from '@/design/tally';
import { useTally } from '@/lib/theme';
import { SymbolIcon, type SymbolName } from '@/ui/tally/ListRow';
import { MiniBar } from '@/ui/workout/MiniBar';

// The page the bar highlights: the one mostly visible while the pager moves,
// separate from the settled route. Only the bar subscribes, so a swipe that
// crosses halfway re-renders the bar and not the pages.
type Shown = { get: () => number; set: (index: number) => void; subscribe: (listener: () => void) => () => void };
function createShown(initial: number): Shown {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (index) => { if (index !== value) { value = index; listeners.forEach((l) => l()); } },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

type PagerProps = NavigatorContentProps<
  { title?: string },
  { tabPress: { data: undefined; canPreventDefault: true } },
  object, ReturnType<typeof createBaseTabProps>
>;

function PagerContent({ state, routeNames, preload, descriptors, actions, emitter }: PagerProps) {
  unstable_useReconcileTabHistory();
  const focused = useIsFocused();
  const { colors: t } = useTally();
  const pagerRef = useRef<HTMLDivElement>(null);
  const touchingRef = useRef(false);
  // A bar tap shows its tab at once, not the pages its smooth scroll passes.
  const targetRef = useRef<number | null>(null);
  // SDK 58 registers tab routes on demand. Preload every declaration before
  // mounting the pager so all pages have real, stable route/descriptor keys.
  const routes = routeNames.flatMap((name) => state.routes.filter((r) => r.name === name));
  const ready = routes.length === routeNames.length;
  const selectedIndex = routes.findIndex((r) => r.key === state.routes[state.index]?.key);
  const [shown] = useState(() => createShown(Math.max(0, selectedIndex)));
  const pageAt = (pager: HTMLDivElement) => pager.clientWidth
    ? Math.min(routes.length - 1, Math.max(0, Math.round(pager.scrollLeft / pager.clientWidth)))
    : null;
  useLayoutEffect(() => {
    for (const name of routeNames) {
      if (!state.routes.some((r) => r.name === name)) preload(name);
    }
  }, [routeNames, state.routes, preload]);

  // Deep links, Back/Forward and router navigation select their page without
  // creating another history entry. A settle-triggered update is already here.
  useLayoutEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;
    const align = () => {
      targetRef.current = null;
      if (selectedIndex >= 0) shown.set(selectedIndex);
      if (pager.clientWidth) pager.scrollTo({ left: selectedIndex * pager.clientWidth, behavior: 'instant' });
    };
    align();
    let width = pager.clientWidth;
    const resize = new ResizeObserver(() => {
      if (pager.clientWidth !== width) {
        width = pager.clientWidth;
        align();
      }
    });
    resize.observe(pager);
    return () => resize.disconnect();
  }, [selectedIndex, ready, focused, shown]);

  const follow = useEffectEvent(() => {
    const pager = pagerRef.current;
    if (!pager) return;
    const index = pageAt(pager);
    const target = targetRef.current;
    if (target !== null && Math.abs(pager.scrollLeft - target * pager.clientWidth) > 1) return;
    targetRef.current = null;
    if (index !== null) shown.set(index);
  });

  const settle = useEffectEvent(() => {
    const pager = pagerRef.current;
    if (pager && !touchingRef.current) { targetRef.current = null; follow(); }
    if (!pager || !focused || touchingRef.current || !pager.clientWidth) return;
    const index = Math.round(pager.scrollLeft / pager.clientWidth);
    // A quiet moment while holding a half swipe isn't a settled page. Leave
    // snapping entirely to CSS; this only publishes its final selection.
    if (Math.abs(pager.scrollLeft - index * pager.clientWidth) > 1) return;
    const route = routes[index];
    if (route && index !== selectedIndex) actions.navigate(route.name);
  });

  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;
    const supportsScrollEnd = 'onscrollend' in pager;
    let quiet: ReturnType<typeof setTimeout>;
    const scroll = () => {
      clearTimeout(quiet);
      if (!supportsScrollEnd) quiet = setTimeout(settle, 150);
    };
    const start = () => { touchingRef.current = true; targetRef.current = null; clearTimeout(quiet); };
    const end = (e: TouchEvent) => {
      touchingRef.current = e.touches.length > 0;
      scroll();
    };
    // scrollend covers modern browsers; the quiet-scroll fallback also works
    // on older iPhone Safari. These passive listeners never claim the touch.
    const onEnd = (e: Event) => { if (e.target === pager) settle(); };
    const onScroll = (e: Event) => { if (e.target === pager) { follow(); scroll(); } };
    if (supportsScrollEnd) pager.addEventListener('scrollend', onEnd);
    pager.addEventListener('scroll', onScroll, { passive: true });
    pager.addEventListener('touchstart', start, { passive: true, capture: true });
    pager.addEventListener('touchend', end, { passive: true, capture: true });
    pager.addEventListener('touchcancel', end, { passive: true, capture: true });
    return () => {
      clearTimeout(quiet);
      pager.removeEventListener('scrollend', onEnd);
      pager.removeEventListener('scroll', onScroll);
      pager.removeEventListener('touchstart', start, true);
      pager.removeEventListener('touchend', end, true);
      pager.removeEventListener('touchcancel', end, true);
    };
  }, [ready]);

  const scrollToPage = (index: number) => {
    const pager = pagerRef.current;
    if (!pager) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pager.clientWidth && Math.abs(pager.scrollLeft - index * pager.clientWidth) > 1) {
      targetRef.current = index;
      shown.set(index);
    }
    pager.scrollTo({ left: index * pager.clientWidth, behavior: reduced ? 'instant' : 'smooth' });
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: t.paper }} />;
  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: t.paper }}>
      <style>{'.tab-pager::-webkit-scrollbar { display: none; }'}</style>
      <div ref={pagerRef} className="tab-pager" data-testid="tab-pager" style={{
        display: 'flex', flex: 1, minHeight: 0, width: '100%', overflowX: 'auto', overflowY: 'hidden',
        scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
      }}>
        {routes.map((route, index) => (
          <div key={route.key} id={`tab-page-${route.name}`} data-testid={`tab-page-${route.name}`}
            role="tabpanel" aria-hidden={index !== selectedIndex} inert={index !== selectedIndex}
            style={{ display: 'flex', flexDirection: 'column', flex: '0 0 100%', minWidth: 0, height: '100%', scrollSnapAlign: 'start' }}>
            {descriptors[route.key].render()}
          </div>
        ))}
      </div>
      <TabBar state={{ ...state, routes, index: selectedIndex }} shown={shown} descriptors={descriptors} emitter={emitter} scrollToPage={scrollToPage} />
    </View>
  );
}

// SDK 58's recommended helper uses TabRouter + withLayoutContext internally.
// Render every descriptor above rather than letting a tab view hide its peers.
export const WebTabs = createStandardRouterNavigator(PagerContent, TabRouter, { createProps: createBaseTabProps });
const ICON: Record<string, [SymbolName, SymbolName]> = {
  index: ['sun.max', 'sun.max.fill'],
  plan: ['list.bullet.rectangle.portrait', 'list.bullet.rectangle.portrait.fill'],
  progress: ['chart.line.uptrend.xyaxis', 'chart.line.uptrend.xyaxis'],
};
const BAR_H = 62;

function TabBar({ state, shown, descriptors, emitter, scrollToPage }: Pick<PagerProps, 'state' | 'descriptors' | 'emitter'> & {
  shown: Shown; scrollToPage: (index: number) => void;
}) {
  const { colors: t, scheme } = useTally();
  const shownIndex = useSyncExternalStore(shown.subscribe, shown.get, shown.get);
  const insets = useSafeAreaInsets();
  const float = {
    backgroundColor: t.paper2, borderWidth: 0.5, borderColor: t.line,
    shadowColor: '#000', shadowOpacity: scheme === 'dark' ? 0.5 : 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  };
  const tab = (route: (typeof state.routes)[number], index: number) => {
    const focused = shownIndex === index;
    const { options } = descriptors[route.key];
    const label = String(options.title ?? route.name);
    const press = () => {
      const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!e.defaultPrevented) scrollToPage(index);
    };
    const [icon, selected] = ICON[route.name] ?? ['ellipsis', 'ellipsis'];
    return (
      <Pressable key={route.key} onPress={press} testID={`tab-${route.name}`} accessibilityRole="tab" accessibilityState={{ selected: focused }}
        accessibilityLabel={label} aria-selected={focused} aria-controls={`tab-page-${route.name}`}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: RADIUS.capsule, backgroundColor: focused ? t.paper3 : 'transparent' }}>
        <SymbolIcon name={focused ? selected : icon} size={24} color={focused ? t.accent : t.ink2} />
        <Text style={{ fontSize: 11, lineHeight: 13, fontWeight: focused ? '600' : '500', color: focused ? t.accent : t.ink2 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ backgroundColor: t.paper, paddingHorizontal: SPACE.s4, paddingTop: SPACE.s2, paddingBottom: Math.max(insets.bottom, SPACE.s3), gap: 10 }}>
      <MiniBar />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 }} accessibilityRole="tablist">
        <View style={[{ flex: 1, flexDirection: 'row', height: BAR_H, padding: 4, borderRadius: RADIUS.capsule }, float]}>
          {state.routes.map(tab)}
        </View>
      </View>
    </View>
  );
}
