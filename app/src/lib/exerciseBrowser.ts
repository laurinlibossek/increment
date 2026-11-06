// Display rows shared by Search and the picker; grouping/selection is in core.
import { BODY_PART_LABEL, exerciseBrowseRows, matchExercise } from '@increment/core';
import type { Exercise } from '@/data/types';
import type { useFormat } from './format';

type Format = ReturnType<typeof useFormat>;
type Sessions = Map<string, { startedAt: number }[]>;
export type ExerciseBrowseRow = {
  id: string; title: string; subtitle: string; family: boolean; members: Exercise[]; exercise: Exercise;
};

export function exerciseBrowserRows(exercises: Map<string, Exercise>, sessions: Sessions, f: Format,
  { query, part, accepts }: { query: string; part: string; accepts?: (ex: Exercise) => boolean }): ExerciseBrowseRow[] {
  const partLabel = (id: string) => f.tr(BODY_PART_LABEL[id as keyof typeof BODY_PART_LABEL] || 'Other');
  if (query.trim()) return [...exercises.values()]
    .filter((e) => !e.hidden && (!accepts || accepts(e)) && (part === 'all' || e.bodyPart === part) && matchExercise(e, query))
    .map((e) => ({ id: e.id, title: f.exName(e), subtitle: [partLabel(e.bodyPart), sessions.get(e.id)?.length ? f.plural(sessions.get(e.id)!.length, 'time') : '', sessions.get(e.id)?.[0]?.startedAt ? f.relDayLower(sessions.get(e.id)![0].startedAt) : ''].filter(Boolean).join(' · '), family: false, members: [e], exercise: e }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return exerciseBrowseRows(exercises, sessions, { accepts })
    .filter((row) => part === 'all' || row.bodyPart === part)
    .map((row) => ({ id: row.id, title: row.family ? f.lang === 'de' ? row.family.nameDe : row.family.name : f.exName(row.exercise),
      subtitle: [partLabel(row.bodyPart), row.members.length > 1 ? f.tr('{n} variations', { n: row.members.length }) : '', row.lastAt ? f.relDayLower(row.lastAt) : ''].filter(Boolean).join(' · '),
      family: !!row.family, members: row.members as Exercise[], exercise: row.exercise as Exercise,
    })).sort((a, b) => a.title.localeCompare(b.title));
}
