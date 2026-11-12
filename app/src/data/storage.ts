// On the phone: SQLite. Every record is stored as JSON in one table, keyed by
// store and id, the same layout the web app keeps in IndexedDB, so moving data
// between them is a backup file and nothing else. The interface is the web
// adapter's (storage.web.ts); one app owns the database here, so there are no
// other tabs to check revisions against or to tell about changes.
import * as SQLite from 'expo-sqlite';

import type { Changes, Loaded, Op, Saved } from './storage-types';
import { STORES, type Data } from './types';

type Row = { id: string; data: string };
type KvRow = { key: string; value: string };

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const d = await SQLite.openDatabaseAsync('increment.db');
      await d.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS docs (store TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (store, id));
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      `);
      return d;
    })();
    opening.catch(() => { opening = null; });
  }
  return opening;
}

/** Counts this app's changes, so the store sees the same numbers as in a browser. */
let seq = 0;

export async function loadAll(): Promise<Loaded> {
  const d = await db();
  const data: Data = { exercises: [], workouts: [], templates: [], measurements: [], kv: {} };
  for (const store of STORES) {
    const rows = await d.getAllAsync<Row>('SELECT id, data FROM docs WHERE store = ?', store);
    (data[store] as unknown[]) = rows.map((r) => JSON.parse(r.data));
  }
  for (const r of await d.getAllAsync<KvRow>('SELECT key, value FROM kv')) {
    (data.kv as Record<string, unknown>)[r.key] = JSON.parse(r.value);
  }
  return { data, revs: new Map(), seq };
}

/** Save writes in one transaction: all of them or none. `expect` is for other tabs, which a phone doesn't have. */
export async function commit(ops: Op[], _expect: Map<string, number>): Promise<number> {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    for (const op of ops) {
      if (op.kv) {
        if (op.value === null || op.value === undefined) await tx.runAsync('DELETE FROM kv WHERE key = ?', op.kv);
        else await tx.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', op.kv, JSON.stringify(op.value));
      } else if (op.value === null) await tx.runAsync('DELETE FROM docs WHERE store = ? AND id = ?', op.store, op.id);
      else await tx.runAsync('INSERT OR REPLACE INTO docs (store, id, data) VALUES (?, ?, ?)', op.store, op.id, JSON.stringify(op.value));
    }
  });
  return ++seq;
}

/** Replace everything at once (backup restore). Nothing changes if it fails halfway. */
export async function replaceAll(data: Data): Promise<number> {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM docs');
    await tx.runAsync('DELETE FROM kv');
    for (const store of STORES) {
      for (const o of data[store] as { id: string }[]) {
        await tx.runAsync('INSERT INTO docs (store, id, data) VALUES (?, ?, ?)', store, o.id, JSON.stringify(o));
      }
    }
    for (const [k, v] of Object.entries(data.kv)) {
      if (v !== null && v !== undefined) await tx.runAsync('INSERT INTO kv (key, value) VALUES (?, ?)', k, JSON.stringify(v));
    }
  });
  return ++seq;
}

export async function readKeys(keys: Iterable<string>): Promise<Map<string, Saved>> {
  const d = await db();
  const out = new Map<string, Saved>();
  for (const k of keys) {
    const i = k.indexOf('/');
    const row = k.startsWith('kv/')
      ? await d.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', k.slice(3))
      : await d.getFirstAsync<{ value: string }>('SELECT data AS value FROM docs WHERE store = ? AND id = ?', k.slice(0, i), k.slice(i + 1));
    out.set(k, { value: row ? JSON.parse(row.value) : null, rev: 0 });
  }
  return out;
}

export async function changesSince(_since: number): Promise<Changes> {
  return { seq, changed: new Map() };
}

export async function startEmpty(): Promise<void> {}

export function onExternalChange(_fn: () => void): () => void {
  return () => {};
}
