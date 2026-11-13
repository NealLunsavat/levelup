// The game rules: attributes, skills, what each activity is worth, quests, streaks and achievements.
// Your character (XP, levels, HP, Gold, buffs) is always recomputed from your logs, so tweaking a
// number here or in rpgMath.js re-scores your whole history.
import { todayStr, addDays, cents, dayOfWeek, groupBy, parseDate, sum, timeOn, weekStart } from './util.js';
import {
  AMBUSH_GOLD, AMBUSH_HP_LOSS, AMBUSH_XP, BOUNTY_XP, CAREER_QUEST_XP, CRIT_MULTIPLIER, CYBERPSYCHOSIS_XP, DUNGEON_START,
  HP_REGEN_PER_QUEST, MAIN_QUEST_DEADLINE, MAIN_QUEST_GOLD, MAIN_QUEST_PENALTY, MAIN_QUEST_XP, MAX_HP, MAX_STRESS,
  MENTAL_RESET_BONUS, OPERATION_XP, OVERDRIVE_MULTIPLIER, PERFECT_NUTRITION_XP, PRIME_BONUS_XP, SAVE_STATE_BONUS,
  STEALTH_MULTIPLIER, TARGET_XP, clampHP, goldFromLog, isCrit, levelFromXP, monthlyInterest,
} from './rpgMath.js';
import { evaluateGoals } from './goals.js';
import { evaluateWeekly } from './weekly.js';
import { OVERDRIVE_QUESTS, dungeonFor, evaluateQuest } from './dungeon.js';
import { computeBurnout, nutritionOf } from './burnout.js';
import { encountersFor } from './nasm.js';
import { evaluateCareer } from './career.js';

// The five character attributes. `page` is the skill page each one links to.
export const ATTRIBUTES = [
  { id: 'str', name: 'STR', full: 'Physique', icon: '💪', color: '#ff6b2c', page: 'gym' },
  { id: 'int', name: 'INT', full: 'Knowledge', icon: '🧠', color: '#00e5ff', page: 'study' },
  { id: 'tech', name: 'TECH', full: 'Creative', icon: '🎨', color: '#ff2e88', page: 'art' },
  { id: 'cha', name: 'CHA', full: 'Brand', icon: '🎥', color: '#b45cff', page: 'content' },
  { id: 'cred', name: 'CRED', full: 'Wealth', icon: '💰', color: '#ffb627', page: 'finance' },
];
export const ATTR_OF_SKILL = { gym: 'str', food: 'str', study: 'int', art: 'tech', content: 'cha', finance: 'cred' };
const ATTR_BY_ID = Object.fromEntries(ATTRIBUTES.map(a => [a.id, a]));

