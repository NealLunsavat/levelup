// The Career page: the skill tree, your real-life milestones, and the quest packs you've unlocked.
import { html, useState } from '../vendor/preact-htm.js';
import { CAREER_NODES } from './career.js';
import { CAREER_QUEST_XP } from './rpgMath.js';
import { put, remove } from './store.js';
import { feedback } from './fx.js';
import { Card, Empty, celebrate, useApp } from './components.js';
import { fmtDate, todayStr } from './util.js';

// Where each node sits in the tree drawing (viewBox 300 × 490).
const POS = { certified: [80, 70], floor: [220, 185], book: [80, 300], program: [220, 415] };

const STATUS_TEXT = {
  unlocked: 'Unlocked',
  ready: 'Ready to unlock!',
  available: 'In progress',
  locked: 'Locked',
};

export function CareerPage() {
  const { game } = useApp();
  const { nodes } = game.career;
  const [selected, setSelected] = useState(() => (nodes.find(n => n.status !== 'unlocked') ?? nodes.at(-1)).id);
  const node = nodes.find(n => n.id === selected);
  return html`<div class="page">
    <h1 class="page-title">Career</h1>
    <p class="muted small">From NASM student to online coach. Each node unlocks once the one before it is unlocked and its requirements are met. Tap a node to see what it needs.</p>
    <div class="career-layout">
      <${Card} class="tree-card"><${SkillTree} nodes=${nodes} selected=${selected} onSelect=${setSelected} /><//>
      <${NodeDetail} node=${node} />
    </div>
    <${Milestones} />
    <${CareerQuests} />
  </div>`;
}

function SkillTree({ nodes, selected, onSelect }) {
  return html`<svg class="tree" viewBox="0 0 300 490" role="group" aria-label="Career skill tree">
    ${nodes.filter(n => n.parent).map(n => {
      const [x1, y1] = POS[n.parent];
      const [x2, y2] = POS[n.id];
      const mid = (y1 + y2) / 2;
      const cls = n.status === 'unlocked' ? 'lit' : n.status === 'locked' ? '' : 'open';
      return html`<path class=${'edge ' + cls} d=${`M${x1} ${y1} C${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`} />`;
    })}
    ${nodes.map(n => {
      const [x, y] = POS[n.id];
      return html`<g class=${'node ' + n.status + (selected === n.id ? ' selected' : '')} transform=${`translate(${x} ${y})`}
        role="button" tabindex="0" aria-label=${`${n.name}: ${STATUS_TEXT[n.status]}`} aria-pressed=${selected === n.id}
        onClick=${() => onSelect(n.id)} onKeyDown=${e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(n.id))}>
        <circle class="halo" r="44" />
        <circle class="disc" r="34" />
        <text class="node-icon" text-anchor="middle" dy="10">${n.status === 'locked' ? '🔒' : n.icon}</text>
        <text class="node-label" text-anchor="middle" y="58">${n.name}</text>
      </g>`;
    })}
  </svg>`;
}

function NodeDetail({ node }) {
  const { data, game, toast } = useApp();
  const parent = CAREER_NODES.find(n => n.id === node.parent);
  const pack = game.career.packs.find(p => p.id === node.pack) ?? null;

  function unlock() {
    const c = data.career;
    put({ ...c, id: 'career', type: 'career', unlocked: { ...(c.unlocked ?? {}), [node.id]: Date.now() } });
    celebrate();
    feedback('levelup', 'heavy');
    toast(`${node.icon} ${node.name} unlocked! New quests: ${node.unlocks}`);
  }

  return html`<${Card} class=${'node-detail ' + node.status}>
    <div class="node-detail-head">
      <span class="node-detail-icon">${node.icon}</span>
      <div>
        <h2>${node.name}</h2>
        <div class=${'node-status ' + node.status}>${node.status === 'unlocked' ? `Unlocked ${new Date(node.unlockedAt).toLocaleDateString()}` : STATUS_TEXT[node.status]}</div>
      </div>
    </div>
    ${node.status === 'locked' && html`<p class="muted small">Unlock <b>${parent?.name}</b> first.</p>`}
    <div class="reqs">
      ${parent && html`<div class=${'req' + (node.status !== 'locked' ? ' done' : '')}><span class="req-check">${node.status !== 'locked' ? '✓' : '○'}</span>${parent.name} unlocked</div>`}
      ${node.requires.map(r => html`<div class=${'req' + (r.done ? ' done' : '')}>
        <span class="req-check">${r.done ? '✓' : '○'}</span>
        <span class="grow">${r.label}</span>
        ${r.target != null && html`<span class="small muted">${r.attr ? `Lv ${r.value}` : r.value} / ${r.target}</span>`}
      </div>`)}
    </div>
    <div class="unlocks"><span class="tiny muted">UNLOCKS</span><b>${node.unlocks}</b></div>
    ${node.status === 'ready' && html`<button class="btn primary unlock-btn" onClick=${unlock}>✨ Unlock ${node.name}</button>`}
    ${pack && html`<p class="muted small">These quests are on your Home screen every day.</p>`}
  <//>`;
}

