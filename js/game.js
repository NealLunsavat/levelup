// The game rules: skills, what each activity is worth, levels, quests, streaks and achievements.
// XP is always recomputed from your logs, so tweaking a number here re-scores your whole history.
import { todayStr, addDays, dayOfWeek, sum, groupBy } from './util.js';

export const SKILLS = [
  { id: 'finance', name: 'Finance', icon: '💰', color: '#f5c542', blurb: 'Debt bosses and gig income' },
  { id: 'study', name: 'NASM', icon: '📚', color: '#4fa3ff', blurb: 'Certification study' },
  { id: 'art', name: 'Art', icon: '🎨', color: '#ff6fb5', blurb: 'Anime drawing practice' },
  { id: 'gym', name: 'Strength', icon: '🏋️', color: '#ff7a45', blurb: 'Workouts and PRs' },
  { id: 'food', name: 'Nutrition', icon: '🥗', color: '#4cd18a', blurb: 'Meals and macros' },
];

// Each kind of log, which skill it trains, and its XP.
export const KINDS = {
  payment: { skill: 'finance', label: 'Debt payment', icon: '⚔️', xp: l => l.amount / 2 },
  shift: { skill: 'finance', label: 'Gig shift', icon: '🚗', xp: l => l.amount / 2 + (l.hours || 0) * 5 },
  study: { skill: 'study', label: 'Study session', icon: '📖', xp: l => l.minutes * 2 },
  quiz: { skill: 'study', label: 'Practice quiz', icon: '📝', xp: l => 20 + (l.score || 0) / 2 },
  draw: { skill: 'art', label: 'Drawing session', icon: '✏️', xp: l => l.minutes * 2 },
  workout: { skill: 'gym', label: 'Workout', icon: '💪', xp: l => 30 + l.minutes * 2 },
  pr: { skill: 'gym', label: 'Personal record', icon: '🏆', xp: () => 75 },
  meal: { skill: 'food', label: 'Meal', icon: '🍽️', xp: () => 10 },
  activity: { skill: null, label: 'Session', icon: '⭐', xp: l => 10 + (l.minutes || 0) * 2 },
};

export const BONUS = { quest: 25, allQuests: 100, boss: 500, protein: 40 };

export function logXP(l) {
  const v = KINDS[l.kind]?.xp(l);
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

// Each level needs a bit more XP than the last.
export function levelInfo(xp, base = 100, step = 40) {
  let level = 1;
  let need = base;
  let into = xp;
  while (into >= need) {
    into -= need;
    level++;
    need = base + step * (level - 1);
  }
  return { level, into, need, pct: into / need };
}

export const skillLevel = xp => levelInfo(xp, 60, 20);

const TITLES = [[1, 'Novice'], [5, 'Apprentice'], [10, 'Adventurer'], [15, 'Challenger'], [20, 'Veteran'],
  [30, 'Elite'], [40, 'Champion'], [50, 'Master'], [75, 'Grandmaster'], [100, 'Legend']];
export const titleFor = level => TITLES.filter(([min]) => level >= min).pop()[1];

// ---- Daily quests ----

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

export function buildGame({ logs, quests, debts, settings, skills }, today = todayStr()) {
  const skillXP = Object.fromEntries(skills.map(s => [s.id, 0]));
  const xpByDate = {};
  let total = 0;
  const add = (date, skill, xp) => {
    if (!xp) return;
    total += xp;
    xpByDate[date] = (xpByDate[date] || 0) + xp;
    if (skill in skillXP) skillXP[skill] += xp;
  };

  for (const l of logs) add(l.date, l.skill, logXP(l));

  const byDate = groupBy(logs, l => l.date);
  for (const [date, dayLogs] of Object.entries(byDate)) {
    const active = quests.filter(q => questActiveOn(q, date));
    const done = active.filter(q => questProgress(q, dayLogs).done);
    for (const q of done) add(date, q.skill, BONUS.quest);
    if (active.length && done.length === active.length) add(date, 'bonus', BONUS.allQuests);
    if (settings.proteinTarget > 0 && sum(dayLogs, l => l.protein) >= settings.proteinTarget) add(date, 'food', BONUS.protein);
  }

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

  // Streak = consecutive days with every quest cleared. Days with no quests scheduled don't break it,
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

  const overall = levelInfo(total);
  return {
    today,
    total,
    overall,
    title: titleFor(overall.level),
    skillXP,
    skillLevels: Object.fromEntries(Object.entries(skillXP).map(([id, xp]) => [id, skillLevel(xp)])),
    xpByDate,
    todayXP: xpByDate[today] || 0,
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
