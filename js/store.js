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

  // Weekly quests. `track` is 'manual' (tap to count) or a metric from weekly.js that fills in from your logs.
  { id: 'w-macro', type: 'weekly', order: 1, title: 'The Perfect Macro Week', track: 'perfectDays', target: 7, rewards: [{ attr: 'str', xp: 100 }],
    note: 'Log 7 straight days in MacroFactor within 5% of your calorie target, with protein hit.' },
  { id: 'w-gauntlet', type: 'weekly', order: 2, title: 'The 5-Day Gauntlet', track: 'rotation', target: 5, rewards: [{ attr: 'str', xp: 150 }],
    note: 'Complete Upper, Lower, Push, Pull and Legs at DMV Iron Gym without skipping the post-workout incline cardio.' },
  { id: 'w-arsenal', type: 'weekly', order: 3, title: 'Arsenal Prepared', track: 'manual', target: 1, rewards: [{ attr: 'str', xp: 50 }],
    note: 'Batch-prep pre- and post-workout meals on Sunday for the Monday–Friday grind (cream of rice, ISO100 whey, PBfit, collagen).' },
  { id: 'w-mastery', type: 'weekly', order: 4, title: 'The Mastery Trial', track: 'quiz80', target: 1, rewards: [{ attr: 'int', xp: 150 }],
    note: 'Pass a full NASM practice exam in GoodNotes with 80% or higher. Log it as a practice quiz.' },
  { id: 'w-recon', type: 'weekly', order: 5, title: 'The Floor Recon', track: 'manual', target: 1, rewards: [{ attr: 'int', xp: 75 }],
    note: 'Spend 1 hour researching Equinox Tysons Corner onboarding, interview structure or shadowing requirements.' },
  { id: 'w-davinci', type: 'weekly', order: 6, title: 'DaVinci Director', track: 'manual', target: 2, rewards: [{ attr: 'cha', xp: 100 }],
    note: 'Color grade (Apple Log 2 to Rec.709-A) and export two short-form fitness videos for Reels or TikTok.' },
  { id: 'w-loomis', type: 'weekly', order: 7, title: 'Loomis Architect', track: 'faceSessions', target: 3, rewards: [{ attr: 'tech', xp: 100 }],
    note: 'Three full Procreate sessions on complex facial angles and proportions (Edgerunners or JJK references). Tag the session Faces, Angles or Proportions.' },
  { id: 'w-thread', type: 'weekly', order: 8, title: 'The Threadsmith', track: 'manual', target: 1, rewards: [{ attr: 'tech', xp: 100 }, { attr: 'cha', xp: 50 }],
    note: 'Finalize one complete clothing or shoe design mockup toward your monthly apparel manufacturing goal.' },
  { id: 'w-spark', type: 'weekly', order: 9, title: 'The Spark Milestone', track: 'earned', target: 300, rewards: [{ attr: 'cred', xp: 150 }],
    note: 'Earn $300 across DoorDash and Spark Driver, earmarked to attack the Debt Boss.' },
  { id: 'w-vanguard', type: 'weekly', order: 10, title: 'LanceSoft Vanguard', track: 'itShifts', target: 5, rewards: [{ attr: 'cred', xp: 100 }],
    note: 'Complete all 5 weekly IT Support shifts without missing hours.' },

  // Micro-bounties for IT downtime.
  { id: 'b-loomis', type: 'bounty', order: 1, title: 'Draw 15 Loomis heads', attr: 'tech', xp: 20 },
  { id: 'b-pages', type: 'bounty', order: 2, title: 'Read 5 pages of the NASM text', attr: 'int', xp: 20 },
  { id: 'b-linkedin', type: 'bounty', order: 3, title: 'Message 1 Equinox trainer on LinkedIn', attr: 'cha', xp: 20 },
  { id: 'b-cards', type: 'bounty', order: 4, title: 'Review 10 NASM flashcards', attr: 'int', xp: 20 },
  { id: 'b-hands', type: 'bounty', order: 5, title: 'Sketch 5 hands from your own hand', attr: 'tech', xp: 20 },
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

// Returns how many records were new or newer than this device's copy.
export function mergeRemote(list) {
  let changed = 0;
  for (const r of list) {
    if (!r?.id) continue;
    const local = records[r.id];
    if (!local || r.updatedAt > local.updatedAt) {
      records[r.id] = r;
      dirty.delete(r.id);
      changed++;
    } else if (r.updatedAt === local.updatedAt) {
      dirty.delete(r.id);
    }
  }
  if (changed) save('remote');
  else localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
  return changed;
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
