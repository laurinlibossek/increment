// Account settings use the same full-width row as the other Tally lists, one
// step larger than other lists (Laurin, 11 Nov 2026): titles in Title 3 at
// regular weight, values in Body, subtitles in Subheadline.
// Titles wrap freely; values shorten first when a setting needs more room.
import type { ReactNode } from 'react';
import { Switch, Text } from 'react-native';

import { TYPE } from '@/design/tally';
import { useTally } from '@/lib/theme';
import { ListRow, SymbolIcon, type SymbolName } from './ListRow';

type Props = {
  title: string;
  sub?: string;
  value?: string;
  symbol?: SymbolName;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
  right?: ReactNode;
  chevron?: boolean;
  checked?: boolean;
  testID?: string;
};

export function SettingRow({ title, sub, value, symbol, onPress, first, danger, right, chevron = true, checked, testID }: Props) {
  const { colors: t } = useTally();
  return (
    <ListRow
      title={<Text style={[TYPE.title3, { fontWeight: '400', color: danger ? t.danger : t.ink }]}>{title}</Text>}
      subtitle={sub ? <Text style={[TYPE.subhead, { color: t.ink2 }]} numberOfLines={3}>{sub}</Text> : undefined}
      symbol={symbol} onPress={onPress} first={first} checked={checked} testID={testID}
      chevron={!!onPress && chevron && checked === undefined}
      right={<>
        {!!value && <Text style={[TYPE.body, { color: t.ink2, fontVariant: ['tabular-nums'], flexShrink: 1, maxWidth: '55%' }]} numberOfLines={1}>{value}</Text>}
        {right}
        {checked && <SymbolIcon name="checkmark" size={20} color={t.ink} />}
      </>}
    />
  );
}

/**
 * On: an ink track with a paper knob in light themes; in dark ones the knob is
 * control-on grey, because a black knob vanishes into the black page. Off: a
 * paper-3 track whose knob is paper in light themes and ink-2 in dark ones, so
 * a switch that's off is the dimmer one there.
 */
export function SwitchSettingRow({ title, sub, value, onChange, first, testID }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void; first?: boolean; testID?: string }) {
  const { colors: t, scheme } = useTally();
  const onKnob = scheme === 'dark' ? t.controlOn : t.paper;
  const offKnob = scheme === 'dark' ? t.ink2 : t.paper;
  return (
    <SettingRow title={title} sub={sub} first={first} right={
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title} testID={testID}
        trackColor={{ true: t.ink, false: t.paper3 }} thumbColor={value ? onKnob : offKnob} ios_backgroundColor={t.paper3}
        {...({ activeThumbColor: onKnob, activeTrackColor: t.ink } as object)} />
    } />
  );
}
