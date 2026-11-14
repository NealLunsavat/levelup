// The Daily Dungeon: time-gated quests that unlock and lock with the clock.
// A quest only counts if you log it during its window (plus a short grace period).
import { DUNGEON_START, QUEST_GRACE_MIN, STEALTH_MIN_MINUTES } from './rpgMath.js';
import { dayOfWeek, parseDate, sum } from './util.js';

// Mon–Thu windows; `friday` overrides the window on Fridays.
export const DUNGEON = [
  {
    id: 'iron', name: 'The Iron Dungeon', icon: '🏋️',
    task: 'Push/Pull/Legs or Upper/Lower + incline cardio',
    window: ['05:00', '07:30'],
    objectives: [{ kind: 'workout', xp: { str: 50 } }],
    gold: 10, penalty: 15,
  },
  {
    id: 'hustle', name: 'The Hustle Wastes', icon: '🚗',
    task: 'DoorDash / Spark Driver run',
    window: ['09:30', '14:00'], friday: ['14:30', '19:00'],
    objectives: [{ kind: 'shift', xp: { cred: 25 } }],
    note: '+1 Gold per $1 earned', penalty: 0,
  },
  {
    id: 'it', name: 'IT Headquarters', icon: '🖥️',
    task: 'LanceSoft shift',
    window: ['14:00', '18:00'], friday: ['09:00', '14:00'],
    objectives: [{ kind: 'itshift', xp: { cred: 25 } }],
    stealth: true, penalty: 0,
  },
  {
    id: 'studio', name: "The Creator's Studio", icon: '🎬',
    task: '30 min Procreate or 30 min DaVinci Resolve',
    window: ['18:30', '19:30'],
    objectives: [{ kind: 'draw', minutes: 30, xp: { tech: 30 } }, { kind: 'content', minutes: 30, xp: { cha: 30 } }],
    penalty: 0,
  },
  {
    id: 'tavern', name: 'Tavern Rest', icon: '🍺',
    task: '1 hr Cyberpunk / COD, then log off',
    window: ['19:30', '20:30'],
    objectives: [{ kind: 'rest' }],
    buff: 'Mental Reset: +5% XP tomorrow', penalty: 0,
  },
  {
    // The nightly "save state": tick all three before bed so the early start has no friction.
    id: 'prep', name: 'Inventory Management', icon: '🎒',
    task: 'Save your state: set up tomorrow morning before you sleep',
    window: ['20:00', '21:00'], days: [0, 1, 2, 3, 4], // the night before each gym morning (Sun–Thu)
    objectives: [],
    checklist: [
      { id: 'meal', label: 'Prepped cream of rice & whey' },
      { id: 'clothes', label: 'Laid out gym clothes' },
      { id: 'charge', label: 'Charged iPad & Apple Pencil' },
    ],
    heal: 10, buff: 'Save State: +5% XP in tomorrow’s Iron Dungeon', penalty: 0,
  },
];

// Clear all four of these in one day to trigger Overdrive.
export const OVERDRIVE_QUESTS = ['iron', 'hustle', 'it', 'studio'];

const DUNGEON_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri; weekends are rest days

const toMinutes = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const timeOn = (date, minutes) => {
  const d = parseDate(date);
  d.setMinutes(minutes);
  return d.getTime();
};

// Default days each quest runs, and whether it has its own Friday window to edit.
export const questDays = q => q.days ?? DUNGEON_DAYS;
export const hasFriday = q => questDays(q).includes(5);

// Your own times live in the 'schedule' record as dated versions, so changing them never
// re-scores days that already happened: each date uses the newest version that started on or before it.
function windowsOn(date, versions) {
  const v = [...versions].sort((a, b) => b.from.localeCompare(a.from)).find(v => v.from <= date);
  return v?.windows ?? {};
}

// The quests scheduled on a date, with absolute start/end times, in time order.
export function dungeonFor(date, versions = []) {
  const dow = dayOfWeek(date);
  const custom = windowsOn(date, versions);
  return DUNGEON.filter(q => questDays(q).includes(dow)).map(q => {
    const mine = custom[q.id] ?? {};
    const weekday = mine.window ?? q.window;
    const friday = mine.friday ?? q.friday ?? weekday;
    const [start, end] = dow === 5 ? friday : weekday;
    const s = timeOn(date, toMinutes(start));
    const e = timeOn(date, toMinutes(end));
    return { ...q, date, start: s, end: e, graceEnd: e + QUEST_GRACE_MIN * 60000 };
  }).sort((a, b) => a.start - b.start);
}

// Work out a quest's state at `now` from that day's logs (and, for checklist quests, that day's ticks).
// status: locked (not open yet) | active | complete | missed | untracked (began before the dungeon existed)
export function evaluateQuest(q, dayLogs, now, prep) {
  const inWindow = l => l.date === q.date && l.createdAt >= q.start && l.createdAt <= q.graceEnd;
  let completedAt = null;
  const objectives = q.objectives.map(o => {
    const logs = dayLogs.filter(l => l.kind === o.kind && inWindow(l)).sort((a, b) => a.createdAt - b.createdAt);
    let logged = 0;
    let doneAt = null;
    for (const l of logs) {
      logged += Number(l.minutes) || 0;
      if (!doneAt && (!o.minutes || logged >= o.minutes)) doneAt = l.createdAt;
    }
    if (doneAt && (!completedAt || doneAt < completedAt)) completedAt = doneAt;
    return { ...o, logged, done: !!doneAt };
  });

  // Checklist quests clear when every item was ticked during the window.
  const checklist = q.checklist?.map(c => {
    const at = prep?.items?.[c.id] ?? null;
    return { ...c, at, done: at != null && at >= q.start && at <= q.graceEnd };
  });
  if (checklist?.every(c => c.done)) completedAt = Math.max(...checklist.map(c => c.at));

  let status;
  if (completedAt) status = 'complete';
  else if (now < q.start) status = 'locked';
  else if (now <= q.graceEnd) status = 'active';
  else status = q.start >= DUNGEON_START ? 'missed' : 'untracked';

  const out = { ...q, objectives, checklist, status, completedAt };
  if (q.stealth) {
    const stealthLogs = dayLogs.filter(l => l.kind === 'study' && l.stealth && inWindow(l));
    out.stealthIds = stealthLogs.map(l => l.id);
    out.stealthMinutes = sum(stealthLogs, l => l.minutes);
    out.stealthActive = out.stealthMinutes >= STEALTH_MIN_MINUTES;
  }
  return out;
}
