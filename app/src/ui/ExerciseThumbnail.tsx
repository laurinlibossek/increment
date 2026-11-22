// A built-in's photo in a 56 pt tile (Open Exercise Illustrations, CC0, AI-generated;
// app/assets/exercise-photos/README.md), or, like Strong, the first letter of the
// displayed name for a custom exercise or a built-in without a photo (Laurin,
// 22 Nov 2026). Decorative: the row already says the name. docs/design/components.md
import { memo } from 'react';
import { Image, Text, View } from 'react-native';

import { RADIUS, TYPE } from '@/design/tally';
import { EXERCISE_PHOTOS } from '@/lib/exercisePhotos';
import { useTally } from '@/lib/theme';

export const EXERCISE_THUMBNAIL_SIZE = 56;

// This inner memo receives only primitives. useTally subscribes to settings, so
// unrelated settings can render the wrapper without touching the tile.
const Tile = memo(function Tile({ exerciseId, name, paper, ink }: { exerciseId: string; name: string; paper: string; ink: string }) {
  const photo = EXERCISE_PHOTOS[exerciseId];
  return <View testID={`exercise-thumbnail-${exerciseId}`} accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" aria-hidden pointerEvents="none"
    style={{ width: EXERCISE_THUMBNAIL_SIZE, height: EXERCISE_THUMBNAIL_SIZE, flexShrink: 0, borderRadius: RADIUS.m, overflow: 'hidden', backgroundColor: paper, alignItems: 'center', justifyContent: 'center' }}>
    {photo
      ? <Image source={photo} accessible={false} style={{ width: '100%', height: '100%' }} />
      : <Text maxFontSizeMultiplier={1} style={[TYPE.largeTitle, { color: ink }]}>{Array.from(name.trim())[0]?.toLocaleUpperCase()}</Text>}
  </View>;
});

/** Decorative, with the displayed (f.exName) name for the letter. */
export const ExerciseThumbnail = memo(function ExerciseThumbnail({ exerciseId, name }: { exerciseId: string; name: string }) {
  const { colors: t } = useTally();
  return <Tile exerciseId={exerciseId} name={name} paper={t.paper3} ink={t.ink} />;
});
