// The exercise blocks of a draft being edited (a template in the editor or a
// finished workout), each with what it needs from the history, plus the
// "Done" bar above the iPhone number pad. Press and hold an exercise's name
// to drag it into place: the blocks fold to one row each while it moves
// (#137). The running workout shows its exercises one at a time (active.tsx)
// with the same blocks.
import {
  Animated, InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import {
  supersetLetters, draftTemplateId, exerciseSetCount, isUnilateral, moveItem,
} from '@increment/core';

import {
  activeRecords, editDraft, exerciseFor, getState, previousSets, useAppSelector, useSettings,
} from '@/data/store';
import type { AnyDraft, DraftKey, EntryDraft } from '@/data/types';
import { useFormat } from '@/lib/format';
import { useColors } from '@/lib/theme';
import { CONTROL, SPACE, TYPE } from '@/design/tally';
import { DragContext, useDragList, type ScrollHost } from '@/ui/drag';
import { hitTarget, Icon } from '@/ui/kit';
import { ExerciseBlock, type EditorMode } from './ExerciseBlock';
import { KEYBOARD_BAR } from './SetRow';

/** What an exercise block of this draft needs: the exercise, last time's sets, records, superset letter. */
export function useBlockProps(draftKey: DraftKey, draft: AnyDraft) {
  const exercises = useAppSelector((s) => s.exercises);
  // previous values and records follow the history and the settings
  useAppSelector((s) => s.workouts);
  const settings = useSettings();
  // the running workout's records, by the summary's rule (#37)
  const records = draftKey === 'active' ? activeRecords() : null;
  const letters = supersetLetters(draft.exercises);
  const templateId = draftTemplateId(draft);
  // editing a finished workout: "previous" is what came before it
  const before = draft.kind === 'edit' ? draft.startedAt : undefined;
  const excludeWorkoutId = draft.kind === 'edit' ? draft.id : null;
  return (e: EntryDraft) => ({
    draftKey,
    entry: e,
    settings,
    ex: draft.kind === 'workout' ? exercises.get(e.exerciseId) : exerciseFor(draftKey, e.exerciseId, getState()),
    prevSets: previousSets(e.exerciseId, { templateId, before, excludeWorkoutId }),
    recordSets: records ? e.sets.filter((x) => records.has(x.id)).map((x) => x.id).join(' ') : '',
    superset: e.supersetId ? letters.get(e.supersetId) : undefined,
  });
}

/** A folded exercise while one is dragged: its name and sets. */
const FOLD_H = 64;

export function DraftBlocks({
  draftKey, mode, draft, scroll,
}: { draftKey: DraftKey; mode: EditorMode; draft: AnyDraft; scroll?: ScrollHost }) {
  const props = useBlockProps(draftKey, draft);
  const c = useColors();
  const f = useFormat();
  const { tr } = f;
  const pair = useAppSelector((s) => s.settings.pairSides);
  const ids = draft.exercises.map((e) => e.id);
  const list = useDragList({
    ids, rowH: FOLD_H, scroll,
    onDrop: (from, to) => { editDraft(draftKey, (x) => { moveItem(x.exercises, from, to); }); },
    onFold: scroll?.lock,
  });
  const folded = !!list.drag;
  return (
    <DragContext.Provider value={ids.length > 1 ? list.api : null}>
      <View {...list.pan} testID="draft-blocks">
        {list.gap > 0 && <View style={{ height: list.gap }} />}
        {draft.exercises.map((e, i) => {
          const p = props(e);
          const lifted = list.drag?.from === i;
          const letter = p.superset?.letter;
          return (
            <Animated.View key={e.id} {...list.item(e.id, i, c.surface)}>
              <View style={folded ? styles.folded : null}><ExerciseBlock {...p} mode={mode} /></View>
              {folded && (
                <View style={[styles.fold, { backgroundColor: lifted ? c.surface : c.bg }]} testID={`fold-${e.exerciseId}`}>
                  {i > 0 && !lifted && <View style={[styles.hairline, { backgroundColor: c.line }]} />}
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text style={{ ...TYPE.headline, color: c.ink }} numberOfLines={1}>{f.exName(p.ex) || tr('Exercise')}</Text>
                    <Text style={{ ...TYPE.footnote, color: c.ink2 }} numberOfLines={1}>
                      {[f.setsText(exerciseSetCount(e.sets, isUnilateral(p.ex), { pair })), letter ? tr('Superset {letter}', { letter }) : ''].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Icon name="grip" size={20} color={c.ink3} />
                </View>
              )}
            </Animated.View>
          );
        })}
        {list.tail > 0 && <View style={{ height: list.tail }} />}
      </View>
    </DragContext.Provider>
  );
}

/** "Done" above the number pad on iPhone (the pad has no return key). Mount once per screen. */
export function KeyboardDoneBar() {
  const c = useColors();
  const { tr } = useFormat();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_BAR} backgroundColor={c.surface2}>
      <View style={[styles.keys, { borderTopColor: c.line }]}>
        <Pressable onPress={() => Keyboard.dismiss()} style={hitTarget} accessibilityRole="button">
          <Text style={{ color: c.accentText, fontSize: 17, fontWeight: '600' }}>{tr('Done')}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  folded: { height: 0, overflow: 'hidden' },
  fold: { height: FOLD_H, flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, paddingHorizontal: SPACE.s5 },
  hairline: { position: 'absolute', top: 0, left: SPACE.s5, right: 0, height: StyleSheet.hairlineWidth },
  keys: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 0, minHeight: CONTROL.hitMin, borderTopWidth: StyleSheet.hairlineWidth },
});
