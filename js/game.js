// The game rules: attributes, skills, what each activity is worth, quests, streaks and achievements.
// Your character (XP, levels, HP, Gold, buffs) is always recomputed from your logs, so tweaking a
// number here or in rpgMath.js re-scores your whole history.
import { todayStr, addDays, dayOfWeek, sum, groupBy } from './util.js';
import {
  DUNGEON_START, HP_REGEN_PER_QUEST, MAX_HP, MENTAL_RESET_BONUS, STEALTH_MULTIPLIER,
  clampHP, goldFromLog, levelFromXP,
} from './rpgMath.js';
import { dungeonFor, evaluateQuest } from './dungeon.js';

// The five character attributes. `page` is the skill page each one links to.
export const ATTRIBUTES = [
  { id: 'str', name: 'STR', full: 'Physique', icon: '💪', color: '#ff7a45', page: 'gym' },
  { id: 'int', name: 'INT', full: 'Knowledge', icon: '🧠', color: '#4fa3ff', page: 'study' },
  { id: 'tech', name: 'TECH', full: 'Creative', icon: '🎨', color: '#ff6fb5', page: 'art' },
  { id: 'cha', name: 'CHA', full: 'Brand', icon: '🎥', color: '#c084fc', page: 'content' },
  { id: 'cred', name: 'CRED', full: 'Wealth', icon: '💰', color: '#f5c542', page: 'finance' },
];
export const ATTR_OF_SKILL = { gym: 'str', food: 'str', study: 'int', art: 'tech', content: 'cha', finance: 'cred' };
const ATTR_BY_ID = Object.fromEntries(ATTRIBUTES.map(a => [a.id, a]));

// Skills are the activity pages; each feeds an attribute. Hidden skills don't show in the grid.
export const SKILLS = [
  { id: 'finance', name: 'Finance', icon: '💰', color: '#f5c542', blurb: 'Debt bosses, gig and IT shifts' },
  { id: 'study', name: 'NASM', icon: '📚', color: '#4fa3ff', blurb: 'Certification study' },
  { id: 'art', name: 'Art', icon: '🎨', color: '#ff6fb5', blurb: 'Procreate anime drawing' },
  { id: 'content', name: 'Content', icon: '🎥', color: '#c084fc', blurb: 'Apple Log 2 shoots and DaVinci edits' },
  { id: 'gym', name: 'Strength', icon: '🏋️', color: '#ff7a45', blurb: 'Workouts and PRs' },
  { id: 'food', name: 'Nutrition', icon: '🥗', color: '#4cd18a', blurb: 'Meals and macros' },
  { id: 'rest', name: 'Rest', icon: '🛌', color: '#7dd3fc', blurb: 'Tavern rest and recovery', hidden: true },
];

// Each kind of log, which skill it trains, and its base XP.
export const KINDS = {
  payment: { skill: 'finance', label: 'Debt payment', icon: '⚔️', xp: l => l.amount / 2 },
  shift: { skill: 'finance', label: 'Gig shift', icon: '🚗', xp: l => l.amount / 2 + (l.hours || 0) * 5 },
  itshift: { skill: 'finance', label: 'IT shift', icon: '🖥️', xp: l => (l.hours || 0) * 10 },
  study: { skill: 'study', label: 'Study session', icon: '📖', xp: l => l.minutes * 2 },
  quiz: { skill: 'study', label: 'Practice quiz', icon: '📝', xp: l => 20 + (l.score || 0) / 2 },
  draw: { skill: 'art', label: 'Drawing session', icon: '✏️', xp: l => l.minutes * 2 },
  content: { skill: 'content', label: 'Content session', icon: '🎬', xp: l => l.minutes * 2 },
  workout: { skill: 'gym', label: 'Workout', icon: '💪', xp: l => 30 + l.minutes * 2 },
  pr: { skill: 'gym', label: 'Personal record', icon: '🏆', xp: () => 75 },
  meal: { skill: 'food', label: 'Meal', icon: '🍽️', xp: () => 10 },
  rest: { skill: 'rest', label: 'Tavern rest', icon: '🎮', xp: () => 0 },
  activity: { skill: null, label: 'Session', icon: '⭐', xp: l => 10 + (l.minutes || 0) * 2 },
};

