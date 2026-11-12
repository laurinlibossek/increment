// What both storage adapters (storage.ts: SQLite on the phone, storage.web.ts:
// IndexedDB in a browser) take and give back. The store (store.ts) saves every
// change through commit(): one transaction of writes, refused if a record it
// writes was changed since this app read it (another tab, #35).
import type { Data, Kv, StoreName } from './types';

export type Doc = { id: string };

/** One write: a document (value null deletes it) or one of the kv values (null or undefined deletes it). */
export type Op =
  | { store: StoreName; id: string; value: Doc | null; kv?: undefined }
  | { kv: keyof Kv; value: unknown; store?: undefined; id?: undefined };

/** A stored record and its revision; value null and revision 0 when there is none. */
export type Saved = { value: unknown; rev: number };

/** Everything stored, each record's revision by key ('workouts/abc', 'kv/settings') and the last change's number. */
export interface Loaded { data: Data; revs: Map<string, number>; seq: number }

/** What changed since a change number: everything (`all`, after a restore or a long gap) or these records. */
export interface Changes { seq: number; all?: Loaded; changed?: Map<string, Saved> }

/** A write was refused: these records were changed elsewhere since they were read (what is saved now). */
export class Conflict extends Error {
  saved: Map<string, Saved>;
  constructor(saved: Map<string, Saved>) {
    super('Changed in another tab');
    this.name = 'Conflict';
    this.saved = saved;
  }
}

/** The data the browser kept before IndexedDB can't be read. `raw` is its text, to save as a file; nothing was moved or deleted. */
export class Unreadable extends Error {
  raw: string;
  constructor(raw: string) {
    super('The saved data can’t be read');
    this.name = 'Unreadable';
    this.raw = raw;
  }
}
