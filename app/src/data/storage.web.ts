// In a browser: IndexedDB. Like the phone's SQLite table, every document is its
// own record (store + id) and so is each kv value, so a change writes only its
// own records and two tabs can't wipe out each other's unrelated changes.
//
// Every record carries a revision: the number of the change that wrote it (one
// counter for the whole database, so a number is never used twice, not even
// after a restore). commit() is told which revision the app saw for each record
// it writes and, inside the same transaction, refuses with Conflict if one has
// moved on: another tab saved it, deleted it or replaced everything (#35). Each
// change is also listed in a change log, and the other tabs are told about it
// (BroadcastChannel) so they read the log and catch up (store.ts).
//
// Before 11 Nov 2026 the browser kept everything as one JSON value in
// localStorage ('increment.data'). migrate() moves it here once and removes it
// only after the copy has been read back (#34).
import { sameStoredData, storedDataFrom, writeKey } from '@increment/core';

import { Conflict, Unreadable, type Changes, type Loaded, type Op, type Saved } from './storage-types';
import { STORES, type Data, type StoreName } from './types';

const NAME = 'increment';
const VERSION = 1;
const LEGACY = 'increment.data';
/** Change-log entries kept for tabs that catch up; a tab further behind reloads everything. */
const LOG_KEEP = 500;
const STRICT = { durability: 'strict' } as IDBTransactionOptions;

type DocRow = { store: StoreName; id: string; rev: number; data: unknown };
type KvRow = { key: string; rev: number; value: unknown };
type LogRow = { seq: number; keys: string[] | null };
type SysRow = { key: string; value: unknown };
const ALL = ['docs', 'kv', 'sys', 'log'];

const promised = <T,>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

/** 'workouts/abc' -> the docs store's key ['workouts', 'abc']. */
function docKey(key: string): [string, string] {
  const i = key.indexOf('/');
  return [key.slice(0, i), key.slice(i + 1)];
}

let opening: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const idb = globalThis.indexedDB;
      if (!idb) { reject(new Error('This browser doesn’t let the app store data')); return; }
      const r = idb.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: ['store', 'id'] });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('sys')) d.createObjectStore('sys', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('log')) d.createObjectStore('log', { keyPath: 'seq' });
      };
      r.onsuccess = () => {
        const d = r.result;
        // a newer version of the app in another tab: let it upgrade, open again on the next write
        d.onversionchange = () => { d.close(); opening = null; };
        d.onclose = () => { opening = null; };
        resolve(d);
      };
      r.onerror = () => reject(r.error);
    });
    opening.catch(() => { opening = null; });
  }
  return opening;
}

let moving: Promise<void> | null = null;
/** The open database, with the old localStorage data moved in. */
async function ready(): Promise<IDBDatabase> {
  const d = await open();
  moving ??= migrate(d);
  try { await moving; } catch (e) { moving = null; throw e; }
  return d;
}

const marker = (d: IDBDatabase) => promised(d.transaction('sys').objectStore('sys').get('moved') as IDBRequest<SysRow | undefined>);
function setMarker(d: IDBDatabase, from: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = d.transaction('sys', 'readwrite', STRICT);
    tx.objectStore('sys').put({ key: 'moved', value: { at: Date.now(), from } });
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Couldn’t save'));
  });
}

/**
 * Move 'increment.data' in, once. The copy is written in one transaction and
 * read back before the original is removed; until the move is marked done it
 * starts over on every start (replacing a half copy, never newer data, since
 * the app only uses this database after the mark). Unreadable data stops with
 * Unreadable and stays where it is. Tabs take turns (Web Locks).
 */
async function migrate(d: IDBDatabase): Promise<void> {
  const run = async () => {
    if (await marker(d)) return;
    let raw: string | null = null;
    try { raw = globalThis.localStorage?.getItem(LEGACY) ?? null; } catch { /* blocked: nothing to move */ }
    if (raw === null) { await setMarker(d, 'none'); return; }
    let source: Data;
    try { source = storedDataFrom(JSON.parse(raw)) as Data; } catch { throw new Unreadable(raw); }
    if (!(await copyIn(d, source))) return; // another tab moved it first
    const back = await readAll(d);
    if (!sameStoredData(back.data, source)) throw new Error('Moving your data to the new storage didn’t work. Nothing is lost: reload to try again');
    await setMarker(d, 'localStorage');
    try { globalThis.localStorage.removeItem(LEGACY); } catch { /* it stays, never read again */ }
  };
  const locks = (globalThis.navigator as (Navigator & { locks?: LockManager }) | undefined)?.locks;
  if (locks?.request) await locks.request('increment-move-data', run); else await run();
}

