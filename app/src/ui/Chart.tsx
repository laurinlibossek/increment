// The column chart (weekly workouts on Progress): ink columns with dotted grid
// lines; touch a bar for its value. The goal's label sits at the start of its
// line: the end belongs to this week, whose number is always shown (#122).
// The line chart is the Tally one
// (ui/tally/LineChart.tsx). The axis maths is the shared core's (core/chart.js).
import { useState } from 'react';
import {
  Platform, StyleSheet, Text, View, type LayoutChangeEvent,
} from 'react-native';
import Svg, {
  G, Line, Path, Text as SvgText,
} from 'react-native-svg';
import { boxesOverlap, labelBox, niceTicks } from '@increment/core';

import { RADIUS, SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { useColors } from '@/lib/theme';
import { SVG_FONT as FONT } from '@/ui/tally/LineChart';

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

/** The value bubble over a touched point or bar. */
function Tip({ left, width, value, sub }: { left: number; width: number; value: string; sub: string }) {
  const c = useColors();
  const half = SPACE.s8 * 2;
  const x = Math.min(Math.max(left, half), width - half);
  return (
    <View pointerEvents="none" style={[styles.tip, { left: x - half, backgroundColor: c.chart }]} testID="chart-tip">
      <Text style={[TYPE.headline, { color: c.primaryInk, textAlign: 'center' }]} numberOfLines={1}>{value}</Text>
      <Text style={[TYPE.caption, { color: c.primaryInk, textAlign: 'center' }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

/** bars oldest first; `goal` draws a reference line */
export function BarChart({
  bars, height = SPACE.s12 * 4, goal = null, fmtVal = (v: number) => String(v), label, testID,
}: {
  bars: { label: string; value: number; title?: string }[]; height?: number; goal?: number | null; fmtVal?: (v: number) => string; label: string; testID?: string;
}) {
  const c = useColors();
  const { tr } = useFormat();
  const [width, onLayout] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const padL = SPACE.s8, padR = SPACE.s2, padT = SPACE.s6, padB = SPACE.s6;
  const W = Math.max(width, SPACE.s5 * 10), H = height;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, goal || 0, ...bars.map((b) => b.value));
  const ticks = niceTicks(0, max, 3, { zero: true });
  const top = ticks[ticks.length - 1];
  const sy = (v: number) => padT + ih - (v / top) * ih;
  const band = iw / bars.length;
  const bw = Math.min(SPACE.s6, band - SPACE.s1);
  const barPath = (x: number, v: number) => {
    const h = Math.max(0, (v / top) * ih);
    if (h <= 0) return '';
    const r = Math.min(RADIUS.s, h, bw / 2);
    const y = padT + ih - h, b = padT + ih;
    return `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${b}Z`;
  };
  const lastI = bars.length - 1;
  const every = Math.ceil(bars.length / 6);
  const pick = (px: number) => setSel(Math.max(0, Math.min(lastI, Math.floor((px - padL) / band))));
  const sb = sel !== null ? bars[sel] : null;
  const fs = TYPE.footnote.fontSize;
  const valueY = (v: number) => sy(v) - SPACE.s2;
  // the goal's label, at the start of its line; hidden while a touched week's
  // number would land on it (the bubble shows that number)
  const goalText = goal ? tr('Goal {n}', { n: goal }) : '';
  const goalBox = goal ? labelBox(goalText, padL, valueY(goal), fs) : null;
  const showGoal = !!goalBox && ![lastI, sel].some((i) => i !== null && bars[i]?.value > 0
    && boxesOverlap(goalBox, labelBox(fmtVal(bars[i].value), padL + band * i + band / 2, valueY(bars[i].value), fs, 'middle')));
  return (
    <View onLayout={onLayout} style={{ marginTop: SPACE.s3, ...(Platform.OS === 'web' ? { touchAction: 'pan-y' } : {}) }} testID={testID}
      accessible accessibilityRole="image" accessibilityLabel={`${label}: ${bars.length ? fmtVal(bars[lastI].value) : ''}`}
      onStartShouldSetResponder={() => true} onResponderGrant={(e) => pick(e.nativeEvent.locationX)} onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      onResponderRelease={() => setTimeout(() => setSel(null), 1600)} onResponderTerminationRequest={() => true}>
      {width > 0 && (
        <Svg width={W} height={H}>
          {ticks.map((t) => (
            <G key={'t' + t}>
              <Line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke={c.line} strokeWidth={1} strokeDasharray={t === 0 ? undefined : '2 4'} />
              <SvgText fontFamily={FONT} x={padL - SPACE.s2} y={sy(t) + SPACE.s1} textAnchor="end" fontSize={TYPE.footnote.fontSize} fill={c.ink2}>{String(t)}</SvgText>
            </G>
          ))}
          {!!goal && <Line x1={padL} x2={W - padR} y1={sy(goal)} y2={sy(goal)} stroke={c.ink2} strokeWidth={1} strokeDasharray="4 4" />}
          {bars.map((b, i) => {
            const x = padL + band * i + (band - bw) / 2;
            const dim = i !== lastI && sel !== i;
            return (
              <G key={'b' + i}>
                {b.value > 0 && <Path d={barPath(x, b.value)} fill={c.chart} opacity={dim ? 0.45 : 1} />}
                {(i === lastI || i === sel) && b.value > 0 && <SvgText fontFamily={FONT} x={x + bw / 2} y={valueY(b.value)} textAnchor="middle" fontSize={fs} fontWeight={TYPE.headline.fontWeight} fill={c.ink}>{fmtVal(b.value)}</SvgText>}
                {i % every === lastI % every && <SvgText fontFamily={FONT} x={x + bw / 2} y={H - SPACE.s2} textAnchor="middle" fontSize={TYPE.footnote.fontSize} fill={c.ink2}>{b.label}</SvgText>}
              </G>
            );
          })}
          {showGoal && (
            // over the bars, with a paper outline so a week above the goal doesn't cut through it
            <G>
              <SvgText aria-hidden fontFamily={FONT} x={goalBox!.x0} y={valueY(goal!)} fontSize={fs} fill={c.bg} stroke={c.bg} strokeWidth={4} strokeLinejoin="round">{goalText}</SvgText>
              <SvgText fontFamily={FONT} x={goalBox!.x0} y={valueY(goal!)} fontSize={fs} fill={c.ink2}>{goalText}</SvgText>
            </G>
          )}
        </Svg>
      )}
      {sb && <Tip left={padL + band * (sel ?? 0) + band / 2} width={W} value={fmtVal(sb.value)} sub={sb.title || sb.label} />}
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { position: 'absolute', top: -SPACE.s2, width: SPACE.s8 * 4, borderRadius: RADIUS.m, paddingHorizontal: SPACE.s2, paddingVertical: SPACE.s2 },
});
