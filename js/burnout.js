// Stress and the Cyberpsychosis debuff (burnout tracker).
// Stress builds from late bedtimes and grinding without a rest day, and eases with good sleep,
// rest days and perfect nutrition. At 100% Cyberpsychosis hits: −20% XP and a 24-hour Loot Shop
// lockout, until an 8-hour sleep or a perfect MacroFactor day clears it.
import {
  BEDTIME_CUTOFF, DUNGEON_START, GOOD_SLEEP_HOURS, MACRO_TOLERANCE, MAX_GRIND_DAYS, MAX_STRESS,
  RECOVERY_SLEEP_HOURS, REST_DAY_BREAKERS, SHOP_LOCK_HOURS, STRESS_GOOD_SLEEP, STRESS_LATE_BEDTIME,
  STRESS_NO_REST_DAY, STRESS_PERFECT_NUTRITION, STRESS_REST_DAY,
} from './rpgMath.js';
import { addDays, parseDate, sum, todayStr } from './util.js';

const toMinutes = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Bedtimes after midnight (e.g. 00:30) count as later than the cutoff.
export function isLateBedtime(bedtime) {
  if (!bedtime) return false;
  let m = toMinutes(bedtime);
  if (m < 12 * 60) m += 24 * 60;
  return m > toMinutes(BEDTIME_CUTOFF);
}

// A day's calories and protein: the MacroFactor check-in if you logged one, otherwise your meals.
export function nutritionOf(dayLogs, settings) {
  const macros = dayLogs.filter(l => l.kind === 'macros').sort((a, b) => b.createdAt - a.createdAt)[0];
  const source = macros ? [macros] : dayLogs.filter(l => l.kind === 'meal');
  const calories = sum(source, l => l.calories);
  const protein = sum(source, l => l.protein);
  const target = Number(settings.calorieTarget) || 0;
  const proteinHit = settings.proteinTarget > 0 && protein >= settings.proteinTarget;
  return {
    calories,
    protein,
    proteinHit,
    perfect: target > 0 && proteinHit && Math.abs(calories - target) <= target * MACRO_TOLERANCE,
    at: Math.max(0, ...source.map(l => l.createdAt)),
    fromMacroFactor: !!macros,
  };
}

export function computeBurnout(logs, byDate, settings, today, now) {
  const events = [];

  for (const l of logs) {
    if (l.kind !== 'sleep' || l.createdAt < DUNGEON_START) continue;
    const hours = Number(l.hours) || 0;
    const cures = hours >= RECOVERY_SLEEP_HOURS && `${hours}h of sleep`;
    if (isLateBedtime(l.bedtime)) events.push({ at: l.createdAt, delta: STRESS_LATE_BEDTIME, cures, reason: `In bed at ${l.bedtime}, past the cutoff` });
    else if (hours >= GOOD_SLEEP_HOURS) events.push({ at: l.createdAt, delta: STRESS_GOOD_SLEEP, cures, reason: `${hours}h of sleep, in bed on time` });
    else if (cures) events.push({ at: l.createdAt, delta: 0, cures, reason: `${hours}h of sleep` });
  }

  let run = 0;
  for (let d = todayStr(new Date(DUNGEON_START)); d <= today; d = addDays(d, 1)) {
    const dayLogs = byDate[d] || [];
    const grind = dayLogs.filter(l => REST_DAY_BREAKERS.includes(l.kind));
    if (grind.length) {
      run++;
      if (run > MAX_GRIND_DAYS) events.push({ at: Math.min(...grind.map(l => l.createdAt)), delta: STRESS_NO_REST_DAY, reason: `Day ${run} in a row without a rest day` });
    } else if (d < today) {
      run = 0;
      events.push({ at: parseDate(addDays(d, 1)).getTime(), delta: STRESS_REST_DAY, reason: 'Took a rest day' });
    }
    const n = nutritionOf(dayLogs, settings);
    if (n.perfect) events.push({ at: n.at, delta: STRESS_PERFECT_NUTRITION, cures: 'Perfect nutrition day', reason: 'Hit your nutrition targets perfectly' });
  }

  events.sort((a, b) => a.at - b.at);
  let stress = 0;
  let active = null;
  const debuffs = [];
  const log = [];
  for (const e of events) {
    if (e.at > now) continue;
    if (active && e.cures) {
      active.end = e.at;
      active = null;
      stress = 0;
      log.push({ ...e, reason: e.cures, delta: null, result: 'Cyberpsychosis cured' });
      continue;
    }
    const before = stress;
    stress = Math.max(0, Math.min(MAX_STRESS, stress + e.delta));
    if (stress !== before) log.push({ ...e, delta: stress - before });
    if (!active && stress >= MAX_STRESS) {
      active = { start: e.at, end: null, shopUntil: e.at + SHOP_LOCK_HOURS * 3600000 };
      debuffs.push(active);
      log.push({ at: e.at, delta: null, reason: 'Stress hit 100%', result: 'Cyberpsychosis!' });
    }
  }

  return {
    stress,
    active,
    debuffedAt: t => debuffs.some(d => t >= d.start && (d.end == null || t < d.end)),
    shopLockedUntil: active && now < active.shopUntil ? active.shopUntil : null,
    log: log.reverse().slice(0, 12),
  };
}
