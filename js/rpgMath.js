// All the RPG numbers in one place: the XP curve, the Gold economy, HP and multipliers.

// ---- XP ----

// XP needed to go from `level` to `level + 1`. Early levels are quick; later ones are a grind.
export const calculateRequiredXP = level => Math.floor(100 * Math.pow(level, 1.5));

export function levelFromXP(xp) {
  let level = 1;
  let into = Math.max(0, xp);
  let need = calculateRequiredXP(1);
  while (into >= need) {
    into -= need;
    level++;
    need = calculateRequiredXP(level);
  }
  return { level, into, need, pct: into / need };
}

// ---- Gold (CRED) ----

export const GOLD_PER_DOLLAR_EARNED = 1; // DoorDash / Spark Driver
export const GOLD_PER_DOLLAR_PAID = 1; // debt payments
export const GOLD_PER_IRL_DOLLAR = 10; // Loot Shop: 10 Gold buys $1 of real-world spending

export function goldFromLog(l) {
  if (l.kind === 'shift') return (Number(l.amount) || 0) * GOLD_PER_DOLLAR_EARNED;
  if (l.kind === 'payment') return (Number(l.amount) || 0) * GOLD_PER_DOLLAR_PAID;
  return 0;
}

// A $50 hoodie costs 500 Gold.
export const goldCost = usd => Math.ceil((Number(usd) || 0) * GOLD_PER_IRL_DOLLAR);

// ---- HP ----

export const MAX_HP = 100;
export const HP_REGEN_PER_QUEST = 5; // every Daily Dungeon quest cleared heals a little
export const clampHP = hp => Math.max(0, Math.min(MAX_HP, hp));

// ---- Multipliers & timing ----

export const STEALTH_MULTIPLIER = 1.5; // INT bonus for studying during the IT shift...
export const STEALTH_MIN_MINUTES = 120; // ...once you've logged 2 hours of it that shift
export const MENTAL_RESET_BONUS = 1.05; // Tavern Rest: +5% XP the next day
export const QUEST_GRACE_MIN = 60; // minutes after a window closes that you can still log it

// The Daily Dungeon started tracking here. Quests, stress and ambushes before this can't hurt you.
export const DUNGEON_START = new Date('2026-11-12T17:00').getTime();

// ---- Stress & the Cyberpsychosis debuff ----

export const MAX_STRESS = 100;
export const BEDTIME_CUTOFF = '21:00'; // in bed later than this adds stress
export const STRESS_LATE_BEDTIME = 25;
export const GOOD_SLEEP_HOURS = 7;
export const STRESS_GOOD_SLEEP = -15; // in bed on time with 7+ hours
export const RECOVERY_SLEEP_HOURS = 8; // an 8-hour sleep cures Cyberpsychosis
export const REST_DAY_BREAKERS = ['workout', 'shift']; // a day with none of these is a rest day
export const MAX_GRIND_DAYS = 6; // the 7th day in a row without a rest day starts adding stress
export const STRESS_NO_REST_DAY = 20;
export const STRESS_REST_DAY = -20;
export const STRESS_PERFECT_NUTRITION = -10;
export const CYBERPSYCHOSIS_XP = 0.8; // −20% to all XP while it's active
export const SHOP_LOCK_HOURS = 24;

// ---- Nutrition ----

export const MACRO_TOLERANCE = 0.05; // within ±5% of your calorie target (and protein hit) is a perfect day
export const PERFECT_NUTRITION_XP = 60;

// ---- NASM Ambush ----

export const AMBUSHES_PER_SHIFT = 2;
export const AMBUSH_XP = 50; // INT
export const AMBUSH_GOLD = 5;
export const AMBUSH_HP_LOSS = 5;

// ---- Career ----

export const CAREER_QUEST_XP = 40;

// ---- Goals ----

export const TARGET_XP = 150; // bounty for clearing any target (sub-goal)
export const PRIME_BONUS_XP = 100; // extra for clearing it while it's the prime (top-ranked) target
export const OPERATION_XP = 1000; // finishing a whole final goal

// Roughly what a balance costs in interest per month at an APR. Cards really charge daily, so it's an estimate.
export const monthlyInterest = (balance, apr) => ((Number(balance) || 0) * (Number(apr) || 0)) / 100 / 12;

// ---- Critical hits ----

export const CRIT_CHANCE = 0.1; // 1 in 10 logs
export const CRIT_MULTIPLIER = 2; // doubles that log's XP and Gold

// Whether a record is a critical hit. It's decided by the record's random id, so it's a surprise
// when you log it, but it never changes afterwards and every synced device agrees.
export function isCrit(id) {
  let h = 2166136261;
  const s = 'crit:' + id;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000 < CRIT_CHANCE;
}

// ---- Overdrive, save state, main quest, bounties ----

export const OVERDRIVE_MULTIPLIER = 2; // XP for the rest of the day after a perfect dungeon run
export const SAVE_STATE_BONUS = 1.05; // Iron Dungeon XP the morning after Inventory Management
export const MAIN_QUEST_XP = 300;
export const MAIN_QUEST_GOLD = 50;
export const MAIN_QUEST_PENALTY = 25; // HP lost if it isn't cleared by the deadline
export const MAIN_QUEST_DEADLINE = '21:00';
export const BOUNTY_XP = 20; // default reward for a micro-bounty
