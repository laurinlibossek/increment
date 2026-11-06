// Building blocks for every screen, in the web app's look: large titles,
// grouped rows on a tinted background, rounded cards, filled and tinted buttons.
import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useSearchFocus } from '@/ui/useSearchFocus';
import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { useColors, type Colors } from '@/lib/theme';

// ---------- icons ----------
/** SF Symbol on iOS, Material Symbol on Android and web. */
export const ICONS = {
  profile: { ios: 'person.crop.circle', android: 'person', web: 'person' },
  history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
  workout: { ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' },
  exercises: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  measure: { ios: 'ruler', android: 'straighten', web: 'straighten' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  list: { ios: 'list.bullet', android: 'list', web: 'list' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  weight: { ios: 'scalemass', android: 'scale', web: 'scale' },
  download: { ios: 'square.and.arrow.down', android: 'download', web: 'download' },
  swap: { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  timer: { ios: 'timer', android: 'timer', web: 'timer' },
  note: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
  pin: { ios: 'pin', android: 'push_pin', web: 'push_pin' },
  link: { ios: 'link', android: 'link', web: 'link' },
  unlink: { ios: 'xmark.circle', android: 'link_off', web: 'link_off' },
  flame: { ios: 'flame', android: 'local_fire_department', web: 'local_fire_department' },
  grip: { ios: 'line.3.horizontal', android: 'drag_handle', web: 'drag_handle' },
  reorder: { ios: 'arrow.up.arrow.down', android: 'swap_vert', web: 'swap_vert' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  repeat: { ios: 'arrow.clockwise', android: 'replay', web: 'replay' },
  trend: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' },
  plate: { ios: 'circle.circle', android: 'adjust', web: 'adjust' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  copy: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  folder: { ios: 'folder', android: 'folder', web: 'folder' },
  archive: { ios: 'archivebox', android: 'archive', web: 'archive' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  upload: { ios: 'square.and.arrow.up', android: 'upload', web: 'upload' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  chart: { ios: 'chart.xyaxis.line', android: 'show_chart', web: 'show_chart' },
  calculator: { ios: 'function', android: 'calculate', web: 'calculate' },
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <SymbolView name={ICONS[name] as SymbolViewProps['name']} size={size} tintColor={color} />;
}

// ---------- text ----------
type TxtProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; tone?: 'ink' | 'ink2' | 'ink3' | 'accent' | 'danger' | 'gold'; testID?: string };
export function Txt({ children, style, numberOfLines, tone = 'ink', testID }: TxtProps) {
  const c = useColors();
  const color = { ink: c.ink, ink2: c.ink2, ink3: c.ink3, accent: c.accentText, danger: c.danger, gold: c.gold }[tone];
  return <Text style={[TYPE.body, { color }, style]} numberOfLines={numberOfLines} testID={testID}>{children}</Text>;
}

// ---------- screens ----------
/** A tab's main screen: large title, optional button on the right, scrolling content. */
export function Screen({ title, right, children, scroll = true }: { title: string; right?: ReactNode; children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const head = <LargeTitle title={title} right={right} />;
  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>{head}{children}</View>;
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: SPACE.s8 }}>
      {head}
      <View style={styles.page}>{children}</View>
    </ScrollView>
  );
}

export function LargeTitle({ title, right }: { title: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.titleRow}>
      <Text style={[styles.largeTitle, { color: c.ink }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

/** Content of a pushed screen (the navigation bar gives the title). */
export function Page({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={[styles.page, { paddingTop: SPACE.s3, paddingBottom: SPACE.s8 + SPACE.s2 }]} contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  );
}

export function Loading() {
  const c = useColors();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator color={c.accent} /></View>;
}

// ---------- grouped lists ----------
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: c.ink }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.group, { backgroundColor: c.surface }, style]}>{children}</View>;
}

type CellProps = {
  title: string;
  sub?: string;
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
  right?: ReactNode;
  /** a ">" on rows that open another screen; off for choices */
  chevron?: boolean;
  /** a checkmark for the chosen option in a list of choices */
  checked?: boolean;
  testID?: string;
};
export function Cell({ title, sub, value, icon, onPress, first, danger, right, chevron = true, checked, testID }: CellProps) {
  const c = useColors();
  const body = (pressed: boolean) => (
    <View style={[styles.cell, { backgroundColor: pressed ? c.surface2 : 'transparent' }]}>
      {!first && <View style={[styles.hairline, { backgroundColor: c.line, left: icon ? CONTROL.rowH : SPACE.s5 }]} />}
      {icon && <View style={[styles.cellIcon, { backgroundColor: c.accentSoft }]}><Icon name={icon} size={17} color={c.accentText} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[TYPE.body, { color: danger ? c.danger : c.ink }]}>{title}</Text>
        {!!sub && <Text style={[TYPE.footnote, { color: c.ink2, marginTop: 2 }]} numberOfLines={2}>{sub}</Text>}
      </View>
      {!!value && <Text style={[TYPE.subhead, { color: c.ink2, marginLeft: SPACE.s2, flexShrink: 1, maxWidth: '45%' }]} numberOfLines={1}>{value}</Text>}
      {right}
      {checked && <Icon name="check" size={17} color={c.accentText} />}
      {onPress && chevron && checked === undefined && <View style={{ marginLeft: SPACE.s1 }}><Icon name="chevron" size={13} color={c.ink2} /></View>}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} accessibilityRole={checked === undefined ? 'button' : 'radio'} accessibilityState={checked === undefined ? undefined : { checked }} testID={testID}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

// ---------- cards & buttons ----------
export function Card({ children, onPress, style, testID }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; testID?: string }) {
  const c = useColors();
  const box = (pressed = false) => [styles.card, { backgroundColor: pressed ? c.surface2 : c.surface }, style];
  if (!onPress) return <View style={box()} testID={testID}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => box(pressed)} accessibilityRole="button" testID={testID}>{children}</Pressable>;
}

type ButtonProps = { title: string; onPress: () => void; kind?: 'primary' | 'tinted' | 'plain' | 'danger'; icon?: IconName; large?: boolean; disabled?: boolean; testID?: string };
export function Button({ title, onPress, kind = 'primary', icon, large, disabled, testID }: ButtonProps) {
  const c = useColors();
  const look = buttonLook(c, kind);
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [styles.btn, large && styles.btnLarge, { backgroundColor: look.bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }]}>
      {icon && <Icon name={icon} size={large ? 18 : 16} color={look.ink} />}
      <Text style={[TYPE.headline, { color: look.ink }]} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}
function buttonLook(c: Colors, kind: ButtonProps['kind']) {
  if (kind === 'tinted') return { bg: c.accentSoft, ink: c.accentText };
  if (kind === 'plain') return { bg: c.surface, ink: c.accentText };
  if (kind === 'danger') return { bg: c.surface3, ink: c.danger };
  return { bg: c.primary, ink: c.primaryInk };
}

export function IconButton({ icon, onPress, label, testID }: { icon: IconName; onPress: () => void; label: string; testID?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID} hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? c.surface3 : 'transparent' }]}>
      <Icon name={icon} size={22} color={c.accentText} />
    </Pressable>
  );
}

