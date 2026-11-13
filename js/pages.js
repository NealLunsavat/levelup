// Home, skill pages and stats.
import { html, useState } from '../vendor/preact-htm.js';
import { ACHIEVEMENTS, ATTR_OF_SKILL, BONUS, KINDS } from './game.js';
import { put, remove } from './store.js';
import { AttributeGrid, Bar, BuildRadar, Card, Empty, LogList, PlayerCard, Sheet, SkillGrid, Stat, useApp } from './components.js';
import { QuestBoard } from './questboard.js';
import { CareerQuests } from './skilltree.js';
import { PrimeTargets } from './goalspage.js';
import { BountyBoard, MainQuest, WeeklyQuests } from './boards.js';
import { haptic, play } from './fx.js';
import { PERFECT_NUTRITION_XP } from './rpgMath.js';
import { ART_FOCUS, Num, Text } from './logsheet.js';
import { DAY_LETTERS, addDays, dayOfWeek, daysBetween, fmtDate, fmtMinutes, fmtMoney, fmtNum, groupBy, parseDate, sum } from './util.js';

// ---------------- Home ----------------

export function Home() {
  const { game, data, skillMap, openLog } = useApp();
  const quests = game.todayQuests;
  const done = quests.filter(q => q.done).length;
  return html`<div class="page">
    <${PlayerCard} />
    ${game.cyberpsychosis && html`<div class="banner danger">🧠 <b>CYBERPSYCHOSIS</b>: −20% XP${game.shopLockedUntil ? ' and the Loot Shop is locked' : ''}. Cure it with an 8-hour sleep or a perfect nutrition day.</div>`}

    <${QuickLog} />
    <${MainQuest} />
    <${BountyBoard} />
    <${PrimeTargets} />
    <${QuestBoard} />
    <${CareerQuests} home />

    <${Card} title="Daily quests" right=${html`<span class="muted small">${done}/${quests.length} cleared</span>`}>
      ${quests.length ? html`<div class="quest-list">${quests.map(q => html`<${QuestRow} q=${q} skill=${skillMap[q.skill]} onClick=${() => openLog({ skill: q.skill })} />`)}</div>`
        : html`<${Empty}>No quests scheduled today. Rest day! Edit quests in <a href="#/settings">Settings</a>.<//>`}
      ${game.allClear && html`<div class="banner">🎉 All daily quests cleared! +${BONUS.allQuests} bonus XP</div>`}
    <//>

    <${WeeklyQuests} />

    <div class="section-head"><h3>Attributes</h3><a class="small link" href="#/skills">All skills</a></div>
    <${AttributeGrid} />

    <${Card} title="Recent activity">
      <${LogList} logs=${data.logs} limit=${8} />
    <//>
  </div>`;
}

// One-tap logging for the things you log most.
const QUICK = [['shift', 'Shift'], ['study', 'Study'], ['workout', 'Workout'], ['meal', 'Meal'], ['sleep', 'Sleep']];

function QuickLog() {
  const { openLog } = useApp();
  return html`<div class="quick-log" role="group" aria-label="Quick log">
    ${QUICK.map(([kind, label]) => html`<button class="quick" onClick=${() => { haptic(); openLog({ kind }); }}>
      <span class="quick-icon">${KINDS[kind].icon}</span><span>${label}</span>
    </button>`)}
  </div>`;
}

function QuestRow({ q, skill, onClick }) {
  const unit = q.metric === 'earned' || q.metric === 'paid' ? fmtMoney : fmtNum;
  return html`<button class=${'quest' + (q.done ? ' done' : '')} onClick=${onClick}>
    <span class="quest-check">${q.done ? '✓' : skill?.icon ?? '•'}</span>
    <span class="quest-main">
      <span class="quest-title">${q.title}</span>
      <${Bar} pct=${q.pct} color=${skill?.color} thin />
    </span>
    <span class="quest-prog small">${unit(q.value)}/${unit(q.target)}</span>
    <span class="quest-xp">+${BONUS.quest}</span>
  </button>`;
}

// ---------------- Skills ----------------

export function SkillsPage() {
  return html`<div class="page">
    <h1 class="page-title">Skills</h1>
    <${Card} title="Character build"><${BuildRadar} /><//>
    <${SkillGrid} />
    <p class="muted small">Want to track something else? Add your own skill in <a href="#/settings">Settings</a>.</p>
  </div>`;
}

export function SkillPage({ id }) {
  const { skillMap, game, data, openLog } = useApp();
  const skill = skillMap[id];
  if (!skill) return html`<div class="page"><${Empty}>That skill doesn't exist anymore. <a href="#/skills">Back to skills</a><//></div>`;
  const lv = game.skillLevels[id];
  const logs = data.logs.filter(l => l.skill === id);
  const Body = { finance: Finance, study: Study, art: Art, gym: Gym, food: Food }[id] ?? Custom;
  return html`<div class="page">
    <div class="skill-hero" style=${{ '--c': skill.color }}>
      <a class="back" href="#/skills">‹ Skills</a>
      <div class="skill-hero-row">
        <span class="skill-hero-icon">${skill.icon}</span>
        <div class="grow">
          <h1>${skill.name} <span class="skill-lv">Lv ${lv.level}</span>${ATTR_OF_SKILL[id] && html`<span class="attr-tag">${ATTR_OF_SKILL[id].toUpperCase()}</span>`}</h1>
          <div class="muted small">${skill.blurb ?? 'Custom skill'}</div>
          <${Bar} pct=${lv.pct} color=${skill.color} />
          <div class="xp-text">${fmtNum(lv.into)} / ${fmtNum(lv.need)} XP · ${fmtNum(game.skillXP[id])} total</div>
        </div>
      </div>
      <button class="btn primary" onClick=${() => openLog({ skill: id })}>+ Log ${skill.name}</button>
    </div>
    <${Body} logs=${logs} skill=${skill} />
    <${Card} title="History"><${LogList} logs=${logs} limit=${30} /><//>
  </div>`;
}

