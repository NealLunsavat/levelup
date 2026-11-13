// Home sections for the day and the week: the Main Quest slot, the IT-shift Bounty Board,
// and Weekly Quests.
import { html, useState } from '../vendor/preact-htm.js';
import { ATTRIBUTES, bountyTickId, mainQuestId } from './game.js';
import { BOUNTY_XP, CRIT_MULTIPLIER, MAIN_QUEST_GOLD, MAIN_QUEST_PENALTY, MAIN_QUEST_XP, isCrit } from './rpgMath.js';
import { claimId, progressId } from './weekly.js';
import { put, remove } from './store.js';
import { feedback } from './fx.js';
import { Bar, Card, Empty, celebrate, useApp } from './components.js';
import { fmtLeft, fmtMoney, fmtNum } from './util.js';

const ATTR = Object.fromEntries(ATTRIBUTES.map(a => [a.id, a]));
export const rewardText = (rewards, times = 1) => (rewards ?? []).map(r => `+${r.xp * times} ${ATTR[r.attr]?.name ?? 'XP'}`).join(' · ');

// ---------------- Main Quest ----------------

function MainForm({ slot, onDone }) {
  const rec = slot.rec;
  const [title, setTitle] = useState(rec?.title ?? '');
  const [attr, setAttr] = useState(rec?.attr ?? 'int');
  function save(e) {
    e.preventDefault();
    if (!title.trim()) {
      if (rec) remove(rec.id);
      return onDone();
    }
    put({ ...(rec ?? {}), id: mainQuestId(slot.date), type: 'main', date: slot.date, title: title.trim(), attr, createdAt: rec?.createdAt ?? Date.now(), doneAt: rec?.doneAt ?? null });
    if (!rec) feedback('quest', 'double');
    onDone();
  }
  return html`<form class="form" onSubmit=${save}>
    <input type="text" placeholder="e.g. Score 85% on the NASM Chapter 6 quiz" aria-label="Main quest" value=${title} onInput=${e => setTitle(e.target.value)} />
    <div class="chip-row">
      ${ATTRIBUTES.map(a => html`<button type="button" class=${'chip-btn mini' + (attr === a.id ? ' on' : '')} onClick=${() => setAttr(a.id)}>${a.icon} ${a.name}</button>`)}
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost small" onClick=${onDone}>Cancel</button>
      <button type="submit" class="btn primary small grow">${rec ? 'Save' : 'Lock it in'}</button>
    </div>
  </form>`;
}

// The one thing that matters most today. Clear it by 9 PM for a big bounty; miss it and it costs HP.
export function MainQuest() {
  const { game, toast } = useApp();
  const [editing, setEditing] = useState(null); // 'today' | 'tomorrow'
  const { main, mainTomorrow, now } = game;
  const pastDeadline = now > main.deadline;
  const attr = ATTR[main.rec?.attr];
  const stakes = `+${MAIN_QUEST_XP} XP · +${MAIN_QUEST_GOLD} Gold · miss the 9 PM deadline: −${MAIN_QUEST_PENALTY} HP`;

  function clear() {
    put({ ...main.rec, doneAt: Date.now() });
    celebrate();
    feedback('levelup', 'heavy');
    toast(`⭐ Main quest cleared! +${MAIN_QUEST_XP} ${attr?.name ?? 'XP'} · +${MAIN_QUEST_GOLD} Gold`);
  }

  let body;
  if (editing === 'today') body = html`<${MainForm} slot=${main} onDone=${() => setEditing(null)} />`;
  else if (main.status === 'active') {
    body = html`
      <div class="mainq-title">${main.rec.title}</div>
      <div class="mainq-meta"><span class="reward">${attr?.icon} +${MAIN_QUEST_XP} ${attr?.name}</span><span class="reward">+${MAIN_QUEST_GOLD} Gold</span><span class="reward bad">⏳ ${fmtLeft(main.deadline - now)} left · −${MAIN_QUEST_PENALTY} HP</span></div>
      <div class="form-actions">
        <button class="btn ghost small" onClick=${() => setEditing('today')}>Edit</button>
        <button class="btn primary grow" onClick=${clear}>✓ Clear main quest</button>
      </div>`;
  } else if (main.status === 'done') {
    body = html`<div class="mainq-title done">✓ ${main.rec.title}</div><div class="mainq-meta"><span class="reward good">Cleared · +${MAIN_QUEST_XP} ${attr?.name} · +${MAIN_QUEST_GOLD} Gold</span></div>`;
  } else if (main.status === 'failed') {
    body = html`<div class="mainq-title failed">✗ ${main.rec.title}</div><div class="mainq-meta"><span class="reward bad">Deadline missed · −${MAIN_QUEST_PENALTY} HP</span></div>`;
  } else if (pastDeadline) {
    body = html`<p class="muted small">No main quest was set today. Lock in tomorrow's before bed.</p>`;
  } else {
    body = html`<p class="muted small">Pick the single most important thing today. ${stakes}.</p>
      <button class="btn primary" onClick=${() => setEditing('today')}>+ Set today's main quest</button>`;
  }

  return html`<section class=${'mainq ' + main.status}>
    <div class="mainq-kicker">⭐ MAIN QUEST · TODAY</div>
    ${body}
    <div class="mainq-next">
      ${editing === 'tomorrow'
        ? html`<div class="mainq-kicker dim">TOMORROW</div><${MainForm} slot=${mainTomorrow} onDone=${() => setEditing(null)} />`
        : mainTomorrow.rec?.title
          ? html`<span class="tiny muted grow">TOMORROW · <b>${mainTomorrow.rec.title}</b></span><button class="link tiny" onClick=${() => setEditing('tomorrow')}>Edit</button>`
          : html`<span class="tiny muted grow">Tomorrow's main quest isn't set.</span><button class="link tiny" onClick=${() => setEditing('tomorrow')}>Set it now</button>`}
    </div>
  </section>`;
}

