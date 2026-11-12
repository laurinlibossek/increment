// A value of a set, typed in place: weight, reps, distance or time. In the
// running workout the app's keypad types into it (the phone's keyboard stays
// down; a hardware keyboard still works); in the editors it's a plain number
// field. Pending sets show last time's numbers in ghost ink; only the set
// being logged, the set the keypad types into and the editors' sets draw field
// boxes. The block's header row says what each column holds (#48), so a box
// has no caption; an empty pending value shows a faint dash.
import { memo, useEffect, useRef } from 'react';
import { Platform, Pressable, TextInput, type TextInputInstance } from 'react-native';
import { fmtDigits } from '@increment/core';

import { RADIUS, TYPE } from '@/design/tally';
import { useTally } from '@/lib/theme';

/** The "Done" bar above the iPhone number pad (DraftBlocks → KeyboardDoneBar). */
export const KEYBOARD_BAR = 'set-keys';

export type Field = 'w' | 'r' | 'd' | 't';
export const FIELD_W: Record<Field, number> = { w: 92, r: 64, d: 92, t: 92 };
/** the routine editor's reps while they hold a range, "10–12" (#44) */
const RANGE_W = 84;
/** Every field is this tall, boxed or not, so a row doesn't change height when its set becomes the one being logged. */
export const FIELD_H = 44;

/** A field's width: one field on its own (reps only, a duration) is wider; the routine editor's reps widen for a range. */
export const fieldWidth = (field: Field, single = false, range = false) => (single ? FIELD_W.t : range ? RANGE_W : FIELD_W[field]);

/** Typed text as the set keeps it: times are digits ("130" = 1:30), numbers digits and one separator. */
export const cleanInput = (f: Field, v: string, range = false) => (f === 't'
  ? v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6)
  // a routine's reps can be a range, "8-10" or "8–10" (#44)
  : range ? v.replace(/[^\d\-–—]/g, '').replace(/[-—]/g, '–').slice(0, 7)
  : v.replace(/[^\d.,]/g, '').slice(0, f === 'r' ? 3 : 7));

type Props = {
  field: Field;
  /** what the set holds (time as digits) */
  value: string;
  /** the ghost value (time as digits) */
  ghost: string;
  /** one field on its own (reps only, a duration) is wider */
  single?: boolean;
  /** the routine editor's reps: also takes a range, "8–10" (#44) */
  range?: boolean;
  /** the column is wide enough for a range (some set of the exercise has one) */
  wide?: boolean;
  /** draw the field box (the set being logged or typed into, or every set in an editor) */
  boxed: boolean;
  /** the keypad types into this field */
  editing?: boolean;
  /** ink for a logged value; pending typed values are ink too */
  label: string;
  testID: string;
  onChange: (v: string) => void;
  /** running workout: the keypad opens instead of the phone's keyboard */
  onKeypad?: () => void;
  /** registers the field so the keypad can focus it and scroll it into view */
  register?: (ref: TextInputInstance | null) => void;
};

export const SetField = memo(function SetField({
  field, value, ghost, single, range, wide, boxed, editing, label, testID, onChange, onKeypad, register,
}: Props) {
  const { colors: t } = useTally();
  const ref = useRef<TextInputInstance>(null);
  useEffect(() => {
    register?.(ref.current);
    return () => register?.(null);
  }, [register]);
  const isTime = field === 't';
  const shown = isTime ? fmtDigits(value) : value;
  const placeholder = isTime ? fmtDigits(ghost) : ghost;
  // nothing to show yet: a faint dash (a time shows 0:00)
  const empty = isTime ? '0:00' : '–';
  const keypad = !!onKeypad;
  const box = boxed || !!editing;
  return (
    // the box: tapping its edge types into the number too
    <Pressable onPress={() => ref.current?.focus()} accessible={false}
      style={{
        width: fieldWidth(field, single, wide || (range && value.includes('–'))), height: FIELD_H, borderRadius: RADIUS.m, justifyContent: 'center',
        backgroundColor: editing ? t.paper : box ? t.paper3 : 'transparent',
        borderWidth: 2, borderColor: editing ? t.ink : 'transparent',
      }}>
      <TextInput ref={ref} value={shown} placeholder={placeholder || empty} placeholderTextColor={t.ink3}
        onChangeText={(v) => onChange(cleanInput(field, v, range))}
        onFocus={onKeypad}
        // the keypad is the keyboard; the phone's stays down
        showSoftInputOnFocus={keypad ? false : undefined} caretHidden={keypad && Platform.OS !== 'web'} contextMenuHidden={keypad}
        // web: showSoftInputOnFocus becomes virtualkeyboardpolicy, which Safari ignores, so the iPhone's keyboard
        // opened over the keypad (#25); inputmode="none" keeps it down there while a hardware keyboard still types
        inputMode={keypad && Platform.OS === 'web' ? 'none' : undefined}
        // a range needs a dash: the number pads have none (iPhone: numbers and punctuation; Android: the phone pad)
        keyboardType={range ? (Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'phone-pad') : field === 'r' || isTime ? 'number-pad' : 'decimal-pad'} selectTextOnFocus={!keypad}
        inputAccessoryViewID={!keypad && Platform.OS === 'ios' ? KEYBOARD_BAR : undefined}
        accessibilityLabel={label} accessibilityHint={placeholder && !shown ? placeholder : undefined} testID={testID} maxLength={isTime ? 8 : 7}
        style={{
          ...TYPE.numberM, fontVariant: ['tabular-nums'], textAlign: 'center', color: t.ink,
          height: 28, paddingHorizontal: 4, paddingVertical: 0, backgroundColor: 'transparent', borderWidth: 0,
          // web: the box is the focus (the keypad's ink border); an editor's field keeps the browser's ring
          ...(keypad && Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null),
        }} />
    </Pressable>
  );
});