/** A text button for a navigation bar (Cancel, Save). */
export function HeaderButton({ title, onPress, strong, testID }: { title: string; onPress: () => void; strong?: boolean; testID?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} hitSlop={SPACE.s3} accessibilityRole="button" testID={testID} style={{ paddingHorizontal: SPACE.s2, paddingVertical: SPACE.s1 }}>
      <Text style={[strong ? TYPE.headline : TYPE.body, { color: c.accentText }]}>{title}</Text>
    </Pressable>
  );
}

/** A labelled text field in the grouped style. */
export function Field({
  label, value, onChange, placeholder, multiline, keyboardType, testID, big,
}: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad'; testID?: string; big?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ gap: SPACE.s2 }}>
      {!!label && <Text style={[TYPE.footnote, { color: c.ink2, paddingHorizontal: SPACE.s1 }]}>{label}</Text>}
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.ink3} multiline={multiline}
        keyboardType={keyboardType} testID={testID} accessibilityLabel={label || placeholder}
        style={[styles.field, { color: c.ink, backgroundColor: c.surface }, multiline && { minHeight: 64, textAlignVertical: 'top' }, big && TYPE.numberM]} />
    </View>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: SPACE.s8 + SPACE.s2, paddingHorizontal: SPACE.s5, gap: SPACE.s2 }}>
      <Text style={[TYPE.title3, { color: c.ink, textAlign: 'center' }]}>{title}</Text>
      {!!text && <Text style={[TYPE.subhead, { color: c.ink2, textAlign: 'center' }]}>{text}</Text>}
      {children && <View style={{ marginTop: SPACE.s3, alignSelf: 'stretch' }}>{children}</View>}
    </View>
  );
}

export function SearchField({ value, onChange, placeholder, testID }: { value: string; onChange: (v: string) => void; placeholder: string; testID?: string }) {
  const c = useColors();
  const focus = useSearchFocus();
  return (
    <View style={[styles.search, { backgroundColor: c.surface3 }, focus.containerStyle]}>
      <Icon name="search" size={16} color={c.ink3} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.ink3} testID={testID}
        onFocus={focus.onFocus} onBlur={focus.onBlur} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" style={[TYPE.body, { flex: 1, minWidth: 0, color: c.ink, paddingVertical: SPACE.s2 }, focus.inputStyle]} />
    </View>
  );
}

export const styles = StyleSheet.create({
  page: { paddingHorizontal: SPACE.s5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.s5, paddingTop: SPACE.s3, paddingBottom: SPACE.s2, gap: SPACE.s2 },
  largeTitle: { ...TYPE.largeTitle, flexShrink: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SPACE.s8, marginBottom: SPACE.s2, paddingHorizontal: SPACE.s1 },
  sectionTitle: TYPE.title2,
  group: { borderRadius: RADIUS.l, overflow: 'hidden' },
  cell: { flexDirection: 'row', alignItems: 'center', minHeight: CONTROL.rowH, paddingHorizontal: SPACE.s5, paddingVertical: SPACE.s3, gap: SPACE.s3 },
  hairline: { position: 'absolute', top: 0, right: 0, height: StyleSheet.hairlineWidth },
  cellIcon: { width: 28, height: 28, borderRadius: RADIUS.s, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: RADIUS.l, padding: SPACE.s4 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s2, minHeight: CONTROL.hitMin, borderRadius: RADIUS.capsule, paddingHorizontal: SPACE.s5 },
  btnLarge: { minHeight: CONTROL.buttonH, borderRadius: RADIUS.capsule },
  iconBtn: { width: CONTROL.hitMin, height: CONTROL.hitMin, borderRadius: RADIUS.capsule, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, borderRadius: RADIUS.capsule, paddingHorizontal: SPACE.s4 },
  field: { borderRadius: RADIUS.m, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3, ...TYPE.body },
});
