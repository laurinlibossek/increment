// Gym tools: the plate calculator (opened from a barbell exercise with its
// weight, ?w= in the lifting unit) and the 1RM calculator.
import { useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  platesFor, est1RM, formulaLabel, parseNum, toKg,
} from '@increment/core';

import { useSettings } from '@/data/store';
import { CONTROL, RADIUS, SPACE, TYPE } from '@/design/tally';
import { useFormat } from '@/lib/format';
import { useTally } from '@/lib/theme';
import { Card, Txt } from '@/ui/kit';
import { SegmentedControl } from '@/ui/tally/SegmentedControl';
import { KeyboardDoneBar } from '@/ui/workout/DraftBlocks';
import { KEYBOARD_BAR } from '@/ui/workout/SetRow';

// competition plate colours by weight (kg); lb plates use the nearest match
const PLATE_STYLE: Record<number, [string, number]> = {
  25: ['#d93a2b', 1], 20: ['#2a6fd6', 0.94], 15: ['#e0b100', 0.86], 10: ['#2a9a4a', 0.78],
  5: ['#e9edf2', 0.6], 2.5: ['#1d2229', 0.5], 1.25: ['#a7afba', 0.42], 0.5: ['#a7afba', 0.36],
  45: ['#2a6fd6', 1], 35: ['#e0b100', 0.9], 2: ['#1d2229', 0.48], 1: ['#a7afba', 0.4],
};
const plateLook = (p: number) => {
  const [color, scale] = PLATE_STYLE[p] || ['#8b95a3', 0.5];
  return { color, h: Math.round(104 * scale), w: p >= 10 ? 15 : p >= 2.5 ? 11 : 8 };
};

export default function Tools() {
  const { w, tab: initialTab } = useLocalSearchParams<{ w?: string; tab?: string }>();
  const f = useFormat();
  const { tr } = f;
  const { colors: c } = useTally();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'plates' | 'rm'>(initialTab === 'rm' ? 'rm' : 'plates');
  const top = Platform.OS === 'ios' ? 0 : insets.top;
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={[styles.bar, { paddingTop: top + SPACE.s2 }]}>
        <View style={{ flex: 1 }} />
        <Text style={[TYPE.headline, { color: c.ink }]}>{tr('Tools')}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Pressable onPress={() => router.back()} hitSlop={SPACE.s2} style={styles.done} accessibilityRole="button" testID="tools-done">
            <Text style={[TYPE.headline, { color: c.ink }]}>{tr('Done')}</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACE.s5, gap: SPACE.s4, paddingBottom: insets.bottom + SPACE.s8 }} keyboardShouldPersistTaps="handled">
        <SegmentedControl value={tab} onChange={setTab} label={tr('Tools')} testID="tools-tabs" options={[{ value: 'plates', label: tr('Plate calculator') }, { value: 'rm', label: tr('1RM calculator') }]} />
        {tab === 'plates' ? <Plates initial={w} /> : <OneRM />}
      </ScrollView>
      <KeyboardDoneBar />
    </View>
  );
}

function BigInput({ value, onChange, placeholder, label, testID, integer }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; testID: string; integer?: boolean }) {
  const { colors: c } = useTally();
  return (
    <View style={{ gap: SPACE.s2, flex: 1 }}>
      <Txt tone="ink2" style={[TYPE.footnote, { paddingHorizontal: SPACE.s1 }]} testID={`${testID}-label`}>{label}</Txt>
      <TextInput value={value} onChangeText={(v) => onChange(v.replace(/[^\d.,]/g, '').slice(0, 7))} placeholder={placeholder} placeholderTextColor={c.ink3}
        keyboardType={integer ? 'number-pad' : 'decimal-pad'} selectTextOnFocus accessibilityLabel={label} testID={testID}
        inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_BAR : undefined}
        style={[styles.big, { color: c.ink, backgroundColor: c.paper3 }]} />
    </View>
  );
}

