// A tab swipe is a shortcut, so scrolling and uncertain drags win. Distances
// are logical pixels (points on native); velocity is pixels per second.
export const TAB_SWIPE = Object.freeze({ activate: 25, vertical: 15, distance: 60, velocity: 700, edge: 24 });

export function tabSwipeDirection({ dx, dy = 0, maxY = Math.abs(dy), velocityX = 0 }) {
  const x = Math.abs(dx);
  const y = Math.max(Math.abs(dy), maxY);
  if (x < TAB_SWIPE.activate || y >= TAB_SWIPE.vertical || x < y * 3) return 0;
  const fling = Math.abs(velocityX) >= TAB_SWIPE.velocity && Math.sign(velocityX) === Math.sign(dx);
  return x >= TAB_SWIPE.distance || fling ? (dx < 0 ? 1 : -1) : 0;
}

/** A left swipe advances one tab. The end tabs never wrap around. */
export function adjacentTab(tabs, current, direction) {
  const index = tabs.indexOf(current);
  if (index < 0 || (direction !== 1 && direction !== -1)) return null;
  return tabs[index + direction] ?? null;
}

export function tabSwipeAtEdge(startX, width) {
  return startX < TAB_SWIPE.edge || startX > width - TAB_SWIPE.edge;
}