/** Replace the database's contents with the old data, unless the move is already marked done. Resolves to false then. */
function copyIn(d: IDBDatabase, source: Data): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const tx = d.transaction(ALL, 'readwrite', STRICT);
    let skipped = false;
    let failure: unknown = null;
    const sys = tx.objectStore('sys');
    const m = sys.get('moved');
    m.onsuccess = () => {
      if (m.result) { skipped = true; return; }
      try {
        for (const s of ['docs', 'kv', 'log']) tx.objectStore(s).clear();
        const docs = tx.objectStore('docs');
        const kv = tx.objectStore('kv');
        for (const store of STORES) for (const doc of source[store] as { id: string }[]) docs.put({ store, id: doc.id, rev: 1, data: doc });
        for (const [key, value] of Object.entries(source.kv)) kv.put({ key, rev: 1, value });
        sys.put({ key: 'seq', value: 1 });
        tx.objectStore('log').put({ seq: 1, keys: null });
      } catch (e) {
        failure = e;
        try { tx.abort(); } catch { /* over */ }
      }
    };
    tx.oncomplete = () => resolve(!skipped);
    tx.onabort = () => reject(failure || tx.error || new Error('Couldn’t save'));
  });
}

async function readAll(d: IDBDatabase): Promise<Loaded> {
  const tx = d.transaction(['docs', 'kv', 'sys'], 'readonly');
  const [docs, kvs, seq] = await Promise.all([
    promised(tx.objectStore('docs').getAll() as IDBRequest<DocRow[]>),
    promised(tx.objectStore('kv').getAll() as IDBRequest<KvRow[]>),
    promised(tx.objectStore('sys').get('seq') as IDBRequest<SysRow | undefined>),
  ]);
  const data: Data = { exercises: [], workouts: [], templates: [], measurements: [], kv: {} };
  const revs = new Map<string, number>();
  for (const r of docs) {
    if (!STORES.includes(r.store)) continue;
    (data[r.store] as unknown[]).push(r.data);
    revs.set(`${r.store}/${r.id}`, r.rev);
  }
  for (const r of kvs) {
    (data.kv as Record<string, unknown>)[r.key] = r.value;
    revs.set(`kv/${r.key}`, r.rev);
  }
  return { data, revs, seq: (seq?.value as number) || 0 };
}

export async function loadAll(): Promise<Loaded> {
  return readAll(await ready());
}

/** Records as saved now, by key. */
export async function readKeys(keys: Iterable<string>): Promise<Map<string, Saved>> {
  const d = await ready();
  const tx = d.transaction(['docs', 'kv'], 'readonly');
  const list = [...keys];
  const rows = await Promise.all(list.map((k) => promised<DocRow | KvRow | undefined>(
    k.startsWith('kv/') ? tx.objectStore('kv').get(k.slice(3)) : tx.objectStore('docs').get(docKey(k)))));
  const out = new Map<string, Saved>();
  list.forEach((k, i) => {
    const row = rows[i];
    out.set(k, row ? { value: 'data' in row ? row.data : row.value, rev: row.rev } : { value: null, rev: 0 });
  });
  return out;
}

/** What other changes were made since change number `since` (see Changes). */
export async function changesSince(since: number): Promise<Changes> {
  const d = await ready();
  const tx = d.transaction(['sys', 'log'], 'readonly');
  const [seqRow, entries] = await Promise.all([
    promised(tx.objectStore('sys').get('seq') as IDBRequest<SysRow | undefined>),
    promised(tx.objectStore('log').getAll(IDBKeyRange.lowerBound(since, true)) as IDBRequest<LogRow[]>),
  ]);
  const seq = (seqRow?.value as number) || 0;
  if (seq === since) return { seq, changed: new Map() };
  if (seq < since || !entries.length || entries[0].seq !== since + 1 || entries.some((e) => !e.keys)) {
    const all = await readAll(d);
    return { seq: all.seq, all };
  }
  return { seq, changed: await readKeys(new Set(entries.flatMap((e) => e.keys || []))) };
}

/**
 * Save writes in one transaction. `expect` holds the revision the app saw for
 * each record (0: none); if one differs now, nothing is saved and it rejects
 * with Conflict. Resolves to the change's number, the new revision of every
 * record written. Any other failure rejects too: nothing is saved.
 */