function Plates({ initial }: { initial?: string }) {
  const st = useSettings();
  const f = useFormat();
  const { tr } = f;
  const { colors: c } = useTally();
  const u = st.unit;
  const [val, setVal] = useState(initial ? f.num(Number(initial), 2).replace(/[^\d.,]/g, '') : '');
  const [bar, setBar] = useState(st.bar);
  const ghost = u === 'lb' ? 225 : 100;
  const target = parseNum(val.trim() === '' ? String(ghost) : val);
  const res = target !== null ? platesFor(target, bar, st.plates) as { plates: number[]; remainder: number } : null;
  const loaded = res ? bar + res.plates.reduce((a, p) => a + p * 2, 0) : null;
  const barOptions = u === 'lb' ? [45, 35, 33, 25, 15, 0] : [20, 15, 10, 7.5, 0];
  return (
    <View style={{ gap: SPACE.s4 }}>
      <Txt tone="ink2" style={TYPE.subhead} testID="plate-hint">{tr('The plates you need on each side of the bar.')}</Txt>
      <BigInput label={tr('Target weight ({unit})', { unit: u })} value={val} onChange={setVal} placeholder={f.num(ghost, 0)} testID="plate-target" />
      <View style={{ gap: SPACE.s2 }}>
        <Txt tone="ink2" style={[TYPE.footnote, { paddingHorizontal: SPACE.s1 }]}>{tr('Bar')}</Txt>
        <SegmentedControl value={String(bar)} onChange={(v) => setBar(Number(v))} label={tr('Bar')} testID="plate-bar"
          options={barOptions.map((b) => ({ value: String(b), label: b ? f.num(b, 1) : tr('None') }))} />
      </View>
      {res && target !== null && (
        <Card testID="plate-result">
          {target < bar ? <Txt tone="ink2" style={[TYPE.subhead, { textAlign: 'center', marginVertical: SPACE.s2 }]}>{tr('That’s lighter than the bar.')}</Txt> : (
            <View style={{ gap: SPACE.s3 }}>
              <Txt style={[TYPE.headline, { textAlign: 'center' }]}>{tr('Each side')}</Txt>
              <View style={styles.barRow} accessible={false}>
                <View style={[styles.shaft, { backgroundColor: c.ink3 }]} />
                <View style={[styles.collar, { backgroundColor: c.ink2 }]} />
                {res.plates.map((p, i) => {
                  const v = plateLook(p);
                  return <View key={i} style={{ height: v.h, width: v.w, backgroundColor: v.color, borderRadius: 3, marginLeft: 2, borderWidth: p === 5 ? StyleSheet.hairlineWidth : 0, borderColor: '#999' }} />;
                })}
                <View style={[styles.sleeve, { backgroundColor: c.ink3 }]} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, justifyContent: 'center' }} testID="plate-list">
                {res.plates.length ? res.plates.map((p, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: c.paper3 }]}><Text style={[TYPE.headline, { color: c.ink, fontVariant: ['tabular-nums'] }]}>{f.num(p, 2)}</Text></View>
                )) : <Txt tone="ink2" style={TYPE.subhead}>{tr('Just the bar')}</Txt>}
              </View>
              <Txt tone="ink2" style={[TYPE.subhead, { textAlign: 'center' }]} testID="plate-loaded">
                {`${tr('Loaded:')} `}<Txt style={TYPE.headline}>{`${f.num(loaded, 2)} ${u}`}</Txt>
                {res.remainder > 0 ? ` · ${tr('{w} can’t be loaded with your plates', { w: `${f.num(res.remainder, 2)} ${u}` })}` : ''}
              </Txt>
            </View>
          )}
        </Card>
      )}
      <Txt tone="ink2" style={[TYPE.footnote, { paddingHorizontal: SPACE.s1 }]}>{tr('Plates and bar weights can be changed in Account → Plates.')}</Txt>
    </View>
  );
}

function OneRM() {
  const st = useSettings();
  const f = useFormat();
  const { tr } = f;
  const { colors: c } = useTally();
  const u = st.unit;
  const [wv, setW] = useState('');
  const [rv, setR] = useState('');
  const wN = parseNum(wv), rN = parseNum(rv);
  const kg = wN !== null ? toKg(wN, u) : null;
  const oneRm = kg && rN ? est1RM(kg, Math.round(rN), st.formula) : 0;
  const pct = [100, 95, 90, 85, 80, 75, 70, 65, 60, 50];
  const repsAt: Record<number, number> = { 100: 1, 95: 2, 90: 4, 85: 6, 80: 8, 75: 10, 70: 12, 65: 15, 60: 18, 50: 25 };
  const show = (v: number) => `${f.e1rm(v)} ${u}`;
  return (
    <View style={{ gap: SPACE.s4 }}>
      <Txt tone="ink2" style={TYPE.subhead} testID="rm-hint">{tr('Estimate your one-rep max from a set.')}</Txt>
      <View style={{ flexDirection: 'row', gap: SPACE.s3 }}>
        <BigInput label={tr('Weight ({unit})', { unit: u })} value={wv} onChange={setW} placeholder={f.num(u === 'lb' ? 225 : 100, 0)} testID="rm-w" />
        <BigInput label={tr('Reps')} value={rv} onChange={setR} placeholder={f.num(5, 0)} integer testID="rm-r" />
      </View>
      {oneRm > 0 && (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Txt tone="ink2" style={TYPE.footnote}>{tr('Estimated 1RM')}</Txt>
            <Txt style={[TYPE.numberXl, { fontVariant: ['tabular-nums'] }]} testID="rm-result">{show(oneRm)}</Txt>
            <Txt tone="ink2" style={TYPE.footnote} testID="rm-formula">{st.formula === 'average' ? tr(formulaLabel('average')) : tr('{name} formula', { name: formulaLabel(st.formula) })}</Txt>
          </Card>
          <View style={{ borderRadius: RADIUS.m, overflow: 'hidden', backgroundColor: c.paper2 }} testID="rm-table">
            <View style={[styles.rmRow, { backgroundColor: c.paper3 }]}>
              {[tr('% of 1RM'), tr('≈ reps'), tr('Weight')].map((h) => <Text key={h} style={[styles.rmCell, TYPE.caption, { color: c.ink2 }]}>{h}</Text>)}
            </View>
            {pct.map((p) => (
              <View key={p} style={[styles.rmRow, { borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.rmCell, { color: c.ink }]}>{`${p}%`}</Text>
                <Text style={[styles.rmCell, { color: c.ink2 }]}>{repsAt[p]}</Text>
                <Text style={[styles.rmCell, TYPE.headline, { color: c.ink }]}>{show((oneRm * p) / 100)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.s5, paddingBottom: SPACE.s2 },
  done: { minWidth: CONTROL.hitMin, minHeight: CONTROL.hitMin, alignItems: 'flex-end', justifyContent: 'center' },
  big: { ...TYPE.numberL, height: SPACE.s4 * 4, borderRadius: RADIUS.m, textAlign: 'center', fontVariant: ['tabular-nums'] },
  barRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 112 },
  shaft: { width: 40, height: 10, borderRadius: 2 },
  collar: { width: 8, height: 26, borderRadius: 2 },
  sleeve: { width: 30, height: 14, borderRadius: 2, marginLeft: 2 },
  chip: { borderRadius: RADIUS.capsule, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s1 },
  rmRow: { flexDirection: 'row', paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3 },
  rmCell: { ...TYPE.subhead, flex: 1, fontVariant: ['tabular-nums'] },
});
