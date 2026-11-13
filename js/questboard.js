// The Daily Dungeon quest board: today's time-gated quests, locking and unlocking with the clock.
import { html } from '../vendor/preact-htm.js';
import { ATTRIBUTES, KINDS, prepId } from './game.js';
import { STEALTH_MIN_MINUTES, STEALTH_MULTIPLIER, HP_REGEN_PER_QUEST } from './rpgMath.js';
import { OVERDRIVE_QUESTS } from './dungeon.js';
import { put } from './store.js';
import { feedback } from './fx.js';
import { Bar, Card, Empty, useApp } from './components.js';
import { dayOfWeek } from './util.js';

const ATTR_NAME = Object.fromEntries(ATTRIBUTES.map(a => [a.id, a.name]));

const fmtTime = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function fmtIn(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export function QuestBoard() {
  const { game } = useApp();
  const quests = game.dungeonToday;
  if (!quests.length) {
    return html`<${Card} title="⚔️ Daily Dungeon">
      <${Empty}>The dungeon is closed today. Rest up; daily and weekly quests still count.<//>
    <//>`;
  }
  const cleared = quests.filter(q => q.status === 'complete').length;
  const dow = dayOfWeek(game.today);
  const core = quests.filter(q => OVERDRIVE_QUESTS.includes(q.id));
  const coreDone = core.filter(q => q.status === 'complete').length;
  return html`<${Card} title="⚔️ Daily Dungeon" right=${html`<span class="muted small">${cleared}/${quests.length} cleared</span>`}>
    <p class="muted small">${dow === 5 ? 'Friday shift schedule.' : dow === 0 ? 'Sunday: just tomorrow’s prep.' : 'Mon–Thu schedule.'} Log each quest during its window to clear it.</p>
    ${core.length === OVERDRIVE_QUESTS.length && html`<div class=${'overdrive-meter' + (game.overdrive ? ' on' : '')}>
      <span>⚡ ${game.overdrive ? 'SANDEVISTAN OVERDRIVE ACTIVE · 2× XP until midnight' : `Overdrive ${coreDone}/${core.length}`}</span>
      ${!game.overdrive && html`<span class="pips">${core.map(q => html`<i class=${q.status === 'complete' ? 'on' : q.status === 'missed' ? 'miss' : ''} title=${q.name}></i>`)}</span>
        <span class="tiny muted">Clear the first four for 2× XP until midnight</span>`}
    </div>`}
    <div class="dungeon">${quests.map(q => html`<${DungeonQuest} q=${q} key=${q.id} />`)}</div>
  <//>`;
}

function DungeonQuest({ q }) {
  const { game, data, openLog } = useApp();
  // Tick or untick one item on a checklist quest (like the nightly Inventory Management).
  const tick = c => {
    const rec = data.preps.find(p => p.date === q.date);
    const items = { ...(rec?.items ?? {}) };
    if (items[c.id]) delete items[c.id];
    else items[c.id] = Date.now();
    put({ ...(rec ?? {}), id: prepId(q.date), type: 'prep', date: q.date, items });
    feedback('tick');
  };
  const now = game.now;
  const open = q.status === 'active';
  const overtime = open && now > q.end;

  const status = {
    locked: `🔒 Unlocks in ${fmtIn(q.start - now)}`,
    active: overtime ? `⌛ Grace period: ${fmtIn(q.graceEnd - now)} left` : `⏳ ${fmtIn(q.end - now)} left`,
    complete: '✓ Cleared',
    missed: q.penalty ? `✗ Missed · −${q.penalty} HP` : '✗ Missed',
    untracked: 'Before tracking began',
  }[q.status];

  const rewards = [
    ...q.objectives.flatMap(o => Object.entries(o.xp ?? {}).map(([a, xp]) => `+${xp} ${ATTR_NAME[a]}`)),
    q.gold && `+${q.gold} Gold`,
    q.note,
    q.buff,
    `+${q.heal ?? HP_REGEN_PER_QUEST} HP`,
  ].filter(Boolean);

  return html`<div class=${'dq ' + q.status}>
    <div class="dq-time">
      <span>${fmtTime(q.start)}</span>
      <span class="muted">${fmtTime(q.end)}</span>
    </div>
    <div class="dq-body">
      <div class="dq-head">
        <span class="dq-name">${q.icon} ${q.name}</span>
        <span class="dq-status">${status}</span>
      </div>
      ${(open || q.status === 'locked') && html`
        <div class="dq-task muted small">${q.task}</div>
        <div class="dq-rewards">
          ${rewards.map(r => html`<span class="reward">${r}</span>`)}
          ${q.penalty > 0 && html`<span class="reward bad">Miss: −${q.penalty} HP</span>`}
        </div>`}

      ${q.checklist && (open || q.status === 'complete') && html`<div class="checklist">
        ${q.checklist.map(c => html`<button class=${'check-item' + (c.done ? ' on' : '')} disabled=${!open} aria-pressed=${c.done} onClick=${() => tick(c)}>
          <span class="check-box">${c.done ? '✓' : ''}</span><span>${c.label}</span>
        </button>`)}
      </div>`}

      ${q.stealth && (open || q.status === 'complete') && html`<div class="stealth">
        <div class="stealth-head">
          <b>🥷 Stealth Mission</b>
          <span class=${'reward' + (q.stealthActive ? ' good' : '')}>${STEALTH_MULTIPLIER}× INT</span>
        </div>
        <${Bar} pct=${q.stealthMinutes / STEALTH_MIN_MINUTES} color="var(--cyan)" thin />
        <div class="tiny muted">${q.stealthActive ? 'Active! Every stealth study session this shift earns 1.5× INT.' : `Study NASM on shift: ${q.stealthMinutes} / ${STEALTH_MIN_MINUTES} min to activate`}</div>
        ${open && html`<button class="btn small" onClick=${() => openLog({ kind: 'study', stealth: true })}>+ Log stealth study</button>`}
      </div>`}

      ${q.id === 'it' && game.encounters.length > 0 && q.status !== 'locked' && html`<div class="tiny muted">
        ⚔️ NASM Ambushes: ${game.encounters.map(e => e.result ? (e.result.correct ? '✅' : '💥') : e.at <= now && open ? '❗' : '·').join(' ')}
        ${open ? ' · they appear when you open the app during your shift' : ''}
      </div>`}
      ${open && html`<div class="dq-actions">
        ${q.objectives.map(o => html`<button class="btn small primary" onClick=${() => openLog({ kind: o.kind })}>
          ${KINDS[o.kind].icon} ${KINDS[o.kind].label}${o.minutes ? ` · ${o.logged}/${o.minutes} min` : ''}
        </button>`)}
      </div>`}
    </div>
  </div>`;
}
