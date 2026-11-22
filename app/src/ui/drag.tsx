// Dragging an item of a list into place (#137): the Reorder screen's rows,
// the exercises in the editors and the running workout. Press and hold (or
// the Reorder screen's ≡ handle) picks one up. The list folds to rows of one
// height, the held one follows the finger, the others slide out of the way,
// and near the top or bottom edge of the screen it scrolls. When the list
// folds, and when it unfolds after the drop, the scroll offset changes so
// the held item stays where it was on screen: at first a space above the
// list holds it there, and once the list has the finger (scrolling earlier
// would cancel the press) the screen scrolls by that space instead. A space
// below the list keeps the screen from scrolling back as the list gets
// shorter.
import {
  createContext, useLayoutEffect, useRef, useState, type RefObject,
} from 'react';
import {
  Animated, Keyboard, PanResponder,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance,
} from 'react-native';

import { haptic } from '@/lib/haptics';

export type DragApi = {
  /** press and hold: pick up the item with this id */
  begin: (id: string) => void;
  /** the press ended; without a move after the long press, that's the drop */
  release: (id: string) => void;
  /** VoiceOver and TalkBack: move one place up (-1) or down (1) */
  step: (id: string, by: number) => void;
  /** for a handle that keeps the finger itself (the Reorder screen's ≡) */
  move: (dy: number, pageY: number) => void;
  end: () => void;
};

/** The drag of the list an exercise block is in; null where it can't be dragged. */
export const DragContext = createContext<{ current: DragApi } | null>(null);

/** What the list needs from the screen's ScrollView: where it is, its size, and to stop it scrolling under the finger. */
export type ScrollHost = {
  ref: RefObject<ScrollViewInstance | null>;
  y: { current: number };
  viewH: { current: number };
  contentH: { current: number };
  lock: (on: boolean) => void;
};

/** A ScrollView that a list in it can drag in: spread `props` on it and give `host` to the list. */
export function useScrollHost(extra: {
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
} = {}) {
  const ref = useRef<ScrollViewInstance>(null);
  const y = useRef(0);
  const viewH = useRef(0);
  const contentH = useRef(0);
  const [locked, setLocked] = useState(false);
  const host = useRef<ScrollHost>({ ref, y, viewH, contentH, lock: setLocked }).current;
  const on = useRef(extra);
  on.current = extra;
  const props = useRef({
    ref,
    scrollEventThrottle: 16,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => { y.current = e.nativeEvent.contentOffset.y; on.current.onScroll?.(e); },
    onLayout: (e: LayoutChangeEvent) => { viewH.current = e.nativeEvent.layout.height; on.current.onLayout?.(e); },
    onContentSizeChange: (_w: number, h: number) => { contentH.current = h; },
  }).current;
  return { host, props: { ...props, scrollEnabled: !locked } };
}

type Drag = { from: number; over: number };
/** how close to the screen's top or bottom edge the finger scrolls it, and how fast (per frame) */
const EDGE = 72;
const SPEED = 9;
export const LIFTED = {
  shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
} as const;

/**
 * A list whose items can be dragged into place. `ids` are the items in order;
 * `indexOf` finds an item by another id (an exercise of a superset). Folded,
 * every item is `rowH` tall. `onDrop` makes the move (and returns true when
 * it scrolls the screen itself); `onFold` hears when the list folds and
 * unfolds. Spread `pan` on the list's view and `item(id, i, bg)` on each item.
 */