// ---------------- Bounty Board ----------------

// Micro-bounties that only show during the IT shift: small, specific tasks for instant XP.
export function BountyBoard() {
  const ctx = useApp();
  const { game } = ctx;
  const board = game.bountyBoard;
  if (!board.open || !board.list.length) return null;
  const done = board.list.filter(b => b.tick).length;

  function toggle(b) {
    if (b.tick) return remove(b.tick.id);
    const id = bountyTickId(b.id, game.today);
    const xp = Number(b.xp) || BOUNTY_XP;
    put({ id, type: 'btick', bountyId: b.id, date: game.today, at: Date.now(), title: b.title, attr: b.attr, xp });
    const crit = isCrit(id);
    if (crit) ctx.crit();
    else feedback('tick');
    ctx.toast(`🎯 ${b.title} · +${xp * (crit ? CRIT_MULTIPLIER : 1)} ${ATTR[b.attr]?.name ?? 'XP'}`);
  }

  return html`<${Card} title="🎯 Bounty Board" class="bounty-card" right=${html`<span class="muted small">${done}/${board.list.length} · closes in ${fmtLeft(board.closesAt - game.now)}</span>`}>
    <p class="muted small">IT downtime micro-bounties. Small, specific, instant XP.</p>
    <div class="quest-list">
      ${board.list.map(b => html`<button class=${'quest' + (b.tick ? ' done' : '')} onClick=${() => toggle(b)} aria-pressed=${!!b.tick}>
        <span class="quest-check">${b.tick ? '✓' : ATTR[b.attr]?.icon ?? '🎯'}</span>
        <span class="quest-main"><span class="quest-title">${b.title}</span></span>
        <span></span>
        <span class="quest-xp">+${Number(b.xp) || BOUNTY_XP} ${ATTR[b.attr]?.name ?? ''}</span>
      </button>`)}
    </div>
  <//>`;
}

// ---------------- Weekly Quests ----------------

function weeklyProgress(q) {
  if (q.money) return `${fmtMoney(Math.min(q.value, q.target))} / ${fmtMoney(q.target)}`;
  const value = q.decimals ? Math.round(Math.min(q.value, q.target) * 10) / 10 : Math.min(q.value, q.target);
  return `${fmtNum(value) === String(value) ? value : value} / ${fmtNum(q.target)}`;
}

export function WeeklyQuests() {
  const ctx = useApp();
  const { game } = ctx;
  const list = game.weekly;
  const claimed = list.filter(q => q.claim).length;

  function claim(q) {
    const id = claimId(q.id, game.week);
    put({ id, type: 'wdone', questId: q.id, week: game.week, title: q.title, rewards: q.rewards, at: Date.now() });
    const crit = isCrit(id);
    if (crit) ctx.crit();
    else feedback('quest', 'double');
    ctx.toast(`🏆 ${q.title} · ${rewardText(q.rewards, crit ? CRIT_MULTIPLIER : 1)}`);
  }
  const setCount = (q, count) => put({ id: progressId(q.id, game.week), type: 'wprog', questId: q.id, week: game.week, count });
  function bump(q, by) {
    const count = Math.max(0, Math.min(q.target, q.value + by));
    setCount(q, count);
    if (by > 0 && count >= q.target) claim(q);
    else feedback('tick');
  }
  function undo(q) {
    remove(q.claim.id);
    setCount(q, Math.max(0, q.target - 1));
  }

  return html`<${Card} title="Weekly quests" right=${html`<span class="muted small">${claimed}/${list.length} · resets in ${fmtLeft(game.weekResetsAt - game.now)}</span>`}>
    ${list.length === 0 && html`<${Empty}>No weekly quests. Add some in <a href="#/settings">Settings</a>.<//>`}
    <div class="weekly">
      ${list.map(q => {
        const attr = ATTR[q.rewards?.[0]?.attr];
        const ready = q.complete && !q.claim;
        return html`<div class=${'wq' + (q.claim ? ' claimed' : ready ? ' ready' : '')} style=${{ '--c': attr?.color ?? 'var(--accent)' }} key=${q.id}>
          <div class="wq-main">
            <div class="wq-title">${attr?.icon} ${q.title}</div>
            ${q.note && html`<div class="wq-note">${q.note}</div>`}
            <${Bar} pct=${q.claim ? 1 : q.pct} color=${attr?.color} thin />
            <div class="wq-foot">
              <span class="target-nums">${q.claim ? 'Claimed' : weeklyProgress(q)}${!q.manual && !q.claim ? ' · tracks itself' : ''}</span>
              ${(q.rewards ?? []).map(r => html`<span class="reward" style=${{ '--c': ATTR[r.attr]?.color }}>+${r.xp} ${ATTR[r.attr]?.name}</span>`)}
            </div>
          </div>
          <div class="wq-action">
            ${q.claim
              ? html`<span class="wq-check">✓</span>${q.manual && html`<button class="link tiny" onClick=${() => undo(q)}>Undo</button>`}`
              : ready
                ? html`<button class="btn small primary claim" onClick=${() => claim(q)}>Claim</button>`
                : q.manual
                  ? html`<button class="btn small" onClick=${() => bump(q, 1)} aria-label=${q.target > 1 ? `Add one to ${q.title}` : `Complete ${q.title}`}>${q.target > 1 ? '+1' : '✓ Done'}</button>
                      ${q.value > 0 && html`<button class="link tiny" onClick=${() => bump(q, -1)}>−1</button>`}`
                  : null}
          </div>
        </div>`;
      })}
    </div>
  <//>`;
}
