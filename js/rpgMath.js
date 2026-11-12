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

// The Daily Dungeon started tracking here. Quests that began earlier can't cost HP.
export const DUNGEON_START = new Date('2026-11-12T17:00').getTime();
