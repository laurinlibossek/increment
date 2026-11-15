// A routine as something to start: where it sits, its name, its exercises, a
// tally of its sets, and the one Start button. The only card style in the app;
// never put a card inside it. Three levels of text (#116): the lead ("Up next")
// in semibold accent, the name, then the exercises as rows in ink, each with
// its rep range and strokes, so nothing reads as one grey block.
// docs/design/components.md
import { Pressable, Text, View } from 'react-native';

import { RADIUS, SPACE, TYPE } from '@/design/tally';
import { useTally } from '@/lib/theme';
import { Button } from '@/ui/kit';
import { Tally, type StrokeState } from './Tally';

export type RoutineCardExercise = {
  name: string;
  /** The rep range the routine sets ("8–10", #44). */
  range?: string;
  strokes: StrokeState[];
  /** The strokes read aloud: "3 sets". */
  label: string;
};

type Props = {
  /** "Up next", "In progress": semibold, in accent */
  lead?: string;
  /** after the lead: "Usually on Tuesdays" */
  context?: string;
  name: string;
  /** under the name: "12 sets · about 55 min" */
  summary?: string;
  /** one row each, with its range and strokes (the caller keeps it to six) */
  exercises?: RoutineCardExercise[];
  /** under the rows: "& 2 more" */
  more?: string;
  /** the strokes of a running workout, under the name */
  tally?: { groups: StrokeState[][]; label: string };
  /** "4 of 20 working sets · 20%" */
  facts?: string;
  start?: { title: string; onPress: () => void; testID?: string };
  /** Tapping the card outside the button (opens the routine). */
  onPress?: () => void;
  testID?: string;
};

export function RoutineCard({ lead, context, name, summary, exercises, more, tally, facts, start, onPress, testID }: Props) {
  const { colors: t } = useTally();
  const body = (
    <>
      <View style={{ gap: 2 }}>
        {!!(lead || context) && (
          <Text style={[TYPE.footnote, { color: t.ink2 }]} numberOfLines={1}>
            {!!lead && <Text style={{ color: t.accent, fontWeight: '600' }}>{lead}</Text>}
            {lead && context ? ` · ${context}` : context}
          </Text>
        )}
        <Text style={[TYPE.title1, { color: t.ink }]} numberOfLines={2} accessibilityRole="header">{name}</Text>
        {!!summary && <Text style={[TYPE.subhead, { color: t.ink2, fontVariant: ['tabular-nums'] }]} numberOfLines={2} testID={testID && `${testID}-summary`}>{summary}</Text>}
      </View>
      {!!exercises?.length && (
        <View>
          {exercises.map((e, i) => (
            <View key={i} testID={testID && `${testID}-ex-${i}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, minHeight: 30, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.line }}>
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={[TYPE.subhead, { color: t.ink, flexShrink: 1 }]} numberOfLines={1}>{e.name}</Text>
                {/* the range keeps its place when a long name is cut short, and never breaks */}
                {!!e.range && <Text style={[TYPE.subhead, { color: t.ink2, flexShrink: 0, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>{e.range}</Text>}
              </View>
              {e.strokes.length > 0 && <Tally groups={[e.strokes]} size="small" label={e.label} />}
            </View>
          ))}
          {!!more && <Text style={[TYPE.footnote, { color: t.ink2, marginTop: 2 }]} testID={testID && `${testID}-more`}>{more}</Text>}
        </View>
      )}
      {(tally || facts) && (
        <View style={{ gap: 6 }}>
          {tally && tally.groups.length > 0 && <Tally groups={tally.groups} size="small" label={tally.label} />}
          {!!facts && <Text style={[TYPE.footnote, { color: t.ink2, fontVariant: ['tabular-nums'] }]} numberOfLines={2}>{facts}</Text>}
        </View>
      )}
    </>
  );
  const box = { gap: SPACE.s3, padding: SPACE.s5, borderRadius: RADIUS.l, backgroundColor: t.paper2 };
  return (
    <View style={box} testID={testID}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ gap: SPACE.s3, opacity: pressed ? 0.6 : 1 })}>{body}</Pressable>
      ) : body}
      {start && <Button large title={start.title} onPress={start.onPress} testID={start.testID} />}
    </View>
  );
}