// Skills are the activity pages; each feeds an attribute. Hidden skills don't show in the grid.
export const SKILLS = [
  { id: 'finance', name: 'Finance', icon: '💰', color: '#ffb627', blurb: 'Debt bosses, gig and IT shifts' },
  { id: 'study', name: 'NASM', icon: '📚', color: '#00e5ff', blurb: 'Certification study' },
  { id: 'art', name: 'Art', icon: '🎨', color: '#ff2e88', blurb: 'Procreate anime drawing' },
  { id: 'content', name: 'Content', icon: '🎥', color: '#b45cff', blurb: 'Apple Log 2 shoots and DaVinci edits' },
  { id: 'gym', name: 'Strength', icon: '🏋️', color: '#ff6b2c', blurb: 'Workouts and PRs' },
  { id: 'food', name: 'Nutrition', icon: '🥗', color: '#2bff88', blurb: 'Meals and macros' },
  { id: 'rest', name: 'Rest', icon: '🛌', color: '#7dd3fc', blurb: 'Sleep, gaming and recovery', hidden: true },
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
  macros: { skill: 'food', label: 'MacroFactor day', icon: '📊', xp: () => 10 },
  rest: { skill: 'rest', label: 'Tavern rest', icon: '🎮', xp: () => 0 },
  sleep: { skill: 'rest', label: 'Sleep', icon: '😴', xp: () => 0 },
  career: { skill: null, label: 'Career quest', icon: '🎯', xp: () => CAREER_QUEST_XP },
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

export const bountyTickId = (bountyId, date) => `bt-${bountyId}-${date}`;
export const mainQuestId = date => `main-${date}`;
export const prepId = date => `prep-${date}`;

export function buildGame(data, today = todayStr(), now = Date.now()) {
  const {
    logs, quests, debts, loot, ambushes, career, settings, skills,
    goals = [], targets = [], weekly = [], wprog = [], wdone = [], mains = [], bounties = [], bticks = [], preps = [],
  } = data;
  const byDate = groupBy(logs, l => l.date);
  const dayAt = date => Math.max(0, ...(byDate[date] || []).map(l => l.createdAt));
  const startOf = date => parseDate(date).getTime();
  const skillOf = attr => ATTR_BY_ID[attr]?.page ?? 'bonus';

  // 1. The Daily Dungeon for every day since it started tracking.
  const prepByDate = Object.fromEntries(preps.map(p => [p.date, p]));
  const dungeonDays = {};
  for (let d = todayStr(new Date(DUNGEON_START)); d <= today; d = addDays(d, 1)) {
    dungeonDays[d] = dungeonFor(d).map(q => evaluateQuest(q, byDate[d] || [], now, prepByDate[d]));
  }
  const dungeonToday = dungeonDays[today] ?? dungeonFor(today).map(q => evaluateQuest(q, byDate[today] || [], now, prepByDate[today]));
  const questOn = (date, id) => dungeonDays[date]?.find(q => q.id === id);

  // 2. Stress and Cyberpsychosis.
  const burnout = computeBurnout(logs, byDate, settings, today, now);

  // 3. Buffs and debuffs.
  //    Mental Reset (+5%): all day, after last night's Tavern Rest.
  //    Save State (+5%): in the Iron Dungeon, the morning after Inventory Management.
  //    Overdrive (2×): from the moment the day's four core quests are all cleared until midnight.
  //    Cyberpsychosis (−20%): gains made while it's active.
  const mentalReset = date => questOn(addDays(date, -1), 'tavern')?.status === 'complete';
  const saveState = date => questOn(addDays(date, -1), 'prep')?.status === 'complete';
  const overdriveAt = {};
  for (const [date, day] of Object.entries(dungeonDays)) {
    const core = OVERDRIVE_QUESTS.map(id => day.find(q => q.id === id));
    if (core.every(q => q?.status === 'complete')) overdriveAt[date] = Math.max(...core.map(q => q.completedAt));
  }
  const inOverdrive = (date, at) => overdriveAt[date] != null && at > overdriveAt[date] && at < startOf(addDays(date, 1));
  const inSavedIron = (date, at) => {
    const iron = questOn(date, 'iron');
    return !!iron && at >= iron.start && at <= iron.graceEnd && saveState(date);
  };
  const multiplier = (date, at) =>
    (mentalReset(date) ? MENTAL_RESET_BONUS : 1) *
    (burnout.debuffedAt(at) ? CYBERPSYCHOSIS_XP : 1) *
    (inOverdrive(date, at) ? OVERDRIVE_MULTIPLIER : 1) *
    (inSavedIron(date, at) ? SAVE_STATE_BONUS : 1);

  // 4. XP. Every source goes through add(), which applies buffs and debuffs.
  const skillXP = Object.fromEntries(skills.map(s => [s.id, 0]));
  const attrXP = Object.fromEntries(ATTRIBUTES.map(a => [a.id, 0]));
  const xpByDate = {};
  const xpOfLog = {};
  const attrByDate = {};
  let total = 0;
  const add = (date, skill, base, at) => {
    const xp = Math.round(base * multiplier(date, at));
    if (!xp) return 0;
    total += xp;
    xpByDate[date] = (xpByDate[date] || 0) + xp;
    if (skill in skillXP) skillXP[skill] += xp;
    const attr = ATTR_OF_SKILL[skill];
    if (attr) {
      attrXP[attr] += xp;
      const day = (attrByDate[date] ??= {});
      day[attr] = (day[attr] || 0) + xp;
    }
    return xp;
  };

  // A critical hit doubles a log's XP and Gold.
  const critOf = l => isCrit(l.id) && (logXP(l) > 0 || goldFromLog(l) > 0);
  for (const l of logs) {
    const it = questOn(l.date, 'it');
    const stealth = it?.stealthActive && it.stealthIds.includes(l.id) ? STEALTH_MULTIPLIER : 1;
    xpOfLog[l.id] = add(l.date, l.skill, logXP(l) * stealth * (critOf(l) ? CRIT_MULTIPLIER : 1), l.createdAt);
  }

  // Daily quests and nutrition bonuses.
  for (const [date, dayLogs] of Object.entries(byDate)) {
    const active = quests.filter(q => questActiveOn(q, date));
    const done = active.filter(q => questProgress(q, dayLogs).done);
    for (const q of done) add(date, q.skill, BONUS.quest, dayAt(date));
    if (active.length && done.length === active.length) add(date, 'bonus', BONUS.allQuests, dayAt(date));
    const n = nutritionOf(dayLogs, settings);
    if (n.proteinHit) add(date, 'food', BONUS.protein, n.at);
    if (n.perfect) add(date, 'food', PERFECT_NUTRITION_XP, n.at);
  }

  // Dungeon rewards, Gold and HP.
  let goldEarned = sum(logs, l => goldFromLog(l) * (critOf(l) ? CRIT_MULTIPLIER : 1));
  const hpEvents = [];
  for (const [date, day] of Object.entries(dungeonDays)) {
    for (const q of day) {
      if (q.status === 'complete') {
        for (const o of q.objectives.filter(o => o.done)) {
          for (const [attr, xp] of Object.entries(o.xp ?? {})) add(date, skillOf(attr), xp, q.completedAt);
        }
        goldEarned += q.gold || 0;
        hpEvents.push({ at: q.completedAt, delta: q.heal ?? HP_REGEN_PER_QUEST });
      } else if (q.status === 'missed' && q.penalty) {
        hpEvents.push({ at: q.graceEnd, delta: -q.penalty });
      }
    }
  }

  // NASM Ambush results.
  for (const a of ambushes) {
    if (a.correct) {
      add(a.date, 'study', AMBUSH_XP, a.answeredAt);
      goldEarned += AMBUSH_GOLD;
    } else {
      hpEvents.push({ at: a.answeredAt, delta: -AMBUSH_HP_LOSS });
    }
  }

  // The daily Main Quest: a big bounty if it's cleared by the deadline, an HP hit if it isn't.
  const mainState = m => {
    if (!m?.title) return 'empty';
    const deadline = timeOn(m.date, MAIN_QUEST_DEADLINE);
    if (m.doneAt && m.doneAt <= deadline) return 'done';
    return now > deadline ? 'failed' : 'active';
  };
  for (const m of mains) {
    const state = mainState(m);
    const deadline = timeOn(m.date, MAIN_QUEST_DEADLINE);
    if (state === 'done') {
      add(m.date, skillOf(m.attr), MAIN_QUEST_XP, m.doneAt);
      goldEarned += MAIN_QUEST_GOLD;
    } else if (state === 'failed' && m.createdAt <= deadline) {
      hpEvents.push({ at: deadline, delta: -MAIN_QUEST_PENALTY });
    }
  }

  // Micro-bounties ticked off during IT downtime, and weekly quest rewards that were claimed.
  for (const t of bticks) add(t.date, skillOf(t.attr), (Number(t.xp) || BOUNTY_XP) * (isCrit(t.id) ? CRIT_MULTIPLIER : 1), t.at);
  for (const c of wdone) {
    const date = todayStr(new Date(c.at));
    for (const r of c.rewards ?? []) add(date, skillOf(r.attr), (Number(r.xp) || 0) * (isCrit(c.id) ? CRIT_MULTIPLIER : 1), c.at);
  }

  const hp = hpEvents.sort((a, b) => a.at - b.at).reduce((v, e) => clampHP(v + e.delta), MAX_HP);
  const purchases = loot.filter(i => i.purchasedAt);
  const goldSpent = sum(purchases, i => i.goldCost);

  // A pending ambush: an encounter whose time has come during today's IT shift and isn't answered yet.
  const itToday = dungeonToday.find(q => q.id === 'it');
  const encounters = itToday ? encountersFor(itToday).map(e => ({ ...e, result: ambushes.find(a => a.id === e.id) ?? null })) : [];
  const shiftOpen = !!itToday && now >= itToday.start && now <= itToday.end;
  const pendingAmbush = shiftOpen ? encounters.find(e => e.at <= now && e.at >= DUNGEON_START && !e.result) ?? null : null;

  // 5. Debt bosses. Money is compared in whole cents so a balance like $1,234.56 pays off exactly.
  const bosses = debts.map(d => {
    const payments = logs
      .filter(l => l.kind === 'payment' && l.debtId === d.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    const owed = cents(d.balance);
    let paid = 0;
    let defeated = null;
    for (const p of payments) {
      paid += cents(p.amount);
      if (!defeated && owed > 0 && paid >= owed) defeated = p;
    }
    if (defeated) add(defeated.date, 'finance', BONUS.boss, defeated.createdAt);
    const remaining = Math.max(0, owed - paid) / 100;
    return {
      ...d, paid: paid / 100, remaining, pct: owed ? Math.min(1, paid / owed) : 0,
      interest: monthlyInterest(remaining, d.apr),
      defeatedOn: defeated?.date ?? null, defeatedAt: defeated?.createdAt ?? null,
    };
  }).sort((a, b) => !!a.defeatedOn - !!b.defeatedOn || a.remaining - b.remaining);

  // Goals: a bounty for every target cleared (more if it was the prime target), and a big one for the operation.
  const operations = evaluateGoals(goals, targets, bosses);
  for (const op of operations) {
    for (const t of op.targets) {
      if (t.done) add(todayStr(new Date(t.doneAt)), op.skill, TARGET_XP + (t.inOrder ? PRIME_BONUS_XP : 0), t.doneAt);
    }
    if (op.complete) add(todayStr(new Date(op.completedAt)), op.skill, OPERATION_XP, op.completedAt);
  }

  // 6. Streak = consecutive days with every daily quest cleared. Days with none scheduled don't break it,
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

  // 7. This week's quests (Monday to Sunday).
  const week = weekStart(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const weeklyQuests = evaluateWeekly(weekly, wprog, wdone, {
    week, days: weekDays, byDate, settings, logs: logs.filter(l => l.date >= week && l.date <= weekDays[6]),
  });

  // 8. Today's main quest, tomorrow's, and the IT-shift bounty board.
  const mainOn = date => {
    const rec = mains.find(m => m.date === date) ?? null;
    return { date, rec, status: mainState(rec), deadline: timeOn(date, MAIN_QUEST_DEADLINE) };
  };
  const bountyBoard = {
    open: shiftOpen,
    closesAt: itToday?.end ?? null,
    list: bounties.filter(b => b.active !== false).map(b => ({ ...b, tick: bticks.find(t => t.id === bountyTickId(b.id, today)) ?? null })),
  };

  const attributes = ATTRIBUTES.map(a => ({ ...a, xp: attrXP[a.id], ...levelFromXP(attrXP[a.id]) }));
  // Your build 4 weeks ago, for the radar chart's comparison outline.
  const cutoff = addDays(today, -28);
  const xpAgo = Object.fromEntries(ATTRIBUTES.map(a => [a.id, 0]));
  for (const [date, byAttr] of Object.entries(attrByDate)) {
    if (date <= cutoff) for (const [id, xp] of Object.entries(byAttr)) xpAgo[id] += xp;
  }
  const attributesAgo = ATTRIBUTES.map(a => ({ id: a.id, xp: xpAgo[a.id], ...levelFromXP(xpAgo[a.id]) }));

  const overdrive = inOverdrive(today, now) ? { since: overdriveAt[today], until: startOf(addDays(today, 1)) } : null;
  const ironToday = questOn(today, 'iron');
  const buffs = [];
  if (overdrive) buffs.push({ icon: '⚡', name: 'Sandevistan Overdrive', desc: '2× XP until midnight' });
  if (mentalReset(today)) buffs.push({ icon: '🧘', name: 'Mental Reset', desc: '+5% XP today' });
  if (saveState(today) && ironToday && now <= ironToday.graceEnd) buffs.push({ icon: '💾', name: 'Save State', desc: '+5% XP in the Iron Dungeon' });
  if (burnout.active) buffs.push({ icon: '🧠', name: 'Cyberpsychosis', desc: '−20% XP', bad: true });

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
    buffs,
    multiplierNow: multiplier(today, now),
    overdrive,
    stress: burnout.stress,
    maxStress: MAX_STRESS,
    cyberpsychosis: burnout.active,
    shopLockedUntil: burnout.shopLockedUntil,
    stressLog: burnout.log,
    nutritionToday: nutritionOf(todayLogs, settings),
    encounters,
    pendingAmbush,
    career: evaluateCareer(career, attributes),
    goals: operations,
    weekly: weeklyQuests,
    week,
    weekResetsAt: startOf(addDays(week, 7)),
    main: mainOn(today),
    mainTomorrow: mainOn(addDays(today, 1)),
    bountyBoard,
    attributes,
    attributesAgo,
    skillXP,
    skillLevels: Object.fromEntries(Object.entries(skillXP).map(([id, xp]) => [id, levelFromXP(xp)])),
    xpByDate,
    xpOfLog,
    critIds: new Set(logs.filter(critOf).map(l => l.id)),
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
      ambushWins: ambushes.filter(a => a.correct).length,
      lootBought: purchases.length,
      primeClears: sum(operations, op => op.targets.filter(t => t.inOrder).length),
      opsComplete: operations.filter(op => op.complete).length,
      crits: logs.filter(critOf).length,
      overdriveDays: Object.keys(overdriveAt).length,
      weeklyClaims: wdone.length,
      mainsDone: mains.filter(m => mainState(m) === 'done').length,
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
  { icon: '🥷', name: 'Ambush Survivor', desc: 'Win 10 NASM Ambushes', test: g => g.totals.ambushWins >= 10 },
  { icon: '🛍️', name: 'First Loot', desc: 'Buy something from the Loot Shop', test: g => g.totals.lootBought >= 1 },
  { icon: '🎓', name: 'Certified', desc: 'Unlock the first Career node', test: g => g.career.nodes[0].status === 'unlocked' },
  { icon: '🎯', name: 'Sharpshooter', desc: 'Take down a prime target', test: g => g.totals.primeClears >= 1 },
  { icon: '🏁', name: 'Mission Accomplished', desc: 'Complete a final goal', test: g => g.totals.opsComplete >= 1 },
  { icon: '⚡', name: 'Lucky Strike', desc: 'Land a critical hit', test: g => g.totals.crits >= 1 },
  { icon: '🚀', name: 'Overdrive', desc: 'Clear all four core dungeon quests in one day', test: g => g.totals.overdriveDays >= 1 },
  { icon: '🗓️', name: 'Weekly Warrior', desc: 'Claim 10 weekly quests', test: g => g.totals.weeklyClaims >= 10 },
  { icon: '🐸', name: 'Frog Eater', desc: 'Clear 7 main quests', test: g => g.totals.mainsDone >= 7 },
];
