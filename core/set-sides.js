// Optional side metadata. Records, volume and tallies still count every row.
export const sideOf = (set) => set?.side === 'left' || set?.side === 'right' ? set.side : undefined;

/** Working sets for one exercise: bilateral rows plus the larger side count. */
export function workingSetCount(sets) {
  let left = 0, right = 0, both = 0;
  for (const set of sets) {
    if (set.type === 'warmup') continue;
    const side = sideOf(set);
    if (side === 'left') left++;
    else if (side === 'right') right++;
    else both++;
  }
  return both + Math.max(left, right);
}