function Milestones() {
  const { data, game } = useApp();
  const c = data.career;
  const save = patch => put({ ...c, id: 'career', type: 'career', ...patch });
  const int = game.attributes.find(a => a.id === 'int');
  const cha = game.attributes.find(a => a.id === 'cha');
  const flag = (key, label, done, button, confirmText) => html`<div class="milestone">
    <span class="grow">${label}</span>
    ${c[key]
      ? html`<span class="small good-text">✓ ${fmtDate(c[key])}</span><button class="link small" onClick=${() => confirm(`Undo "${done}"?`) && save({ [key]: null })}>Undo</button>`
      : html`<button class="btn small" onClick=${() => confirm(confirmText) && save({ [key]: todayStr() })}>${button}</button>`}
  </div>`;
  return html`<${Card} title="Real-life milestones">
    <p class="muted small">The tree tracks things that happen outside the app. Mark them here when they happen.</p>
    ${flag('examPassedOn', '🎓 NASM CPT exam', 'Passed the NASM exam', 'I passed!', 'Mark the NASM CPT exam as passed? 🎉')}
    ${flag('jobSecuredOn', '🏟️ Equinox job', 'Equinox job secured', 'I got the job!', 'Mark your Equinox job as secured? 🎉')}
    <div class="milestone">
      <span class="grow">👥 IRL clients</span>
      <div class="stepper">
        <button class="btn small" aria-label="One fewer client" onClick=${() => save({ clients: Math.max(0, (c.clients || 0) - 1) })}>−</button>
        <b>${c.clients || 0}</b>
        <button class="btn small" aria-label="One more client" onClick=${() => save({ clients: (c.clients || 0) + 1 })}>+</button>
      </div>
    </div>
    <div class="milestone"><span class="grow">🧠 INT level</span><b>Lv ${int.level}</b></div>
    <div class="milestone"><span class="grow">🎥 CHA level</span><b>Lv ${cha.level}</b></div>
  <//>`;
}

// Today's quests from every unlocked pack. Shown on the Career page and on Home.
export function CareerQuests({ home }) {
  const { game, data, toast } = useApp();
  const packs = game.career.packs;
  if (!packs.length) {
    return home ? null : html`<${Card} title="Career quests"><${Empty}>Unlock your first node to get daily career quests.<//><//>`;
  }
  const doneToday = new Map(data.logs.filter(l => l.kind === 'career' && l.date === game.today).map(l => [l.questId, l]));
  function toggle(pack, q) {
    const log = doneToday.get(q.id);
    if (log) return remove(log.id);
    put({ type: 'log', kind: 'career', skill: pack.skill, date: game.today, createdAt: Date.now(), questId: q.id, title: q.title, pack: pack.id });
    feedback('tick');
    toast(`🎯 ${q.title}`);
  }
  const all = packs.flatMap(p => p.quests);
  const done = all.filter(q => doneToday.has(q.id)).length;
  return html`<${Card} title="🎯 Career quests" right=${html`<span class="muted small">${done}/${all.length} today</span>`}>
    ${packs.map(p => html`<div class="pack">
      <div class="pack-name">${p.icon} ${p.name}</div>
      ${p.quests.map(q => html`<button class=${'quest' + (doneToday.has(q.id) ? ' done' : '')} onClick=${() => toggle(p, q)} aria-pressed=${doneToday.has(q.id)}>
        <span class="quest-check">${doneToday.has(q.id) ? '✓' : ''}</span>
        <span class="quest-main"><span class="quest-title">${q.title}</span></span>
        <span></span>
        <span class="quest-xp">+${CAREER_QUEST_XP}</span>
      </button>`)}
    </div>`)}
  <//>`;
}
