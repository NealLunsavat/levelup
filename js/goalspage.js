// The Goals page: operations (final goals) and their ranked hit lists of targets (sub-goals),
// plus the prime-target card shown on Home.
import { html, useLayoutEffect, useRef, useState } from '../vendor/preact-htm.js';
import { TARGET_KINDS } from './goals.js';
import { OPERATION_XP, PRIME_BONUS_XP, TARGET_XP, monthlyInterest } from './rpgMath.js';
import { put, remove } from './store.js';
import { feedback } from './fx.js';
import { Bar, Card, GoalTabs, Sheet, useApp } from './components.js';
import { Num, Text } from './logsheet.js';
import { daysBetween, fmtMoney, fmtNum } from './util.js';

const fmtVal = (t, v) => (t.money ? fmtMoney(v) : `${fmtNum(v)}${t.unit ? ' ' + t.unit : ''}`);
const two = n => String(n).padStart(2, '0');
const bounty = prime => TARGET_XP + (prime ? PRIME_BONUS_XP : 0);

function progressText(t) {
  if (t.orphan) return 'Its debt boss was deleted';
  if (t.kind === 'check') return 'Milestone';
  if (t.kind === 'debt') return `${fmtMoney(t.total - t.current)} left of ${fmtMoney(t.total)}`;
  return `${fmtVal(t, t.current)} / ${fmtVal(t, t.total)}`;
}

// The one-tap action for a target: attack a debt, add progress, or tick off a milestone.
function targetAction(t, { openLog }, openProgress) {
  if (t.orphan) return null;
  if (t.kind === 'debt') return { label: '⚔️ Attack', run: () => openLog({ kind: 'payment', debtId: t.rec.debtId }) };
  if (t.kind === 'amount') return { label: '+ Progress', run: () => openProgress(t) };
  return { label: '✓ Done', run: () => put({ ...t.rec, doneAt: Date.now() }) };
}

const owed = t => t.total - t.current;
// Most interest first; with no APR to go on, the bigger balance goes first.
const byInterest = (a, b) => b.interest - a.interest || owed(b) - owed(a);

// Save a new order for the targets still standing. Cleared targets keep their place in the ranking
// (so the prime bonus they earned doesn't change); anything new goes in after them.
function applyOrder(op, active) {
  let i = 0;
  const full = [...op.targets.map(t => (t.done ? t : active[i++])), ...active.slice(i)];
  full.forEach((t, idx) => {
    if (t.rec.rank !== idx + 1) put({ ...t.rec, rank: idx + 1 });
  });
}

// Rank the hit list by what each debt costs in interest right now. `added` are targets just created.
export function rankByInterest(op, added = []) {
  applyOrder(op, [...op.active, ...added].sort(byInterest));
  if (op.rec.rankBy !== 'interest') put({ ...op.rec, rankBy: 'interest' });
}

// A just-created debt target, shaped like an evaluated one so it can be ranked.
const freshTarget = (rec, boss) => ({ rec, interest: monthlyInterest(boss.remaining ?? boss.balance, boss.apr), total: Number(boss.balance) || 0, current: 0 });

// Debt bosses that aren't on any hit list yet.
function useFreeBosses() {
  const { game, data } = useApp();
  const linked = new Set(data.targets.filter(t => t.kind === 'debt').map(t => t.debtId));
  return game.bosses.filter(b => !linked.has(b.id) && !b.defeatedOn);
}

