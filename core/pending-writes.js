// Writes the app has made but storage hasn't confirmed yet, and the records
// that storage holds. The app keeps each change as a batch of writes that are
// saved together (a finished workout and the cleared running workout, an
// import); a write is { store, id, value } for a document or { kv, value } for
// one of the app's single values, and a null value deletes it. Every record has
// a key ('workouts/abc', 'kv/settings') and storage a revision per key, so a
// tab that saves over a record another tab changed is stopped (#35).

/** The storage key of a write or record: 'workouts/abc', 'kv/settings'. */
export function writeKey(op) {
  return op.kv ? `kv/${op.kv}` : `${op.store}/${op.id}`;
}

/** The latest write for each key across batches (oldest batch first): what one transaction saves. */
export function coalesceWrites(batches) {
  const byKey = new Map();
  for (const b of batches) for (const op of b.ops) byKey.set(writeKey(op), op);
  return [...byKey.values()];
}

/**
 * The batches that can't be saved because they write a conflicting key,
 * directly or by being saved together with a batch that does (a batch is all
 * or nothing), and the rest, which can. `keys` comes back with every key held.
 */
export function splitBlocked(batches, conflictKeys) {
  const keys = new Set(conflictKeys);
  const held = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of batches) {
      if (held.has(b) || !b.ops.some((op) => keys.has(writeKey(op)))) continue;
      held.add(b);
      grew = true;
      for (const op of b.ops) keys.add(writeKey(op));
    }
  }
  return { blocked: batches.filter((b) => held.has(b)), rest: batches.filter((b) => !held.has(b)), keys };
}

/** Every record of stored data by key ({ exercises, workouts, templates, measurements, kv }); empty kv values are absent, as in storage. */
export function recordsOf(data) {
  const out = new Map();
  for (const store of ['exercises', 'workouts', 'templates', 'measurements']) {
    for (const doc of data?.[store] || []) out.set(`${store}/${doc.id}`, doc);
  }
  for (const [k, v] of Object.entries(data?.kv || {})) if (v !== null && v !== undefined) out.set(`kv/${k}`, v);
  return out;
}

/** JSON with object keys sorted, so two copies of a record compare equal whatever their key order. */
export function canonicalJSON(value) {
  return JSON.stringify(value, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
}

/** Two records hold the same data (null for a missing one). */
export function sameRecord(a, b) {
  return canonicalJSON(a ?? null) === canonicalJSON(b ?? null);
}

/** Two copies of stored data hold the same records: used to check the move to IndexedDB before the original is removed. */
export function sameStoredData(a, b) {
  const x = recordsOf(a);
  const y = recordsOf(b);
  if (x.size !== y.size) return false;
  for (const [k, v] of x) if (!y.has(k) || !sameRecord(v, y.get(k))) return false;
  return true;
}

/**
 * Stored data as the old browser storage kept it (one JSON value), checked
 * before it is moved: the four lists of documents with an id each, and kv.
 * A document saved twice keeps its later copy, as the old storage did on
 * reading. Throws if it isn't stored data; the error's `part` names the list
 * (or 'kv') at fault. Backups are checked with it too (parseBackup).
 */
export function storedDataFrom(raw) {
  const fail = (message, part) => Object.assign(new Error(message), { part });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail('not stored data');
  const out = { exercises: [], workouts: [], templates: [], measurements: [], kv: {} };
  for (const store of ['exercises', 'workouts', 'templates', 'measurements']) {
    const list = raw[store] ?? [];
    if (!Array.isArray(list)) throw fail(`${store} is not a list`, store);
    const byId = new Map();
    for (const doc of list) {
      if (!doc || typeof doc !== 'object' || typeof doc.id !== 'string' || !doc.id) throw fail(`a record in ${store} has no id`, store);
      byId.set(doc.id, doc);
    }
    out[store] = [...byId.values()];
  }
  const kv = raw.kv ?? {};
  if (!kv || typeof kv !== 'object' || Array.isArray(kv)) throw fail('kv is not an object', 'kv');
  for (const [k, v] of Object.entries(kv)) if (v !== null && v !== undefined) out.kv[k] = v;
  return out;
}