export function useDragList({
  ids, rowH, scroll, onDrop, onFold, indexOf,
}: {
  ids: string[];
  rowH: number;
  scroll?: ScrollHost | null;
  onDrop: (from: number, to: number) => boolean | void;
  onFold?: (on: boolean) => void;
  indexOf?: (id: string) => number;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [gap, setGap] = useState(0);
  const [tail, setTail] = useState(0);
  const dragRef = useRef<Drag | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  const latest = useRef({ ids, rowH, scroll, onDrop, onFold, indexOf });
  latest.current = { ids, rowH, scroll, onDrop, onFold, indexOf };
  // each item's height unfolded, so the scroll offset can follow the fold
  const heights = useRef(new Map<string, number>()).current;
  const g = useRef({
    dy: 0, pageY: 0, extra: 0, dir: 0, raf: 0, captured: false, folded: 0, gap: 0, tail: 0, dropGap: 0, maxUnfolded: 0,
    frame: null as { top: number; height: number } | null,
    pending: null as { kind: 'scroll'; to: number } | { kind: 'drop'; id: string; over: number } | null,
  }).current;

  const set = (d: Drag | null) => { dragRef.current = d; setDrag(d); };
  const space = (h: number) => { g.gap = h; setGap(h); };
  /** how far the screen scrolls while folded: the content then is `folded` plus the spaces above and below the list */
  const maxFolded = () => Math.max(0, g.folded + g.gap + g.tail - (latest.current.scroll?.viewH.current ?? 0));
  const index = (id: string) => (latest.current.indexOf ? latest.current.indexOf(id) : latest.current.ids.indexOf(id));
  const above = (list: string[], i: number) => list.slice(0, i).reduce((s, id) => s + (heights.get(id) || 0), 0);
  const scrollTo = (to: number) => {
    const s = latest.current.scroll;
    if (!s || to === s.y.current) return;
    s.y.current = to;
    s.ref.current?.scrollTo({ y: to, animated: false });
  };

  const api = useRef<DragApi>(null as unknown as DragApi);
  const update = () => {
    const d = dragRef.current;
    if (!d) return;
    const at = g.dy + g.extra;
    dy.setValue(at);
    const over = Math.max(0, Math.min(latest.current.ids.length - 1, Math.round(d.from + at / latest.current.rowH)));
    if (over !== d.over) { set({ ...d, over }); haptic.select(); }
  };
  // near an edge the screen scrolls, and the held item with it
  const tick = () => {
    g.raf = 0;
    const s = latest.current.scroll;
    if (!dragRef.current || !g.dir || !s) return;
    const to = Math.max(0, Math.min(maxFolded(), s.y.current + g.dir * SPEED));
    const by = to - s.y.current;
    if (!by) return;
    scrollTo(to);
    g.extra += by;
    update();
    g.raf = requestAnimationFrame(tick);
  };
  const stopScrolling = () => {
    g.dir = 0;
    if (g.raf) { cancelAnimationFrame(g.raf); g.raf = 0; }
  };
  api.current = api.current || {
    begin: (id) => {
      if (dragRef.current) return;
      const { ids: list, rowH: h, scroll: s } = latest.current;
      const i = index(id);
      if (i < 0 || list.length < 2) return;
      Keyboard.dismiss();
      Object.assign(g, { dy: 0, pageY: 0, extra: 0, captured: false, frame: null, pending: null });
      stopScrolling();
      dy.setValue(0);
      if (s) {
        g.maxUnfolded = Math.max(0, s.contentH.current - s.viewH.current);
        g.folded = s.contentH.current - above(list, list.length) + list.length * h;
        s.ref.current?.measureInWindow?.((_x: number, top: number, _w: number, height: number) => { g.frame = { top, height }; });
      }
      // the rows above it are shorter than the blocks were: a space keeps it in place
      space(Math.max(0, above(list, i) - i * h));
      // and one below, so the screen needn't scroll back up as the content gets shorter
      g.tail = s ? Math.max(0, s.y.current + s.viewH.current - g.folded - g.gap) : 0;
      setTail(g.tail);
      set({ from: i, over: i });
      latest.current.onFold?.(true);
      haptic.select();
    },
    release: (id) => {
      setTimeout(() => {
        const d = dragRef.current;
        if (d && !g.captured && index(id) === d.from) api.current.end();
      }, 0);
    },
    step: (id, by) => {
      const i = index(id);
      const j = i + by;
      if (i >= 0 && j >= 0 && j < latest.current.ids.length) latest.current.onDrop(i, j);
    },
    move: (d, pageY) => {
      if (!dragRef.current) return;
      g.dy = d;
      g.pageY = pageY;
      update();
      const f = g.frame;
      g.dir = !f ? 0 : pageY > f.top + f.height - EDGE ? 1 : pageY < f.top + EDGE ? -1 : 0;
      if (g.dir && !g.raf) g.raf = requestAnimationFrame(tick);
    },
    end: () => {
      const d = dragRef.current;
      g.captured = false;
      stopScrolling();
      if (!d) return;
      const id = latest.current.ids[d.from];
      const handled = d.over !== d.from ? latest.current.onDrop(d.from, d.over) : false;
      g.pending = latest.current.scroll && !handled ? { kind: 'drop', id, over: d.over } : null;
      dy.setValue(0);
      g.dropGap = g.gap;
      space(0);
      g.tail = 0;
      setTail(0);
      set(null);
      latest.current.onFold?.(false);
    },
  };

  // the list folded or unfolded: keep the held item where it was on screen
  const key = ids.join(' ');
  useLayoutEffect(() => {
    const p = g.pending;
    if (!p) return;
    if (p.kind === 'scroll' && drag) {
      g.pending = null;
      scrollTo(p.to);
    }
    if (p.kind === 'drop' && !drag && latest.current.ids.indexOf(p.id) === p.over) {
      g.pending = null;
      const y = latest.current.scroll?.y.current ?? 0;
      scrollTo(Math.max(0, Math.min(g.maxUnfolded, y + above(latest.current.ids, p.over) - p.over * latest.current.rowH - g.dropGap)));
    }
  }, [drag, gap, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // the list has the finger: trade the space above it for scrolling, as far as the screen goes
  const settle = () => {
    const s = latest.current.scroll;
    if (!s || !g.gap) return;
    const to = Math.max(0, s.y.current - g.gap);
    const by = s.y.current - to;
    if (!by) return;
    g.pending = { kind: 'scroll', to };
    space(g.gap - by);
  };

  // after the long press the list takes the finger (the pressed item can't: it folds away)
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => !!dragRef.current,
    onPanResponderGrant: () => { g.captured = true; settle(); },
    onPanResponderMove: (_, s) => api.current.move(s.dy, s.moveY),
    onPanResponderRelease: () => api.current.end(),
    onPanResponderTerminate: () => api.current.end(),
    onPanResponderTerminationRequest: () => false,
  })).current;

  const shift = (i: number) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.over && i > drag.from && i <= drag.over) return -rowH;
    if (drag.over < drag.from && i >= drag.over && i < drag.from) return rowH;
    return 0;
  };
  /** an item's wrapper (an Animated.View): its place while dragging, and its height for the fold */
  const item = (id: string, i: number, bg: string) => {
    const lifted = drag?.from === i;
    return {
      onLayout: (e: LayoutChangeEvent) => { if (!dragRef.current) heights.set(id, e.nativeEvent.layout.height); },
      style: [
        { zIndex: lifted ? 2 : 0, transform: [{ translateY: lifted ? dy : shift(i) }] },
        lifted ? { backgroundColor: bg, ...LIFTED } : null,
      ],
    };
  };
  return { drag, api, pan: pan.panHandlers, item, gap, tail };
}