export async function commit(ops: Op[], expect: Map<string, number>): Promise<number> {
  const d = await ready();
  const seq = await new Promise<number>((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = d.transaction(ALL, 'readwrite', STRICT); } catch (e) { opening = null; reject(e); return; }
    const docs = tx.objectStore('docs');
    const kv = tx.objectStore('kv');
    const sys = tx.objectStore('sys');
    const log = tx.objectStore('log');
    const conflicts = new Map<string, Saved>();
    let failure: unknown = null;
    let seq = 0;
    const abort = (e?: unknown) => {
      if (e !== undefined) failure ??= e;
      try { tx.abort(); } catch { /* already over */ }
    };
    const write = () => {
      if (conflicts.size) { abort(); return; }
      try {
        seq += 1;
        for (const op of ops) {
          if (op.kv) {
            if (op.value === null || op.value === undefined) kv.delete(op.kv);
            else kv.put({ key: op.kv, rev: seq, value: op.value });
          } else if (op.value === null) docs.delete([op.store, op.id]);
          else docs.put({ store: op.store, id: op.id, rev: seq, data: op.value });
        }
        sys.put({ key: 'seq', value: seq });
        log.put({ seq, keys: ops.map(writeKey) });
        if (seq > LOG_KEEP) log.delete(IDBKeyRange.upperBound(seq - LOG_KEEP));
      } catch (e) { abort(e); }
    };
    const keys = [...expect.keys()];
    let waiting = keys.length + 1;
    const arrived = () => { if (--waiting === 0) write(); };
    try {
      const s = sys.get('seq');
      s.onsuccess = () => { seq = ((s.result as SysRow | undefined)?.value as number) || 0; arrived(); };
      for (const k of keys) {
        const r: IDBRequest<DocRow | KvRow | undefined> = k.startsWith('kv/') ? kv.get(k.slice(3)) : docs.get(docKey(k));
        r.onsuccess = () => {
          const row = r.result;
          const rev = row?.rev || 0;
          if (rev !== expect.get(k)) conflicts.set(k, { value: row ? ('data' in row ? row.data : row.value) : null, rev });
          arrived();
        };
      }
    } catch (e) { abort(e); }
    tx.oncomplete = () => resolve(seq);
    tx.onabort = () => reject(conflicts.size ? new Conflict(conflicts) : failure || tx.error || new Error('Couldn’t save'));
  });
  announce(seq);
  return seq;
}

/** Replace everything at once (backup restore, Delete all data). Nothing changes if it fails. Every record gets a new revision. */
export async function replaceAll(data: Data): Promise<number> {
  const d = await ready();
  const seq = await new Promise<number>((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = d.transaction(ALL, 'readwrite', STRICT); } catch (e) { opening = null; reject(e); return; }
    let failure: unknown = null;
    let seq = 0;
    const sys = tx.objectStore('sys');
    const s = sys.get('seq');
    s.onsuccess = () => {
      try {
        seq = (((s.result as SysRow | undefined)?.value as number) || 0) + 1;
        for (const name of ['docs', 'kv', 'log']) tx.objectStore(name).clear();
        const docs = tx.objectStore('docs');
        const kv = tx.objectStore('kv');
        for (const store of STORES) for (const doc of (data[store] || []) as { id: string }[]) docs.put({ store, id: doc.id, rev: seq, data: doc });
        for (const [key, value] of Object.entries(data.kv || {})) if (value !== null && value !== undefined) kv.put({ key, rev: seq, value });
        sys.put({ key: 'seq', value: seq });
        tx.objectStore('log').put({ seq, keys: null });
      } catch (e) {
        failure = e;
        try { tx.abort(); } catch { /* over */ }
      }
    };
    tx.oncomplete = () => resolve(seq);
    tx.onabort = () => reject(failure || tx.error || new Error('Couldn’t save'));
  });
  announce(seq);
  return seq;
}

/** After Unreadable, deliberately: start with empty data. The old data stays in localStorage, never read again. */
export async function startEmpty(): Promise<void> {
  const d = await open();
  await setMarker(d, 'unreadable');
  moving = null;
}

// ---------- other tabs ----------
let channel: BroadcastChannel | null | undefined;
const bus = () => {
  if (channel === undefined) channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('increment-data') : null;
  return channel;
};
function announce(seq: number) {
  try { bus()?.postMessage({ seq }); } catch { /* no other tabs to tell */ }
}

/** Call `fn` when another tab saved something. Returns a function that stops it. */
export function onExternalChange(fn: () => void): () => void {
  const c = bus();
  if (!c) return () => {};
  const handler = () => fn();
  c.addEventListener('message', handler);
  return () => c.removeEventListener('message', handler);
}
