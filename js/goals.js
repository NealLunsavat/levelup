// Goals: each final goal is an "operation", broken into ranked "targets" (sub-goals).
// Targets sit in a priority stack. The top one that isn't cleared yet is the prime target,
// and clearing targets in rank order earns a prime bonus.
//
// A target is one of:
//   debt   – linked to a debt boss; progress follows the payments you log
//   amount – a number to reach (dollars saved, pounds, hours...), updated by hand
//   check  – a milestone that is either done or not
import { monthlyInterest } from './rpgMath.js';
import { cents, sum } from './util.js';

export const TARGET_KINDS = {
  debt: { label: 'Debt', icon: '💳' },
  amount: { label: 'Number', icon: '📈' },
  check: { label: 'Milestone', icon: '✅' },
};

function evaluateTarget(t, bossById) {
  const base = { rec: t, id: t.id, kind: t.kind, title: t.title, unit: '', apr: 0, interest: 0, orphan: false };
  if (t.kind === 'debt') {
    const boss = bossById[t.debtId];
    // The debt boss was deleted on the Finance page: keep the row so it can be removed here.
    if (!boss) return { ...base, title: `${t.title || 'Debt'} (deleted)`, orphan: true, money: true, total: 0, current: 0, pct: 0, done: false, doneAt: null };
    const total = Number(boss.balance) || 0;
    return {
      ...base, title: boss.name, money: true, unit: '$', apr: Number(boss.apr) || 0,
      interest: monthlyInterest(boss.remaining, boss.apr), // what it costs you each month right now
      total, current: Math.min(boss.paid, total), pct: boss.pct,
      done: !!boss.defeatedOn, doneAt: boss.defeatedAt ?? null,
    };
  }
  if (t.kind === 'amount') {
    const total = Number(t.target) || 0;
    const current = Math.max(0, Number(t.current) || 0);
    const done = total > 0 && cents(current) >= cents(total);
    return {
      ...base, money: t.unit === '$', unit: t.unit || '',
      total, current: Math.min(current, total), pct: total ? Math.min(1, current / total) : 0,
      done, doneAt: done ? t.doneAt ?? t.updatedAt : null,
    };
  }
  const done = !!t.doneAt;
  return { ...base, money: false, total: 1, current: done ? 1 : 0, pct: done ? 1 : 0, done, doneAt: t.doneAt ?? null };
}

export function evaluateGoals(goals, targets, bosses) {
  const bossById = Object.fromEntries(bosses.map(b => [b.id, b]));
  return goals.map(g => {
    const list = targets
      .filter(t => t.goalId === g.id)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.createdAt - b.createdAt)
      .map(t => evaluateTarget(t, bossById));
    // Cleared "in order": everything ranked above it was already down when it fell.
    list.forEach((t, i) => {
      t.inOrder = t.done && list.slice(0, i).every(o => o.done && o.doneAt <= t.doneAt);
    });
    const active = list.filter(t => !t.done);
    const cleared = list.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
    // When every target is money, progress is dollars cleared; otherwise it's the average of the targets.
    const money = list.length > 0 && list.every(t => t.money);
    const total = money ? sum(list, t => t.total) : list.length;
    const current = money ? sum(list, t => t.current) : sum(list, t => t.pct);
    const complete = list.length > 0 && active.length === 0;
    return {
      ...g, rec: g, targets: list, active, cleared, prime: active[0] ?? null,
      interest: sum(active, t => t.interest),
      money, total, current, pct: total ? current / total : 0,
      complete, completedAt: complete ? Math.max(...list.map(t => t.doneAt)) : null,
    };
  });
}