// Slide rows to their new spot when the ranking changes (a FLIP animation).
function useFlip() {
  const ref = useRef(null);
  const tops = useRef(new Map());
  useLayoutEffect(() => {
    const next = new Map();
    for (const el of ref.current?.children ?? []) {
      const key = el.dataset.key;
      if (!key) continue;
      next.set(key, el.offsetTop);
      const before = tops.current.get(key);
      if (before != null && before !== el.offsetTop && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.animate([{ transform: `translateY(${before - el.offsetTop}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      }
    }
    tops.current = next;
  });
  return ref;
}

const Reticle = ({ n }) => html`<span class="reticle">
  <svg viewBox="0 0 52 52" aria-hidden="true">
    <circle class="reticle-ring" cx="26" cy="26" r="21" />
    <path class="reticle-ticks" d="M26 1v9M26 42v9M1 26h9M42 26h9" />
  </svg>
  <b>${two(n)}</b>
</span>`;

// ---------------- Page ----------------

const TEMPLATES = [
  { icon: '💳', label: 'Wipe out debt', goal: { title: 'Clear my credit card debt', skill: 'finance' } },
  { icon: '🎓', label: 'Get certified', goal: { title: 'Pass the NASM CPT exam', skill: 'study' } },
  { icon: '✏️', label: 'Something else', goal: {} },
];

export function GoalsPage() {
  const { game } = useApp();
  const [sheet, setSheet] = useState(null);
  const close = () => setSheet(null);
  const ops = game.goals;
  return html`<div class="page">
    <h1 class="page-title">Goals</h1>
    <${GoalTabs} current="goals" />
    <p class="muted small">Each <b>operation</b> is a final goal. Break it into <b>targets</b>, rank them, and take them down from the top. Every target pays +${TARGET_XP} XP, the <b>prime target</b> pays +${PRIME_BONUS_XP} more, and finishing the operation pays +${fmtNum(OPERATION_XP)}.</p>

    ${ops.map(op => html`<${Operation} key=${op.id} op=${op} open=${setSheet} />`)}

    ${ops.length === 0 && html`<${Card} title="Launch your first operation">
      <p class="muted small">Pick a final goal. You'll add its targets next.</p>
      <div class="pick-grid">
        ${TEMPLATES.map(t => html`<button class="pick" onClick=${() => setSheet({ type: 'goal', goal: t.goal })}>
          <span class="pick-icon">${t.icon}</span><span>${t.label}</span>
        </button>`)}
      </div>
    <//>`}
    ${ops.length > 0 && html`<button class="btn" onClick=${() => setSheet({ type: 'goal', goal: {} })}>+ New operation</button>`}

    ${sheet?.type === 'goal' && html`<${GoalForm} goal=${sheet.goal} onClose=${close} />`}
    ${sheet?.type === 'target' && html`<${TargetForm} op=${sheet.op} target=${sheet.target} onClose=${close} />`}
    ${sheet?.type === 'progress' && html`<${ProgressSheet} target=${sheet.target} onClose=${close} />`}
  </div>`;
}

function Operation({ op, open }) {
  const ctx = useApp();
  const { game } = ctx;
  const flip = useFlip();
  const freeBosses = useFreeBosses();
  const skill = ctx.skillMap[op.skill];

  const left = op.deadline ? daysBetween(game.today, op.deadline) : null;
  const remaining = op.total - op.current;
  let pace = null;
  if (op.money && left > 0 && remaining > 0) {
    pace = left >= 14 ? `${fmtMoney(Math.ceil(remaining / (left / 7)))} / week` : `${fmtMoney(Math.ceil(remaining / left))} / day`;
  }

  const byInterestMode = op.rec.rankBy !== 'manual';
  // Moving a target by hand, or picking another sort, takes the list off automatic interest ranking.
  const manual = active => {
    applyOrder(op, active);
    if (op.rec.rankBy !== 'manual') put({ ...op.rec, rankBy: 'manual' });
  };
  const move = (t, dir) => {
    const list = [...op.active];
    const i = list.indexOf(t);
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    manual(list);
    feedback('tap');
  };
  const autoRank = compare => {
    manual([...op.active].sort(compare));
    feedback('tick');
  };
  const addBosses = () => {
    let rank = Math.max(0, ...op.targets.map(t => t.rec.rank ?? 0));
    const added = freeBosses.map(b => freshTarget(put({ type: 'target', goalId: op.id, kind: 'debt', debtId: b.id, title: b.name, rank: ++rank, createdAt: Date.now() }), b));
    if (byInterestMode) rankByInterest(op, added);
    feedback('quest', 'double');
  };
  const undo = t => (t.kind === 'check' ? put({ ...t.rec, doneAt: null }) : open({ type: 'progress', target: t }));

  return html`<section class=${'op' + (op.complete ? ' complete' : '')}>
    <div class="op-head">
      <div class="grow">
        <div class="op-kicker">${op.complete ? '✓ OPERATION COMPLETE' : 'OPERATION'} · ${skill?.icon ?? '🎯'} ${skill?.name ?? 'Goal'}</div>
        <h2 class="op-title">${op.title}</h2>
      </div>
      <button class="icon-btn" aria-label=${'Edit ' + op.title} onClick=${() => open({ type: 'goal', goal: op })}>✎</button>
    </div>

    <div class="op-progress">
      <div class="op-pct">${Math.floor(op.pct * 100)}<span>%</span></div>
      <div class="grow op-bars">
        <div class="stackbar" role="img" aria-label=${`${Math.floor(op.pct * 100)}% of ${op.title} complete`}>
          ${op.targets.length === 0 && html`<div class="part"></div>`}
          ${op.targets.map(t => html`<div class=${'part' + (t.done ? ' done' : t === op.prime ? ' prime' : '')}
            style=${{ flexGrow: op.money ? Math.max(t.total, op.total * 0.05) : 1 }} title=${`${t.title}: ${Math.round(t.pct * 100)}%`}>
            <div class="part-fill" style=${{ width: `${t.pct * 100}%` }}></div>
          </div>`)}
        </div>
        <div class="op-nums">${op.money ? html`<b>${fmtMoney(op.current)}</b> of ${fmtMoney(op.total)} cleared` : html`<b>${op.cleared.length}</b> of ${op.targets.length} targets down`}</div>
      </div>
    </div>

    <div class="chips">
      ${op.money && html`<span class="chip">🎯 ${op.cleared.length}/${op.targets.length} targets down</span>`}
      ${left != null && !op.complete && html`<span class=${'chip' + (left < 0 ? ' debuff' : left <= 7 ? ' fire' : '')}>⏱ ${left < 0 ? `${-left} days overdue` : left === 0 ? 'Due today' : `T-${left} days`}</span>`}
      ${op.interest > 0 && html`<span class="chip fire">🔥 ≈ ${fmtMoney(Math.round(op.interest * 100) / 100)}/mo in interest</span>`}
      ${pace && html`<span class="chip">📈 On-time pace: ${pace}</span>`}
      ${op.reward && html`<span class="chip buff">🎁 ${op.reward}</span>`}
    </div>

    ${op.targets.length === 0 && html`<div class="op-empty">
      <p class="muted small">No targets yet. Break this goal into the pieces you'll take down one at a time.</p>
      ${op.skill === 'finance' && freeBosses.length > 0 && html`<button class="btn primary" onClick=${addBosses}>💳 Add my ${freeBosses.length} debt boss${freeBosses.length === 1 ? '' : 'es'} as targets</button>`}
    </div>`}

    ${op.active.length > 0 && html`<div class="hitlist" ref=${flip}>
      ${op.active.map((t, i) => html`<${TargetRow} key=${t.id} t=${t} index=${i} last=${i === op.active.length - 1} move=${move} open=${open} op=${op} />`)}
    </div>`}

    ${op.active.length > 1 && op.active.every(t => t.money) && html`<div class="chip-row autorank">
      <span class="tiny muted">RANK BY</span>
      <button class=${'chip-btn mini' + (byInterestMode ? ' on' : '')} onClick=${() => { rankByInterest(op); feedback('tick'); }}>🔥 Most interest</button>
      <button class="chip-btn mini" onClick=${() => autoRank((a, b) => b.apr - a.apr || owed(b) - owed(a))}>Highest APR</button>
      <button class="chip-btn mini" onClick=${() => autoRank((a, b) => owed(a) - owed(b))}>Smallest balance</button>
    </div>
    ${byInterestMode && html`<p class="tiny muted">Ranked by interest cost (balance × APR). New debts slot in automatically; tap 🔥 to re-rank with today's balances.</p>`}`}

    <button class="btn" onClick=${() => open({ type: 'target', op })}>+ Add target</button>

    ${op.cleared.length > 0 && html`<div class="cleared">
      <div class="cleared-head">ELIMINATED</div>
      ${op.cleared.map(t => html`<div class="cleared-row" key=${t.id}>
        <span class="stamp">✓</span>
        <span class="cleared-title">${t.title}</span>
        <span class="tiny muted">${new Date(t.doneAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        <span class="xp" title=${t.inOrder ? 'Includes the prime bonus' : ''}>+${bounty(t.inOrder)}</span>
        ${t.kind !== 'debt' && html`<button class="link tiny" onClick=${() => undo(t)}>Undo</button>`}
      </div>`)}
    </div>`}
  </section>`;
}

function TargetRow({ op, t, index, last, move, open }) {
  const ctx = useApp();
  const prime = index === 0;
  const tier = prime ? 'PRIME TARGET' : index === 1 ? 'ON DECK' : 'QUEUED';
  const action = targetAction(t, ctx, target => open({ type: 'progress', target }));
  return html`<div class=${'target' + (prime ? ' prime' : '')} data-key=${t.id} style=${{ '--depth': Math.min(index, 3) }}>
    ${prime ? html`<${Reticle} n=${1} />` : html`<span class="rank"><b>${two(index + 1)}</b></span>`}
    <div class="target-body">
      <div class="target-head">
        <span class="target-tier">${tier}</span>
        <span class="target-bounty">+${bounty(prime)} XP</span>
      </div>
      <div class="target-title">${TARGET_KINDS[t.kind].icon} ${t.title}</div>
      ${t.kind !== 'check' && !t.orphan && html`<${Bar} pct=${t.pct} color=${prime ? 'var(--accent)' : 'var(--cyan)'} thin=${!prime} />`}
      <div class="target-nums">${progressText(t)}${t.apr ? ` · ${t.apr}% APR` : ''}</div>
      ${t.interest > 0 && html`<div class="target-nums interest">🔥 ≈ ${fmtMoney(Math.round(t.interest * 100) / 100)}/mo in interest</div>`}
      <div class="target-actions">
        <button class="icon-btn" disabled=${prime} aria-label=${`Move ${t.title} up`} onClick=${() => move(t, -1)}>▲</button>
        <button class="icon-btn" disabled=${last} aria-label=${`Move ${t.title} down`} onClick=${() => move(t, 1)}>▼</button>
        <button class="icon-btn" aria-label=${`Edit ${t.title}`} onClick=${() => open({ type: 'target', op, target: t })}>✎</button>
        <span class="grow"></span>
        ${action && html`<button class=${'btn small' + (prime ? ' primary' : '')} onClick=${action.run}>${action.label}</button>`}
      </div>
    </div>
  </div>`;
}

// ---------------- Forms ----------------

function GoalForm({ goal, onClose }) {
  const { skills, data, toast } = useApp();
  const [f, setF] = useState({ title: goal.title ?? '', skill: goal.skill ?? 'finance', deadline: goal.deadline ?? '', reward: goal.reward ?? '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [error, setError] = useState('');
  function save(e) {
    e.preventDefault();
    if (!f.title.trim()) return setError('Give your final goal a name.');
    put({ ...(goal.rec ?? {}), type: 'goal', title: f.title.trim(), skill: f.skill, deadline: f.deadline, reward: f.reward.trim(), createdAt: goal.createdAt ?? Date.now() });
    if (!goal.id) {
      feedback('quest', 'double');
      toast('🎯 Operation launched. Now add its targets.');
    }
    onClose();
  }
  function del() {
    if (!confirm(`Delete "${goal.title}" and its hit list? XP earned from it will be removed. Your debt bosses and payments stay.`)) return;
    for (const t of data.targets.filter(t => t.goalId === goal.id)) remove(t.id);
    remove(goal.id);
    onClose();
  }
  return html`<${Sheet} title=${goal.id ? 'Edit operation' : 'New operation'} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <${Text} label="Final goal" k="title" placeholder="e.g. Clear $8,000 of credit card debt" f=${f} set=${set} />
      <label class="field"><span>Trains</span>
        <select value=${f.skill} onChange=${e => set('skill', e.target.value)}>
          ${skills.filter(s => !s.hidden).map(s => html`<option value=${s.id}>${s.icon} ${s.name}</option>`)}
        </select>
      </label>
      <label class="field"><span>Deadline (optional)</span><input type="date" value=${f.deadline} onInput=${e => set('deadline', e.target.value)} /></label>
      <${Text} label="Reward when you finish (optional)" k="reward" placeholder="e.g. Weekend trip" f=${f} set=${set} />
      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${goal.id && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Delete</button>`}
        <button class="btn primary grow" type="submit">${goal.id ? 'Save' : 'Launch operation'}</button>
      </div>
    </form>
  <//>`;
}

const UNITS = ['$', 'lbs', 'hrs', 'reps'];

function TargetForm({ op, target, onClose }) {
  const { game } = useApp();
  const freeBosses = useFreeBosses();
  const rec = target?.rec;
  const [kind, setKind] = useState(rec?.kind ?? (op.skill === 'finance' ? 'debt' : 'check'));
  const [f, setF] = useState({
    title: rec?.title ?? '', debtId: freeBosses[0]?.id ?? 'new', name: '', balance: '', apr: '',
    target: rec?.target ?? '', current: rec?.current ?? '', unit: rec?.unit ?? '$',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [error, setError] = useState('');

  function save(e) {
    e.preventDefault();
    const rank = rec?.rank ?? Math.max(0, ...op.targets.map(t => t.rec.rank ?? 0)) + 1;
    const base = { ...(rec ? { id: rec.id } : {}), type: 'target', goalId: op.id, kind, rank, createdAt: rec?.createdAt ?? Date.now() };
    if (kind === 'debt') {
      let boss = game.bosses.find(b => b.id === f.debtId);
      if (!boss) {
        if (!f.name.trim() || !(f.balance > 0)) return setError('Add the name and the balance you owe.');
        boss = put({ type: 'debt', name: f.name.trim(), balance: f.balance, apr: f.apr, createdAt: Date.now() });
      }
      const added = put({ ...base, debtId: boss.id, title: boss.name });
      if (!rec && op.rec.rankBy !== 'manual') rankByInterest(op, [freshTarget(added, boss)]);
    } else if (kind === 'amount') {
      if (!f.title.trim() || !(f.target > 0)) return setError('Add a name and the number to reach.');
      const current = Math.max(0, Number(f.current) || 0);
      put({ ...base, title: f.title.trim(), target: f.target, unit: f.unit.trim(), current, doneAt: current >= f.target ? rec?.doneAt ?? Date.now() : null });
    } else {
      if (!f.title.trim()) return setError('Name the milestone.');
      put({ ...base, title: f.title.trim(), doneAt: rec?.doneAt ?? null });
    }
    if (!rec) feedback('tick');
    onClose();
  }
  function del() {
    if (!confirm(`Remove "${target.title}" from this hit list?${kind === 'debt' ? ' The debt boss and its payments stay.' : ''}`)) return;
    remove(rec.id);
    onClose();
  }

  const props = { f, set };
  const linkedDebt = rec && kind === 'debt';
  return html`<${Sheet} title=${rec ? 'Edit target' : 'New target'} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      ${!rec && html`<div class="field"><span>What kind of target?</span>
        <div class="chip-row">
          ${Object.entries(TARGET_KINDS).map(([id, k]) => html`<button type="button" class=${'chip-btn' + (kind === id ? ' on' : '')} onClick=${() => { setKind(id); setError(''); }}>${k.icon} ${k.label}</button>`)}
        </div>
      </div>`}

      ${linkedDebt && html`<p class="muted small">This target follows the <b>${target.title}</b> debt boss. Change its balance or APR on the <a class="link" href="#/skill/finance" onClick=${onClose}>Finance page</a>.</p>`}

      ${kind === 'debt' && !rec && html`
        <p class="muted small">Its balance is the target's HP. Every payment you log is an attack, and the target falls when it hits $0.</p>
        ${freeBosses.length > 0 && html`<label class="field"><span>Which debt?</span>
          <select value=${f.debtId} onChange=${e => set('debtId', e.target.value)}>
            ${freeBosses.map(b => html`<option value=${b.id}>${b.name} (${fmtMoney(b.remaining)} left)</option>`)}
            <option value="new">➕ A new card or loan…</option>
          </select>
        </label>`}
        ${f.debtId === 'new' && html`
          <${Text} label="Card or loan name" k="name" placeholder="e.g. Chase Freedom" ...${props} />
          <div class="row">
            <${Num} label="Balance owed" k="balance" prefix="$" ...${props} />
            <${Num} label="APR (optional)" k="apr" suffix="%" ...${props} />
          </div>`}`}

      ${kind === 'amount' && html`
        <${Text} label="Target" k="title" placeholder="e.g. Build a $1,000 emergency fund" ...${props} />
        <div class="field"><span>Measured in</span>
          <div class="chip-row">
            ${UNITS.map(u => html`<button type="button" class=${'chip-btn' + (f.unit === u ? ' on' : '')} onClick=${() => set('unit', u)}>${u}</button>`)}
            <input class="mini-input" type="text" placeholder="Other" aria-label="Other unit" value=${UNITS.includes(f.unit) ? '' : f.unit} onInput=${e => set('unit', e.target.value)} />
          </div>
        </div>
        <div class="row">
          <${Num} label="Number to reach" k="target" ...${props} />
          <${Num} label="Where you are now" k="current" ...${props} />
        </div>`}

      ${kind === 'check' && html`<${Text} label="Milestone" k="title" placeholder="e.g. Book the exam date" ...${props} />`}

      ${error && html`<p class="error">${error}</p>`}
      <div class="form-actions">
        ${rec && html`<button type="button" class="btn ghost danger-text" onClick=${del}>Remove</button>`}
        ${linkedDebt
          ? html`<button type="button" class="btn grow" onClick=${onClose}>Close</button>`
          : html`<button class="btn primary grow" type="submit">${rec ? 'Save' : 'Add to hit list'}</button>`}
      </div>
    </form>
  <//>`;
}

function ProgressSheet({ target: t, onClose }) {
  const [f, setF] = useState({ value: t.rec.current ?? 0 });
  const now = Math.max(0, Number(f.value) || 0);
  const steps = t.money ? [25, 50, 100, 250] : [1, 5, 10, 25];
  function save(e) {
    e.preventDefault();
    const done = now >= t.total;
    put({ ...t.rec, current: now, doneAt: done ? t.rec.doneAt ?? Date.now() : null });
    if (!done) feedback('tick');
    onClose();
  }
  return html`<${Sheet} title=${t.title} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <${Bar} pct=${t.total ? now / t.total : 0} color="var(--accent)" />
      <p class="muted small">${fmtVal(t, now)} of ${fmtVal(t, t.total)}${now >= t.total ? '. That clears the target!' : ''}</p>
      <div class="field"><span>Add</span>
        <div class="chip-row">
          ${steps.map(n => html`<button type="button" class="chip-btn" onClick=${() => setF({ value: now + n })}>+${t.money ? '$' : ''}${n}</button>`)}
        </div>
      </div>
      <${Num} label="Total so far" k="value" prefix=${t.money ? '$' : ''} suffix=${t.money ? '' : t.unit} f=${f} set=${(k, v) => setF({ value: v })} />
      <button class="btn primary" type="submit">Save progress</button>
    </form>
  <//>`;
}

// ---------------- Home card ----------------

// The top-ranked target of each operation, front and center on Home.
export function PrimeTargets() {
  const ctx = useApp();
  const { game } = ctx;
  const [progress, setProgress] = useState(null);
  if (!game.goals.length) {
    return html`<a class="goal-teaser" href="#/goals"><span class="quick-icon">🎯</span><span><b>No final goal yet.</b> Set one and break it into a ranked hit list →</span></a>`;
  }
  const ops = game.goals.filter(op => op.prime).slice(0, 2);
  return html`${ops.map(op => {
    const t = op.prime;
    const action = targetAction(t, ctx, setProgress);
    return html`<div class="prime-card" key=${op.id}>
      <${Reticle} n=${1} />
      <div class="grow target-body">
        <a class="target-tier" href="#/goals">PRIME TARGET · ${op.title} · ${Math.floor(op.pct * 100)}% →</a>
        <div class="target-title">${TARGET_KINDS[t.kind].icon} ${t.title}</div>
        ${t.kind !== 'check' && !t.orphan && html`<${Bar} pct=${t.pct} color="var(--accent)" thin />`}
        <div class="target-actions">
          <span class="target-nums grow">${progressText(t)}</span>
          ${action && html`<button class="btn small primary" onClick=${action.run}>${action.label}</button>`}
        </div>
      </div>
    </div>`;
  })}
  ${progress && html`<${ProgressSheet} target=${progress} onClose=${() => setProgress(null)} />`}`;
}
