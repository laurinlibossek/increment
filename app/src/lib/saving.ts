// When storage refuses a change (#34) or another tab changed the same record
// (#35): the message after an explicit save, and the review of a conflict that
// the warning at the top of the screen opens (ui/SaveWarning.tsx).
import { getState, keepMine, takeSaved, type ConflictItem } from '@/data/store';
import { Conflict } from '@/data/storage-types';
import type { EntryDraft, TemplateEntry } from '@/data/types';
import { choose, toast, type DiffLine } from '@/ui/overlay';
import { backupNow } from './backup';
import type { Format } from './format';
import type { Tr } from './i18n';

type F = Format & { tr: Tr };

/** Say that a save didn't happen; the changes stay on screen and the warning at the top stays until they're saved. */
export function couldntSave(tr: Tr, e: unknown) {
  toast(e instanceof Conflict
    ? tr('Changed in another tab. Your changes are still here; review them at the top.')
    : tr('Couldn’t save. Your changes are still here; try again or back up now.'));
}

/** Wait for a save; on failure say so (couldntSave) and resolve to undefined instead of throwing. */
export async function attempt<T>(tr: Tr, p: Promise<T>): Promise<T | undefined> {
  try { return await p; } catch (e) { couldntSave(tr, e); return undefined; }
}

const MAX_LINES = 8;
const short = (v: unknown) => {
  const text = typeof v === 'string' ? v : JSON.stringify(v);
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
};

/** A record's name for the review: "Routine “Push”". */
function title(key: string, item: ConflictItem, f: F) {
  const { tr } = f;
  const any = (item.mine || item.saved || {}) as { name?: string };
  const store = key.slice(0, key.indexOf('/'));
  const id = key.slice(key.indexOf('/') + 1);
  if (key === 'kv/active') return tr('Running workout');
  if (store === 'templates') return tr('Routine “{name}”', { name: any.name || '' });
  if (store === 'workouts') return tr('Workout “{name}”', { name: any.name || '' });
  if (store === 'exercises') return tr('Exercise “{name}”', { name: any.name ? f.exName(any as never) : id });
  if (store === 'measurements') return tr('Measurement');
  if (key === 'kv/settings') return tr('Settings');
  if (key === 'kv/profile') return tr('Your name');
  return key.slice(3);
}

/** A record as lines to compare: a workout or routine by its exercises, anything else by its fields. */
function lines(key: string, v: unknown, f: F): string[] {
  if (!v) return [f.tr('Deleted')];
  const rec = v as Record<string, unknown> & { exercises?: (EntryDraft | TemplateEntry)[] };
  if (key === 'kv/active' || key.startsWith('templates/') || key.startsWith('workouts/')) {
    const ex = getState().exercises;
    const out = rec.name ? [String(rec.name)] : [];
    for (const e of rec.exercises || []) {
      const exercise = ex.get(e.exerciseId);
      out.push(`${exercise ? f.exName(exercise) : f.tr('Unknown exercise')}: ${f.plural(e.sets.length, 'set')}`);
    }
    return out;
  }
  return Object.entries(rec).filter(([k]) => k !== 'id').map(([k, x]) => `${k}: ${short(x)}`);
}

/** Lines only one side has: − as saved elsewhere, + as here. */
function diff(item: ConflictItem, f: F): DiffLine[] {
  const saved = lines(item.key, item.saved, f);
  const mine = lines(item.key, item.mine, f);
  const out: DiffLine[] = [{ text: title(item.key, item, f) }];
  const left = [...mine];
  for (const l of saved) {
    const i = left.indexOf(l);
    if (i >= 0) left.splice(i, 1); else out.push({ text: l, tone: 'removed' });
  }
  for (const l of left) out.push({ text: l, tone: 'added' });
  if (out.length === 1) out.push({ text: f.tr('Only small details differ') });
  return out.length > MAX_LINES + 1 ? [...out.slice(0, MAX_LINES), { text: '…' }] : out;
}

/** Show what another tab saved beside this tab's changes, and let the person pick (or back theirs up first). */
export async function reviewConflicts(f: F) {
  const { tr } = f;
  const items = getState().conflicts;
  if (!items.length) return;
  const choice = await choose<'mine' | 'saved' | 'backup'>({
    title: tr('Changed in another tab'),
    lines: items.flatMap((item) => diff(item, f)),
    message: tr('Another tab saved a different version. − is what’s saved there, + is yours, which stays here until you choose.'),
    options: [
      { label: tr('Keep mine'), sub: tr('Save your version over theirs'), value: 'mine', tone: 'primary', testID: 'conflict-keep-mine' },
      { label: tr('Use the saved version'), sub: tr('Your changes to these are dropped'), value: 'saved', tone: 'danger', testID: 'conflict-use-saved' },
      { label: tr('Back up now'), sub: tr('A file with your version, to be safe'), value: 'backup', tone: 'plain', testID: 'conflict-backup' },
    ],
    cancel: tr('Not now'),
  });
  if (choice === 'mine') { if (await keepMine() === false) toast(tr('Still not saved')); }
  else if (choice === 'saved') await takeSaved();
  else if (choice === 'backup') await backupNow(tr);
}
