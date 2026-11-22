// What a piece of content sits on: the page (`paper`) or a card (`paper-2`).
// Rows, charts and tallies read it, so they draw the same on both.
import { createContext, useContext } from 'react';
import type { ViewStyle } from 'react-native';

import { RADIUS, SPACE } from '@/design/tally';
import { useTally } from '@/lib/theme';

/** True inside a card: what draws in the ground's colour uses `paper-2` instead of `paper`. */
export const OnCard = createContext(false);

/** The colour under the content: `paper` on the page, `paper-2` on a card. */
export function useGround() {
  const { colors: t } = useTally();
  return useContext(OnCard) ? t.paper2 : t.paper;
}

/** A pressed row's fill: one step above its ground. */
export function usePressedFill() {
  const { colors: t } = useTally();
  return useContext(OnCard) ? t.paper3 : t.paper2;
}

/** A card's look: `paper-2`, `radius-l`, on the page margin; `paper-3` while pressed. */
export function cardStyle(t: { paper2: string; paper3: string }, pressed = false): ViewStyle {
  return { marginHorizontal: SPACE.s5, borderRadius: RADIUS.l, overflow: 'hidden', backgroundColor: pressed ? t.paper3 : t.paper2 };
}

/** Space between two section cards, and between cards that are one item each (workouts, routines). */
export const CARD_GAP = SPACE.s4;
export const ITEM_GAP = SPACE.s3;
