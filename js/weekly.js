// Weekly quests: things to finish or make progress on between Monday and Sunday.
// A quest either counts taps (manual) or tracks itself from what you log. When it's complete you
// claim the reward, which saves a permanent record, so editing or deleting a quest later never
// takes back XP you already earned.
import { nutritionOf } from './burnout.js';
import { sum } from './util.js';

const ROTATION = ['Upper body', 'Lower body', 'Push', 'Pull', 'Legs'];
const FACE_FOCUS = ['Faces', 'Angles', 'Proportions'];
const count = (logs, test) => logs.filter(test).length;
const minutes = (logs, kind) => sum(logs, l => (l.kind === kind ? l.minutes : 0));

// What a weekly quest can track on its own. `w` is the week: { logs, days, byDate, settings }.
export const WEEKLY_METRICS = {
  earned: { label: '$ earned driving (DoorDash / Spark)', money: true, of: w => sum(w.logs, l => (l.kind === 'shift' ? l.amount : 0)) },
  paid: { label: '$ paid toward debt', money: true, of: w => sum(w.logs, l => (l.kind === 'payment' ? l.amount : 0)) },
  itShifts: { label: 'IT shifts logged', of: w => count(w.logs, l => l.kind === 'itshift') },
  workouts: { label: 'Workouts logged', of: w => count(w.logs, l => l.kind === 'workout') },
  rotation: { label: 'Workout splits hit (Upper, Lower, Push, Pull, Legs)', of: w => new Set(w.logs.filter(l => l.kind === 'workout' && ROTATION.includes(l.category)).map(l => l.category)).size },
  perfectDays: { label: 'Perfect nutrition days', of: w => w.days.filter(d => nutritionOf(w.byDate[d] || [], w.settings).perfect).length },
  studyHours: { label: 'Hours of NASM study', decimals: true, of: w => minutes(w.logs, 'study') / 60 },
  quiz80: { label: 'Practice quizzes at 80% or higher', of: w => count(w.logs, l => l.kind === 'quiz' && l.score >= 80) },
  drawSessions: { label: 'Drawing sessions', of: w => count(w.logs, l => l.kind === 'draw') },
  faceSessions: { label: 'Drawing sessions on faces, angles or proportions', of: w => count(w.logs, l => l.kind === 'draw' && (l.focus || []).some(f => FACE_FOCUS.includes(f))) },
  contentSessions: { label: 'Content sessions (shoot or edit)', of: w => count(w.logs, l => l.kind === 'content') },
};

export const claimId = (questId, week) => `wd-${questId}-${week}`;
export const progressId = (questId, week) => `wp-${questId}-${week}`;

// This week's quests with their progress. `progress` are manual tap counts, `claims` are rewards taken.
export function evaluateWeekly(quests, progress, claims, w) {
  return quests.filter(q => q.active !== false).map(q => {
    const metric = WEEKLY_METRICS[q.track];
    const target = Number(q.target) || 1;
    const value = metric ? metric.of(w) : Number(progress.find(p => p.id === progressId(q.id, w.week))?.count) || 0;
    return {
      ...q, rec: q, manual: !metric, money: !!metric?.money, decimals: !!metric?.decimals,
      value, target, pct: Math.min(1, value / target), complete: value >= target,
      claim: claims.find(c => c.id === claimId(q.id, w.week)) ?? null,
    };
  });
}
