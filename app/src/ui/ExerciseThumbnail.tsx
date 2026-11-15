import { Fragment, memo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { exerciseDrawing, type Shape } from '@increment/core';

import { RADIUS, TYPE } from '@/design/tally';
import { useTally } from '@/lib/theme';

export const EXERCISE_THUMBNAIL_SIZE = 56;

function shapeElement(shape: Shape, key: number) {
  return shape.kind === 'path' ? <Path key={key} d={shape.d} /> : <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} />;
}

// This inner memo receives only primitives. useTally subscribes to settings, so
// unrelated settings can render the wrapper without rebuilding any SVG parts.
const Tile = memo(function Tile({ exerciseId, name, paper, ink, equipment }: {
  exerciseId: string; name: string; paper: string; ink: string; equipment: string;
}) {
  const drawing = exerciseDrawing(exerciseId);
  return <View testID={`exercise-thumbnail-${exerciseId}`} accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" aria-hidden pointerEvents="none"
    style={{ width: EXERCISE_THUMBNAIL_SIZE, height: EXERCISE_THUMBNAIL_SIZE, flexShrink: 0, borderRadius: RADIUS.m, overflow: 'hidden', backgroundColor: paper, alignItems: 'center', justifyContent: 'center' }}>
    {drawing ? <Svg width="100%" height="100%" viewBox="0 0 100 100" accessible={false} aria-hidden focusable={false}>
      <G stroke={equipment} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        {drawing.equipment.map(({ shape, solid }, i) => <G key={i} fill={solid ? equipment : 'none'}>{shapeElement(shape, i)}</G>)}
      </G>
      {drawing.parts.map((part, i) => <Fragment key={i}>
        <G fill={paper} stroke={paper} strokeWidth={3.5} strokeLinejoin="round">{part.map(shapeElement)}</G>
        <G fill={ink}>{part.map(shapeElement)}</G>
      </Fragment>)}
    </Svg> : <Text maxFontSizeMultiplier={1} style={[TYPE.largeTitle, { color: ink }]}>{Array.from(name.trim())[0]?.toLocaleUpperCase()}</Text>}
  </View>;
});

/** Decorative, with the displayed (f.exName) name for an undrawn exercise. */
export const ExerciseThumbnail = memo(function ExerciseThumbnail({ exerciseId, name }: { exerciseId: string; name: string }) {
  const { colors: t } = useTally();
  return <Tile exerciseId={exerciseId} name={name} paper={t.paper3} ink={t.ink} equipment={t.ink2} />;
});