const lastNDays = (logs, today, n) => logs.filter(l => daysBetween(l.date, today) < n && l.date <= today);

// Finance: debts are bosses you attack with payments.
function Finance({ logs }) {
  const { game, openLog } = useApp();
  const [editing, setEditing] = useState(null);
  const shifts = logs.filter(l => l.kind === 'shift');
  const month = game.today.slice(0, 7);
  const withHours = shifts.filter(l => l.hours > 0);
  const perHour = sum(withHours, l => l.hours) ? sum(withHours, l => l.amount) / sum(withHours, l => l.hours) : 0;
  const byPlatform = groupBy(shifts, l => l.platform || 'Other');
  const totalDebt = sum(game.bosses, b => b.balance);
  const totalPaid = sum(game.bosses, b => Math.min(b.paid, b.balance));

  return html`
    <${Card} title="Debt bosses" right=${html`<button class="btn small" onClick=${() => setEditing({})}>+ Add boss</button>`}>
      ${game.bosses.length ? html`
        <div class="boss-total small muted">${fmtMoney(totalPaid)} of ${fmtMoney(totalDebt)} defeated · +${BONUS.boss} XP per boss</div>
        <div class="boss-list">${game.bosses.map(b => html`<div class=${'boss' + (b.defeatedOn ? ' defeated' : '')}>
          <div class="boss-head">
            <span class="boss-name">${b.defeatedOn ? '🏆' : '👹'} ${b.name}</span>
            <button class="icon-btn" onClick=${() => setEditing(b)} aria-label=${'Edit ' + b.name}>✎</button>
          </div>
          <${Bar} pct=${1 - b.pct} color="var(--danger)" />
          <div class="boss-foot">
            <span class="small">${b.defeatedOn ? `Defeated ${fmtDate(b.defeatedOn)}` : html`HP <b>${fmtMoney(b.remaining)}</b> / ${fmtMoney(b.balance)}`}</span>
            ${!b.defeatedOn && html`<button class="btn small attack" onClick=${() => openLog({ kind: 'payment', debtId: b.id })}>⚔️ Attack</button>`}
          </div>
        </div>`)}</div>`
        : html`<${Empty}>Add each debt you're paying off. Its balance is the boss's HP, and every payment is an attack.<//>`}
    <//>

    <${Card} title="Gig earnings" right=${html`<button class="btn small" onClick=${() => openLog({ kind: 'shift' })}>+ Log shift</button>`}>
      <div class="stats">
        <${Stat} label="Last 7 days" value=${fmtMoney(sum(lastNDays(shifts, game.today, 7), l => l.amount))} />
        <${Stat} label="This month" value=${fmtMoney(sum(shifts.filter(l => l.date.startsWith(month)), l => l.amount))} />
        <${Stat} label="All time" value=${fmtMoney(sum(shifts, l => l.amount))} />
        <${Stat} label="Per hour" value=${perHour ? fmtMoney(perHour.toFixed(2)) : '—'} sub=${withHours.length ? '' : 'log hours to see'} />
      </div>
      ${Object.keys(byPlatform).length > 0 && html`<div class="mini-table">
        ${Object.entries(byPlatform).map(([p, list]) => html`<div class="mini-row"><span>${p}</span><span class="muted">${list.length} shifts</span><b>${fmtMoney(sum(list, l => l.amount))}</b></div>`)}
      </div>`}
    <//>
    ${editing && html`<${DebtForm} debt=${editing} onClose=${() => setEditing(null)} />`}
  `;
}

function DebtForm({ debt, onClose }) {
  const { toast } = useApp();
  const [f, setF] = useState({ name: debt.name ?? '', balance: debt.balance ?? '', apr: debt.apr ?? '', minPayment: debt.minPayment ?? '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [error, setError] = useState('');
  function save(e) {
    e.preventDefault();
    if (!f.name.trim() || !(f.balance > 0)) return setError('Give it a name and a starting balance.');
    put({ ...(debt.id ? { id: debt.id, createdAt: debt.createdAt } : { createdAt: Date.now() }), type: 'debt', name: f.name.trim(), balance: f.balance, apr: f.apr, minPayment: f.minPayment });
    toast(debt.id ? 'Boss updated' : '👹 A new boss appears!');
    if (!debt.id) play('alarm');
    onClose();
  }
  function del() {
    if (!confirm(`Delete ${debt.name}? Payments you logged stay in your history.`)) return;
    remove(debt.id);
    onClose();
  }
  const props = { f, set };
  return html`<${Sheet} title=${debt.id ? 'Edit debt boss' : 'New debt boss'} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <${Text} label="Name" k="name" placeholder="e.g. Chase credit card" ...${props} />
      <${Num} label="Balance when you started tracking" k="balance" prefix="$" ...${props} />
      <div class="row">
        <${Num} label="APR (optional)" k="apr" suffix="%" ...${props} />
        <${Num} label="Min. payment (optional)" k="minPayment" prefix="$" ...${props} />
      </div>
      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${debt.id && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Delete</button>`}
        <button class="btn primary grow" type="submit">Save</button>
      </div>
    </form>
  <//>`;
}

function Study({ logs }) {
  const { game, data } = useApp();
  const sessions = logs.filter(l => l.kind === 'study');
  const quizzes = logs.filter(l => l.kind === 'quiz').slice(0, 10).reverse();
  const exam = data.settings.examDate;
  const daysLeft = exam ? daysBetween(game.today, exam) : null;
  const recent = quizzes.slice(-5);
  return html`
    <${Card} title="Exam countdown">
      ${exam ? html`<div class="countdown"><span class="big">${daysLeft >= 0 ? daysLeft : 0}</span><span class="muted">${daysLeft > 0 ? 'days until your NASM exam' : daysLeft === 0 ? 'Exam day. You got this! 💪' : 'Exam date passed. Update it in Settings.'}</span></div>
        <div class="muted small">${parseDate(exam).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>`
        : html`<${Empty}>Set your exam date in <a href="#/settings">Settings</a> to see a countdown.<//>`}
    <//>
    <${Card} title="Study stats">
      <div class="stats">
        <${Stat} label="Last 7 days" value=${fmtMinutes(sum(lastNDays(sessions, game.today, 7), l => l.minutes))} />
        <${Stat} label="All time" value=${fmtMinutes(sum(sessions, l => l.minutes))} />
        <${Stat} label="Quiz average" value=${recent.length ? Math.round(sum(recent, l => l.score) / recent.length) + '%' : '—'} sub="last 5" />
        <${Stat} label="Best quiz" value=${game.totals.bestQuiz ? game.totals.bestQuiz + '%' : '—'} />
      </div>
      ${quizzes.length > 1 && html`<div class="quiz-chart" aria-label="Recent quiz scores">
        ${quizzes.map(q => html`<div class="quiz-col" title=${`${fmtDate(q.date)}: ${q.score}%`}>
          <div class="quiz-bar" style=${{ height: `${Math.max(4, q.score)}%`, background: q.score >= 70 ? 'var(--good)' : 'var(--gold)' }}></div>
          <span class="tiny muted">${q.score}</span>
        </div>`)}
      </div><div class="tiny muted">Green = 70%+, the NASM passing score.</div>`}
    <//>`;
}

const PROMPTS = [
  'Draw 10 heads in 3/4 view using the Loomis method',
  'Fill a page with eyes: 6 different expressions',
  'Heads from below (worm’s-eye view): 5 sketches',
  'Heads from above (bird’s-eye view): 5 sketches',
  '20 gesture drawings, 30 seconds each',
  'Draw a full body at 7 heads tall and check the proportions',
  'Chibi day: one character at 2–3 heads tall',
  'Hands: 10 quick sketches of your own hand',
  'One face front, 3/4 and profile (a turnaround)',
  'Hair study: 5 hairstyles on the same head',
  'Noses and mouths: 12 small studies',
  'Copy a manga panel, focusing on line weight',
  'A character looking over their shoulder',
  'Foreshortening: an arm reaching toward the viewer',
  '8 expressions: happy, sad, angry, shocked, smug, shy, tired, determined',
  'Torso twists: 5 poses built from boxes and cylinders',
  'Feet and shoes from 6 angles',
  'Line confidence: 2 pages of smooth ellipses and straight lines',
  'A seated character, checked with a head count',
  'Redraw an old drawing and compare the two',
];

function Art({ logs, skill }) {
  const { game } = useApp();
  const sessions = logs.filter(l => l.kind === 'draw');
  const counts = Object.fromEntries(ART_FOCUS.map(f => [f, sessions.filter(l => (l.focus || []).includes(f)).length]));
  const max = Math.max(1, ...Object.values(counts));
  const weakest = ART_FOCUS.reduce((a, b) => (counts[b] < counts[a] ? b : a));
  const prompt = PROMPTS[Math.floor(parseDate(game.today) / 86400000) % PROMPTS.length];
  return html`
    <${Card} title="Today's drawing prompt" class="prompt-card">
      <p class="prompt">✏️ ${prompt}</p>
      ${sessions.length > 0 && html`<p class="muted small">Least practiced so far: <b>${weakest}</b>. Give it some love.</p>`}
    <//>
    <${Card} title="Practice">
      <div class="stats">
        <${Stat} label="Last 7 days" value=${fmtMinutes(sum(lastNDays(sessions, game.today, 7), l => l.minutes))} />
        <${Stat} label="All time" value=${fmtMinutes(sum(sessions, l => l.minutes))} />
        <${Stat} label="Sessions" value=${sessions.length} />
      </div>
      <div class="focus-list">
        ${ART_FOCUS.map(f => html`<div class="focus-row"><span>${f}</span><${Bar} pct=${counts[f] / max} color=${skill.color} thin /><span class="small muted">${counts[f]}</span></div>`)}
      </div>
    <//>`;
}

function Gym({ logs }) {
  const { game } = useApp();
  const workouts = logs.filter(l => l.kind === 'workout');
  const prs = Object.values(groupBy(logs.filter(l => l.kind === 'pr'), l => l.exercise.trim().toLowerCase()))
    .map(list => list.reduce((best, l) => (l.weight > best.weight ? l : best)))
    .sort((a, b) => b.weight - a.weight);
  return html`
    <${Card} title="Training">
      <div class="stats">
        <${Stat} label="Last 7 days" value=${lastNDays(workouts, game.today, 7).length + ' workouts'} />
        <${Stat} label="All time" value=${workouts.length + ' workouts'} />
        <${Stat} label="Time trained" value=${fmtMinutes(sum(workouts, l => l.minutes))} />
      </div>
    <//>
    <${Card} title="PR board">
      ${prs.length ? html`<div class="mini-table">${prs.map(p => html`<div class="mini-row"><span>🏆 ${p.exercise}</span><span class="muted">${fmtDate(p.date)}</span><b>${p.weight} lb${p.reps ? ` × ${p.reps}` : ''}</b></div>`)}</div>`
        : html`<${Empty}>Hit a new best? Log a personal record for +75 XP.<//>`}
    <//>`;
}

function Food({ logs }) {
  const { game, data, openLog } = useApp();
  const { calorieTarget, proteinTarget } = data.settings;
  const today = logs.filter(l => l.date === game.today && l.kind === 'meal');
  const n = game.nutritionToday;
  const cal = n.calories;
  const protein = n.protein;
  const week = lastNDays(logs.filter(l => l.kind === 'meal'), game.today, 7);
  const weekDays = Object.keys(groupBy(week, l => l.date)).length || 1;
  return html`
    <${Card} title="Today" right=${html`<div class="form-actions"><button class="btn small" onClick=${() => openLog({ kind: 'macros' })}>📊 MacroFactor</button><button class="btn small" onClick=${() => openLog({ kind: 'meal' })}>+ Meal</button></div>`}>
      ${n.fromMacroFactor && html`<div class="tiny muted">📊 Using today's MacroFactor check-in</div>`}
      ${n.perfect ? html`<div class="banner">🎯 Perfect nutrition day! +${PERFECT_NUTRITION_XP} STR, stress relief, and it cures Cyberpsychosis</div>`
        : html`<div class="tiny muted">Land within ±5% of your calorie target with your protein hit for a perfect day (+${PERFECT_NUTRITION_XP} STR).</div>`}
      <div class="macro">
        <div class="macro-head"><span>Calories</span><b>${fmtNum(cal)} <span class="muted">/ ${fmtNum(calorieTarget)} kcal</span></b></div>
        <${Bar} pct=${calorieTarget ? cal / calorieTarget : 0} color=${cal > calorieTarget ? 'var(--danger)' : 'var(--gold)'} />
      </div>
      <div class="macro">
        <div class="macro-head"><span>Protein</span><b>${fmtNum(protein)} <span class="muted">/ ${fmtNum(proteinTarget)} g</span></b></div>
        <${Bar} pct=${proteinTarget ? protein / proteinTarget : 0} color="var(--good)" />
        <div class="tiny muted">${protein >= proteinTarget ? `Protein goal hit! +${BONUS.protein} XP` : `Hit your protein goal for +${BONUS.protein} bonus XP`}</div>
      </div>
      ${today.length ? html`<div class="mini-table">${today.map(m => html`<div class="mini-row"><span>${m.name}</span><span class="muted">${m.protein ? m.protein + 'g' : ''}</span><b>${m.calories ? m.calories + ' kcal' : ''}</b></div>`)}</div>`
        : html`<${Empty}>No meals logged today.<//>`}
    <//>
    <${Card} title="7-day averages">
      <div class="stats">
        <${Stat} label="Calories / day" value=${fmtNum(sum(week, l => l.calories) / weekDays)} />
        <${Stat} label="Protein / day" value=${fmtNum(sum(week, l => l.protein) / weekDays) + 'g'} />
        <${Stat} label="Meals logged" value=${week.length} />
      </div>
    <//>`;
}

function Custom({ logs }) {
  const { game } = useApp();
  return html`<${Card} title="Progress">
    <div class="stats">
      <${Stat} label="Last 7 days" value=${fmtMinutes(sum(lastNDays(logs, game.today, 7), l => l.minutes))} />
      <${Stat} label="All time" value=${fmtMinutes(sum(logs, l => l.minutes))} />
      <${Stat} label="Sessions" value=${logs.length} />
    </div>
  <//>`;
}

// ---------------- Stats ----------------

export function Stats() {
  const { game } = useApp();
  const unlocked = ACHIEVEMENTS.filter(a => a.test(game));
  const maxAttr = Math.max(1, ...game.attributes.map(a => a.xp));
  return html`<div class="page">
    <h1 class="page-title">Stats</h1>
    <div class="stats">
      <${Stat} label="Level" value=${game.overall.level} sub=${game.title} />
      <${Stat} label="Total XP" value=${fmtNum(game.total)} />
      <${Stat} label="HP" value=${`${game.hp}/${game.maxHp}`} />
      <${Stat} label="Stress" value=${game.stress + '%'} sub=${game.cyberpsychosis ? '🧠 Cyberpsychosis!' : 'Cyberpsychosis at 100%'} />
      <${Stat} label="Gold" value=${'🪙 ' + fmtNum(game.gold)} sub=${`${fmtNum(game.goldEarned)} earned all time`} />
      <${Stat} label="Current streak" value=${game.streak + ' days'} />
      <${Stat} label="Best streak" value=${game.bestStreak + ' days'} />
    </div>
    <${Card} title="Character build"><${BuildRadar} /><//>
    <${Card} title="XP, last 14 days"><${XPChart} /><//>
    <${Card} title="Attributes">
      <div class="focus-list">
        ${game.attributes.map(a => html`<div class="focus-row"><span>${a.icon} ${a.name} <span class="tiny muted">Lv ${a.level}</span></span><${Bar} pct=${a.xp / maxAttr} color=${a.color} thin /><span class="small muted">${fmtNum(a.xp)}</span></div>`)}
      </div>
    <//>
    <${Card} title="🧠 Stress log">
      <p class="muted small">In bed after 9:00 PM: +25. A 7th straight day without a rest day (no workout or gig shift): +20. Good sleep: −15. Rest day: −20. Perfect nutrition: −10. At 100% you get Cyberpsychosis.</p>
      ${game.stressLog.length ? html`<div class="mini-table">${game.stressLog.map(e => html`<div class="mini-row">
        <span>${e.result ? html`<b>${e.result}</b> · ` : ''}${e.reason}</span>
        <span class="muted tiny">${new Date(e.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        <b class=${e.delta > 0 ? 'danger-text' : 'good-text'}>${e.delta == null ? '' : e.delta > 0 ? `+${e.delta}` : e.delta}</b>
      </div>`)}</div>` : html`<${Empty}>No stress yet. Log your sleep to start tracking it.<//>`}
    <//>
    <${Card} title="Achievements" right=${html`<span class="muted small">${unlocked.length}/${ACHIEVEMENTS.length}</span>`}>
      <div class="achievements">
        ${ACHIEVEMENTS.map(a => html`<div class=${'achievement' + (unlocked.includes(a) ? ' got' : '')}>
          <span class="ach-icon">${unlocked.includes(a) ? a.icon : '🔒'}</span>
          <span class="ach-name">${a.name}</span>
          <span class="tiny muted">${a.desc}</span>
        </div>`)}
      </div>
    <//>
  </div>`;
}

function XPChart() {
  const { game } = useApp();
  const days = Array.from({ length: 14 }, (_, i) => addDays(game.today, i - 13));
  const vals = days.map(d => game.xpByDate[d] || 0);
  const max = Math.max(100, ...vals);
  const W = 14 * 28;
  const H = 120;
  return html`<svg class="chart" viewBox=${`0 0 ${W} ${H + 34}`} role="img" aria-label="XP earned per day for the last 14 days">
    ${days.map((d, i) => {
      const h = (vals[i] / max) * H;
      return html`<g>
        <rect x=${i * 28 + 4} y=${H - h + 14} width="20" height=${Math.max(h, 2)} rx="4" class=${d === game.today ? 'bar-today' : 'bar-day'}>
          <title>${fmtDate(d)}: ${vals[i]} XP</title>
        </rect>
        ${vals[i] > 0 && html`<text x=${i * 28 + 14} y=${H - h + 9} text-anchor="middle" class="bar-val">${vals[i] >= 1000 ? (vals[i] / 1000).toFixed(1) + 'k' : vals[i]}</text>`}
        <text x=${i * 28 + 14} y=${H + 30} text-anchor="middle" class="axis">${DAY_LETTERS[dayOfWeek(d)]}</text>
      </g>`;
    })}
  </svg>`;
}
