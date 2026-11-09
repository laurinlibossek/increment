import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import {
  GestureStateManager, VirtualGestureDetector, useManualGesture, useNativeGesture,
  usePanGesture, useSimultaneousGestures, type PanGesture,
} from 'react-native-gesture-handler';
import { adjacentTab, TAB_SWIPE, tabSwipeAtEdge, tabSwipeDirection } from '@increment/core';

import { ROOT_TABS, type RootTab } from '@/lib/tabs';

type SwipeControl = { pan: PanGesture; block: () => void };
const SwipeGesture = createContext<SwipeControl | null>(null);

/** Attaches to the existing ScrollView: no pager, moving content or extra view
 * between the native tab and its scroll view (insets/minimizing still work). */
export function TabSwipe({ tab, children }: { tab: RootTab; children: ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const enabled = pathname === ROOT_TABS.find((t) => t.name === tab)?.pathname;
  const startY = useRef(0);
  const maxY = useRef(0);
  const blocked = useRef(false);
  const scroll = useNativeGesture({});
  const pan = usePanGesture({
    enabled, runOnJS: true, disableReanimated: true,
    activeOffsetX: [-TAB_SWIPE.activate, TAB_SWIPE.activate],
    failOffsetY: [-TAB_SWIPE.vertical, TAB_SWIPE.vertical],
    maxPointers: 1,
    onBegin: (e) => {
      startY.current = e.absoluteY;
      maxY.current = 0;
      blocked.current = Platform.OS === 'web' && tabSwipeAtEdge(e.absoluteX, width);
      if (blocked.current) GestureStateManager.fail(e.handlerTag);
    },
    onTouchesDown: (e) => {
      if (e.numberOfTouches > 1) {
        blocked.current = true;
        GestureStateManager.fail(e.handlerTag);
      }
    },
    onTouchesMove: (e) => {
      const touch = e.allTouches[0];
      if (!touch) return;
      maxY.current = Math.max(maxY.current, Math.abs(touch.absoluteY - startY.current));
      // failOffsetY only applies before activation. A later vertical turn must
      // also abandon the shortcut, even if the finger returns to its start Y.
      if (blocked.current || maxY.current >= TAB_SWIPE.vertical) GestureStateManager.fail(e.handlerTag);
    },
    onDeactivate: (e) => {
      if (e.canceled || blocked.current || !enabled) return;
      const direction = tabSwipeDirection({ dx: e.translationX, dy: e.translationY, maxY: maxY.current, velocityX: e.velocityX });
      const next = adjacentTab(ROOT_TABS.map((t) => t.name), tab, direction);
      const route = ROOT_TABS.find((t) => t.name === next);
      if (route) router.navigate(route.href);
    },
  });
  // Vertical scrolling remains a native gesture. Neither recognizer needs to
  // beat the other to begin; our strict vertical limit gives scrolling priority.
  const gesture = useSimultaneousGestures(pan, scroll);
  return (
    <SwipeGesture.Provider value={{ pan, block: () => {
      blocked.current = true;
      GestureStateManager.fail(pan.handlerTag);
    } }}>
      <VirtualGestureDetector gesture={gesture} touchAction="pan-y">{children}</VirtualGestureDetector>
    </SwipeGesture.Provider>
  );
}

/** Excludes a horizontal control for the whole touch, including after leaving
 * its bounds. This gate never activates or takes the control's JS responder. */
export function TabSwipeBlock({ children }: { children: ReactNode }) {
  const control = useContext(SwipeGesture);
  if (!control) return children;
  return <SwipeBlock {...control}>{children}</SwipeBlock>;
}

function SwipeBlock({ pan, block, children }: SwipeControl & { children: ReactNode }) {
  const gate = useManualGesture({
    block: pan, runOnJS: true, disableReanimated: true, cancelsJSResponder: false,
    onTouchesDown: block,
    onTouchesMove: block,
    onTouchesUp: (e) => {
      block();
      GestureStateManager.fail(e.handlerTag);
    },
  });
  return <VirtualGestureDetector gesture={gate} touchAction="pan-y"><View collapsable={false}>{children}</View></VirtualGestureDetector>;
}
