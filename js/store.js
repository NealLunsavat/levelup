// Local-first data store. Everything is a "record": {id, type, updatedAt, deleted?, ...fields}.
// Records merge by id with the newest updatedAt winning, so devices can sync without conflicts.
// Deletes are kept as tombstones ({deleted: true}) so they sync too.

const KEY = 'levelup:records';
const DIRTY_KEY = 'levelup:dirty';
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Starter data every device seeds with updatedAt 0, so any real edit (local or synced) wins.
const DEFAULTS = [
  { id: 'settings', type: 'settings', name: 'Player', calorieTarget: 2200, proteinTarget: 150, examDate: '' },
  { id: 'q-study', type: 'quest', order: 1, title: 'Study NASM for 30 min', skill: 'study', metric: 'minutes', target: 30, days: ALL_DAYS },
  { id: 'q-gym', type: 'quest', order: 2, title: 'Hit the gym', skill: 'gym', metric: 'count', target: 1, days: [1, 2, 3, 4, 5] },
  { id: 'q-art', type: 'quest', order: 3, title: 'Draw for 20 min', skill: 'art', metric: 'minutes', target: 20, days: ALL_DAYS },
  { id: 'q-food', type: 'quest', order: 4, title: 'Log 3 meals', skill: 'food', metric: 'count', target: 3, days: ALL_DAYS },
  { id: 'q-earn', type: 'quest', order: 5, title: 'Earn $100 driving', skill: 'finance', metric: 'earned', target: 100, days: [5, 6, 0] },
];

let records = read(KEY, {});
const dirty = new Set(read(DIRTY_KEY, []));
let lastSource = 'local';
const listeners = new Set();

for (const d of DEFAULTS) if (!records[d.id]) records[d.id] = { ...d, updatedAt: 0 };

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(source) {
  lastSource = source;
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
    localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
  } catch (err) {
    console.error('LevelUp could not save', err);
  }
  listeners.forEach(fn => fn(source));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 'local' when the last change came from this device, 'remote' when it came from sync.
export const changeSource = () => lastSource;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const all = type => Object.values(records).filter(r => !r.deleted && r.type === type);

export const get = id => (records[id] && !records[id].deleted ? records[id] : null);

export function put(rec) {
  const prev = records[rec.id];
  const r = { ...rec, id: rec.id || uid(), updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) };
  records[r.id] = r;
  dirty.add(r.id);
  save('local');
  return r;
}

export function remove(id) {
  if (records[id]) put({ ...records[id], deleted: true });
}

// ---- Sync hooks ----

export function mergeRemote(list) {
  let changed = false;
  for (const r of list) {
    if (!r?.id) continue;
    const local = records[r.id];
    if (!local || r.updatedAt > local.updatedAt) {
      records[r.id] = r;
      dirty.delete(r.id);
      changed = true;
    } else if (r.updatedAt === local.updatedAt) {
      dirty.delete(r.id);
    }
  }
  if (changed) save('remote');
  else localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
}

export const pendingChanges = () => [...dirty].map(id => records[id]).filter(Boolean);

export function markSynced(list) {
  for (const r of list) if (records[r.id]?.updatedAt === r.updatedAt) dirty.delete(r.id);
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
}

// ---- Backup ----

export const exportData = () => ({
  app: 'levelup',
  version: 1,
  exportedAt: new Date().toISOString(),
  records: Object.values(records),
});

export function importData(obj) {
  if (obj?.app !== 'levelup' || !Array.isArray(obj.records)) throw new Error('That is not a LevelUp backup file.');
  let count = 0;
  for (const r of obj.records) {
    if (!r?.id || !r.type) continue;
    const local = records[r.id];
    if (!local || r.updatedAt > local.updatedAt) {
      records[r.id] = r;
      dirty.add(r.id);
      count++;
    }
  }
  save('local');
  return count;
}

// Wipes everything back to the starter data, on every synced device.
export function resetAll() {
  for (const r of Object.values(records)) {
    if (r.deleted) continue;
    const d = DEFAULTS.find(x => x.id === r.id);
    records[r.id] = { ...(d ?? { ...r, deleted: true }), updatedAt: Date.now() };
    dirty.add(r.id);
  }
  for (const d of DEFAULTS) {
    if (records[d.id]?.deleted) {
      records[d.id] = { ...d, updatedAt: Date.now() };
      dirty.add(d.id);
    }
  }
  save('local');
}