export const BONUS = { quest: 25, allQuests: 100, boss: 500, protein: 40 };

// Base XP before any buffs or multipliers.
export function logXP(l) {
  const v = KINDS[l.kind]?.xp(l);
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

const TITLES = [[1, 'Novice'], [5, 'Apprentice'], [10, 'Adventurer'], [15, 'Challenger'], [20, 'Veteran'],
  [30, 'Elite'], [40, 'Champion'], [50, 'Master'], [75, 'Grandmaster'], [100, 'Legend']];
export const titleFor = level => TITLES.filter(([min]) => level >= min).pop()[1];

// ---- Side quests (flexible daily goals you set in Settings) ----

export const METRICS = {
  minutes: { label: 'minutes', of: l => l.minutes || 0 },
  count: { label: 'entries', of: () => 1 },
  earned: { label: '$ earned', of: l => (l.kind === 'shift' ? l.amount : 0) },
  paid: { label: '$ paid to debt', of: l => (l.kind === 'payment' ? l.amount : 0) },
  protein: { label: 'g protein', of: l => l.protein || 0 },
};

export const questActiveOn = (q, date) => q.active !== false && (q.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(dayOfWeek(date));

export function questProgress(q, dayLogs) {
  const of = METRICS[q.metric]?.of ?? (() => 0);
  const value = sum(dayLogs.filter(l => l.skill === q.skill), of);
  const target = Number(q.target) || 1;
  return { value, done: value >= target, pct: Math.min(1, value / target) };
}

// ---- Everything the UI shows, computed in one pass ----

export function buildGame({ logs, quests, debts, purchases, settings, skills }, today = todayStr(), now = Date.now()) {
  const byDate = groupBy(logs, l => l.date);

  // 1. The Daily Dungeon for every day since it started tracking.
  const dungeonDays = {};
  for (let d = todayStr(new Date(DUNGEON_START)); d <= today; d = addDays(d, 1)) {
    dungeonDays[d] = dungeonFor(d).map(q => evaluateQuest(q, byDate[d] || [], now));
  }
  const dungeonToday = dungeonDays[today] ?? dungeonFor(today).map(q => evaluateQuest(q, byDate[today] || [], now));

  // 2. Buffs: clearing Tavern Rest gives Mental Reset (+5% XP) the following day.
  const mentalReset = date => dungeonDays[addDays(date, -1)]?.some(q => q.id === 'tavern' && q.status === 'complete');
  const multiplier = date => (mentalReset(date) ? MENTAL_RESET_BONUS : 1);

  // 3. XP. Every source goes through add(), which applies that day's buffs.
  const skillXP = Object.fromEntries(skills.map(s => [s.id, 0]));
  const attrXP = Object.fromEntries(ATTRIBUTES.map(a => [a.id, 0]));
  const xpByDate = {};
  const xpOfLog = {};
  let total = 0;
  const add = (date, skill, base) => {
    const xp = Math.round(base * multiplier(date));
    if (!xp) return 0;
    total += xp;
    xpByDate[date] = (xpByDate[date] || 0) + xp;
    if (skill in skillXP) skillXP[skill] += xp;
    const attr = ATTR_OF_SKILL[skill];
    if (attr) attrXP[attr] += xp;
    return xp;
  };

  for (const l of logs) {
    const it = dungeonDays[l.date]?.find(q => q.id === 'it');
    const stealth = it?.stealthActive && it.stealthIds.includes(l.id) ? STEALTH_MULTIPLIER : 1;
    xpOfLog[l.id] = add(l.date, l.skill, logXP(l) * stealth);
  }

  // Side quests and nutrition bonuses.
  for (const [date, dayLogs] of Object.entries(byDate)) {
    const active = quests.filter(q => questActiveOn(q, date));
    const done = active.filter(q => questProgress(q, dayLogs).done);
    for (const q of done) add(date, q.skill, BONUS.quest);
    if (active.length && done.length === active.length) add(date, 'bonus', BONUS.allQuests);
    if (settings.proteinTarget > 0 && sum(dayLogs, l => l.protein) >= settings.proteinTarget) add(date, 'food', BONUS.protein);
  }

  // Dungeon rewards, Gold and HP.
  let goldEarned = sum(logs, goldFromLog);
  const hpEvents = [];
  for (const [date, day] of Object.entries(dungeonDays)) {
    for (const q of day) {
      if (q.status === 'complete') {
        for (const o of q.objectives.filter(o => o.done)) {
          for (const [attr, xp] of Object.entries(o.xp ?? {})) add(date, ATTR_BY_ID[attr].page, xp);
        }
        goldEarned += q.gold || 0;
        hpEvents.push({ at: q.completedAt, delta: HP_REGEN_PER_QUEST });
      } else if (q.status === 'missed' && q.penalty) {
        hpEvents.push({ at: q.graceEnd, delta: -q.penalty });
      }
    }
  }
  const hp = hpEvents.sort((a, b) => a.at - b.at).reduce((v, e) => clampHP(v + e.delta), MAX_HP);
  const goldSpent = sum(purchases, p => p.goldCost);

  // 4. Debt bosses.
  const bosses = debts.map(d => {
    const payments = logs
      .filter(l => l.kind === 'payment' && l.debtId === d.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    let paid = 0;
    let defeatedOn = null;
    for (const p of payments) {
      paid += Number(p.amount) || 0;
      if (!defeatedOn && d.balance > 0 && paid >= d.balance) defeatedOn = p.date;
    }
    if (defeatedOn) add(defeatedOn, 'finance', BONUS.boss);
    const balance = Number(d.balance) || 0;
    return { ...d, paid, remaining: Math.max(0, balance - paid), pct: balance ? Math.min(1, paid / balance) : 0, defeatedOn };
  }).sort((a, b) => !!a.defeatedOn - !!b.defeatedOn || a.remaining - b.remaining);

  // 5. Streak = consecutive days with every side quest cleared. Days with none scheduled don't break it,
  // and today only counts once it's cleared (it isn't "missed" until it's over).
  const dayStatus = date => {
    const active = quests.filter(q => questActiveOn(q, date));
    if (!active.length) return 'rest';
    const dayLogs = byDate[date] || [];
    return active.every(q => questProgress(q, dayLogs).done) ? 'clear' : 'miss';
  };
  const firstDate = logs.reduce((min, l) => (l.date < min ? l.date : min), today);
  let streak = 0;
  let bestStreak = 0;
  if (quests.some(q => q.active !== false)) {
    for (let d = dayStatus(today) === 'clear' ? today : addDays(today, -1); d >= firstDate; d = addDays(d, -1)) {
      const s = dayStatus(d);
      if (s === 'miss') break;
      if (s === 'clear') streak++;
    }
    let run = 0;
    for (let d = firstDate; d <= today; d = addDays(d, 1)) {
      const s = dayStatus(d);
      if (s === 'clear') bestStreak = Math.max(bestStreak, ++run);
      else if (s === 'miss' && d !== today) run = 0;
    }
  }

  const todayLogs = byDate[today] || [];
  const todayQuests = quests
    .filter(q => questActiveOn(q, today))
    .map(q => ({ ...q, ...questProgress(q, todayLogs) }));

  const overall = levelFromXP(total);
  return {
    today,
    now,
    total,
    overall,
    title: titleFor(overall.level),
    hp,
    maxHp: MAX_HP,
    gold: Math.floor(goldEarned - goldSpent),
    goldEarned: Math.floor(goldEarned),
    buffs: mentalReset(today) ? [{ icon: '🧘', name: 'Mental Reset', desc: '+5% XP today' }] : [],
    attributes: ATTRIBUTES.map(a => ({ ...a, xp: attrXP[a.id], ...levelFromXP(attrXP[a.id]) })),
    skillXP,
    skillLevels: Object.fromEntries(Object.entries(skillXP).map(([id, xp]) => [id, levelFromXP(xp)])),
    xpByDate,
    xpOfLog,
    todayXP: xpByDate[today] || 0,
    dungeonToday,
    todayQuests,
    allClear: todayQuests.length > 0 && todayQuests.every(q => q.done),
    bosses,
    streak,
    bestStreak,
    totals: {
      logs: logs.length,
      earned: sum(logs, l => (l.kind === 'shift' ? l.amount : 0)),
      paid: sum(logs, l => (l.kind === 'payment' ? l.amount : 0)),
      studyMin: sum(logs, l => (l.kind === 'study' ? l.minutes : 0)),
      drawMin: sum(logs, l => (l.kind === 'draw' ? l.minutes : 0)),
      workouts: logs.filter(l => l.kind === 'workout').length,
      meals: logs.filter(l => l.kind === 'meal').length,
      bestQuiz: Math.max(0, ...logs.filter(l => l.kind === 'quiz').map(l => l.score || 0)),
      activeDays: Object.keys(byDate).length,
    },
  };
}

export const ACHIEVEMENTS = [
  { icon: '🌱', name: 'First Step', desc: 'Log your first activity', test: g => g.totals.logs >= 1 },
  { icon: '🔥', name: 'Warming Up', desc: '3-day quest streak', test: g => g.bestStreak >= 3 },
  { icon: '🔥', name: 'On Fire', desc: '7-day quest streak', test: g => g.bestStreak >= 7 },
  { icon: '☄️', name: 'Unstoppable', desc: '30-day quest streak', test: g => g.bestStreak >= 30 },
  { icon: '⚔️', name: 'Boss Slayer', desc: 'Pay off your first debt', test: g => g.bosses.some(b => b.defeatedOn) },
  { icon: '👑', name: 'Debt Free', desc: 'Defeat every debt boss', test: g => g.bosses.length > 0 && g.bosses.every(b => b.defeatedOn) },
  { icon: '💵', name: 'Road Warrior', desc: 'Earn $1,000 from gigs', test: g => g.totals.earned >= 1000 },
  { icon: '💰', name: 'Gig Tycoon', desc: 'Earn $10,000 from gigs', test: g => g.totals.earned >= 10000 },
  { icon: '📚', name: 'Bookworm', desc: 'Study 10 hours', test: g => g.totals.studyMin >= 600 },
  { icon: '🎓', name: 'Scholar', desc: 'Study 50 hours', test: g => g.totals.studyMin >= 3000 },
  { icon: '💯', name: 'Ace', desc: 'Score 90%+ on a practice quiz', test: g => g.totals.bestQuiz >= 90 },
  { icon: '✏️', name: 'Sketcher', desc: '10 hours of drawing', test: g => g.totals.drawMin >= 600 },
  { icon: '🖌️', name: 'Mangaka', desc: '50 hours of drawing', test: g => g.totals.drawMin >= 3000 },
  { icon: '💪', name: 'Gym Regular', desc: 'Log 25 workouts', test: g => g.totals.workouts >= 25 },
  { icon: '🦾', name: 'Iron Will', desc: 'Log 100 workouts', test: g => g.totals.workouts >= 100 },
  { icon: '🥗', name: 'Fuel Tracker', desc: 'Log 100 meals', test: g => g.totals.meals >= 100 },
  { icon: '⭐', name: 'Double Digits', desc: 'Reach level 10', test: g => g.overall.level >= 10 },
  { icon: '🌟', name: 'Quarter Century', desc: 'Reach level 25', test: g => g.overall.level >= 25 },
  { icon: '🏅', name: 'Halfway Legend', desc: 'Reach level 50', test: g => g.overall.level >= 50 },
];
