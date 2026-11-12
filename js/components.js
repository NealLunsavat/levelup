// Shared UI pieces used across pages.
import { html, createContext, useContext, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { KINDS, logXP } from './game.js';
import { fmtDate, fmtMoney, fmtMinutes, fmtNum } from './util.js';

// App-wide context: { data, game, skills, skillMap, openLog, toast }.
export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function Bar({ pct, color, thin, danger }) {
  const width = `${Math.max(0, Math.min(1, pct || 0)) * 100}%`;
  return html`<div class=${'bar' + (thin ? ' thin' : '') + (danger ? ' danger' : '')}>
    <div class="fill" style=${{ width, background: color }}></div>
  </div>`;
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.classList.add('locked');
    return () => {
      removeEventListener('keydown', onKey);
      document.body.classList.remove('locked');
    };
  }, []);
  return html`<div class="overlay" onClick=${e => e.target === e.currentTarget && onClose()}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${title}>
      <header class="sheet-head">
        <h2>${title}</h2>
        <button class="icon-btn" onClick=${onClose} aria-label="Close">✕</button>
      </header>
      <div class="sheet-body">${children}</div>
    </div>
  </div>`;
}

export const Card = ({ title, right, children, class: cls = '' }) => html`<section class=${'card ' + cls}>
  ${(title || right) && html`<div class="card-head"><h3>${title}</h3>${right}</div>`}
  ${children}
</section>`;

export const Stat = ({ label, value, sub }) => html`<div class="stat">
  <div class="stat-value">${value}</div>
  <div class="stat-label">${label}</div>
  ${sub && html`<div class="stat-sub">${sub}</div>`}
</div>`;

export const Empty = ({ children }) => html`<p class="empty">${children}</p>`;

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// A number that counts up (or down) to its new value.
export function Count({ value, format = fmtNum }) {
  const [shown, setShown] = useState(() => (reduceMotion() ? value : 0));
  const current = useRef(shown);
  useEffect(() => {
    const from = current.current;
    if (from === value || reduceMotion()) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame;
    const step = now => {
      // A frame's timestamp can be slightly earlier than `start`, so clamp to [0, 1].
      const p = Math.max(0, Math.min(1, (now - start) / 900));
      current.current = from + (value - from) * (1 - Math.pow(1 - p, 3));
      setShown(current.current);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return format(shown);
}

// Confetti burst for big moments (purchases, unlocks, level-ups).
export function celebrate() {
  if (reduceMotion()) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#f3e600', '#00e5ff', '#ff2e88', '#2bff88', '#b45cff', '#ffffff'];
  for (let i = 0; i < 140; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = piece.style.color = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.animationDuration = `${2 + Math.random() * 1.5}s`;
    piece.style.setProperty('--x', `${Math.random() * 200 - 100}px`);
    piece.style.setProperty('--r', `${Math.random() * 900}deg`);
    box.appendChild(piece);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

export function PlayerCard({ compact }) {
  const { game, data } = useApp();
  const o = game.overall;
  const stressColor = game.stress >= 75 ? 'var(--danger)' : game.stress >= 40 ? 'var(--gold)' : 'var(--cyan)';
  return html`<div class=${'player' + (compact ? ' compact' : '') + (game.cyberpsychosis ? ' psycho' : '')}>
    ${!compact && html`<a class="player-gear" href="#/settings" aria-label="Settings">⚙️</a>`}
    <div class="player-row">
      <div class="avatar"><span class="lv-label">LV</span><span class="lv-num">${o.level}</span></div>
      <div class="player-info">
        <div class="player-name">${data.settings.name || 'Player'}</div>
        <div class="player-title">${game.title}</div>
        <${Bar} pct=${o.pct} color="var(--xp)" />
        <div class="xp-text"><${Count} value=${o.into} /> / ${fmtNum(o.need)} XP to Lv ${o.level + 1}</div>
      </div>
    </div>
    <div class="vitals">
      <div class="hp">
        <span class="hp-label">❤️ HP</span>
        <${Bar} pct=${game.hp / game.maxHp} color=${game.hp > 60 ? 'var(--good)' : game.hp > 30 ? 'var(--gold)' : 'var(--danger)'} />
        <span class="hp-num"><${Count} value=${game.hp} />/${game.maxHp}</span>
      </div>
      <a class="gold" href="#/shop" title="Gold: spend it in the Loot Shop">🪙 <${Count} value=${game.gold} /></a>
      <div class="hp">
        <span class="hp-label">🧠 STRESS</span>
        <${Bar} pct=${game.stress / game.maxStress} color=${stressColor} />
        <span class="hp-num"><${Count} value=${game.stress} />%</span>
      </div>
    </div>
    ${!compact && html`<div class="chips">
      ${game.buffs.map(b => html`<span class=${'chip ' + (b.bad ? 'debuff' : 'buff')} title=${b.desc}>${b.icon} ${b.name} · ${b.desc}</span>`)}
      <span class="chip fire">🔥 ${game.streak}-day streak</span>
      <span class="chip">⚡ +<${Count} value=${game.todayXP} /> XP today</span>
      <span class="chip">✨ <${Count} value=${game.total} /> total XP</span>
    </div>`}
  </div>`;
}

export function AttributeGrid() {
  const { game } = useApp();
  return html`<div class="attr-grid">
    ${game.attributes.map(a => html`<a class="attr-card" href=${'#/skill/' + a.page} style=${{ '--c': a.color }}>
      <div class="attr-top"><span class="attr-name">${a.icon} ${a.name}</span><span class="skill-lv">Lv ${a.level}</span></div>
      <div class="tiny muted">${a.full}</div>
      <${Bar} pct=${a.pct} color=${a.color} thin />
      <div class="tiny muted">${fmtNum(a.into)} / ${fmtNum(a.need)} XP</div>
    </a>`)}
  </div>`;
}

export function SkillGrid() {
  const { skills, game } = useApp();
  return html`<div class="skill-grid">
    ${skills.filter(s => !s.hidden).map(s => {
      const lv = game.skillLevels[s.id];
      return html`<a class="skill-card" href=${'#/skill/' + s.id} style=${{ '--c': s.color }}>
        <div class="skill-top"><span class="skill-icon">${s.icon}</span><span class="skill-lv">Lv ${lv.level}</span></div>
        <div class="skill-name">${s.name}</div>
        <${Bar} pct=${lv.pct} color=${s.color} thin />
        <div class="tiny muted">${fmtNum(lv.into)} / ${fmtNum(lv.need)} XP</div>
      </a>`;
    })}
  </div>`;
}

export function describeLog(l, ctx) {
  const parts = [];
  switch (l.kind) {
    case 'payment':
      parts.push(fmtMoney(l.amount), `→ ${ctx.data.debts.find(d => d.id === l.debtId)?.name ?? 'deleted debt'}`);
      break;
    case 'shift':
      parts.push(fmtMoney(l.amount), l.platform, l.hours && `${l.hours}h`, l.miles && `${l.miles} mi`);
      break;
    case 'itshift':
      parts.push(`${l.hours}h`, l.pay && fmtMoney(l.pay), l.note);
      break;
    case 'study':
      parts.push(l.stealth && '🥷 Stealth', fmtMinutes(l.minutes), l.topic);
      break;
    case 'activity':
      parts.push(fmtMinutes(l.minutes), l.note);
      break;
    case 'content':
      parts.push(l.category, fmtMinutes(l.minutes), l.note);
      break;
    case 'rest':
      parts.push(l.game, fmtMinutes(l.minutes));
      break;
    case 'sleep':
      parts.push(`${l.hours}h`, l.bedtime && `in bed ${l.bedtime}`);
      break;
    case 'macros':
      parts.push(l.calories && `${l.calories} kcal`, l.protein && `${l.protein}g protein`, l.carbs && `${l.carbs}g carbs`, l.fat && `${l.fat}g fat`);
      break;
    case 'career':
      parts.push(l.title);
      break;
    case 'quiz':
      parts.push(`${l.score}%`, l.topic);
      break;
    case 'draw':
      parts.push(fmtMinutes(l.minutes), (l.focus || []).join(', '), l.note);
      break;
    case 'workout':
      parts.push(l.category, fmtMinutes(l.minutes), l.note);
      break;
    case 'pr':
      parts.push(`${l.exercise} ${l.weight} lb${l.reps ? ` × ${l.reps}` : ''}`);
      break;
    case 'meal':
      parts.push(l.name, l.calories && `${l.calories} kcal`, l.protein && `${l.protein}g protein`);
      break;
  }
  return parts.filter(Boolean).join(' · ');
}

export function LogList({ logs, limit = 10 }) {
  const ctx = useApp();
  if (!logs.length) return html`<${Empty}>Nothing logged yet. Tap <b>+</b> to earn your first XP.<//>`;
  return html`<div class="log-list">
    ${logs.slice(0, limit).map(l => {
      const skill = ctx.skillMap[l.skill];
      const label = l.kind === 'activity' ? `${skill?.name ?? 'Custom'} session` : KINDS[l.kind]?.label;
      return html`<button class="log-row" onClick=${() => ctx.openLog({ record: l })}>
        <span class="log-icon" style=${{ background: (skill?.color ?? '#888') + '26' }}>${l.kind === 'activity' ? skill?.icon ?? '⭐' : KINDS[l.kind]?.icon}</span>
        <span class="log-main">
          <span class="log-title">${label}</span>
          <span class="log-sub">${describeLog(l, ctx)}</span>
        </span>
        <span class="log-meta"><span class="xp">+${ctx.game.xpOfLog[l.id] ?? logXP(l)}</span><span class="tiny muted">${fmtDate(l.date)}</span></span>
      </button>`;
    })}
  </div>`;
}

// The character "build": a radar chart of attribute levels, with your build from 4 weeks ago outlined.
export function BuildRadar() {
  const { game } = useApp();
  const attrs = game.attributes;
  const ago = game.attributesAgo;
  const showAgo = ago.some(a => a.xp > 0);
  const value = a => a.level - 1 + a.pct;
  const max = Math.max(4, ...attrs.map(value), ...ago.map(value));
  const size = 300;
  const c = size / 2;
  const R = 104;
  const point = (i, r) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / attrs.length;
    return [c + r * Math.cos(angle), c + r * Math.sin(angle)];
  };
  const shape = list => list.map((a, i) => point(i, R * Math.max(0.06, value(a) / max)).map(n => n.toFixed(1)).join(',')).join(' ');
  const ring = f => attrs.map((_, i) => point(i, R * f).map(n => n.toFixed(1)).join(',')).join(' ');
  return html`<div class="radar">
    <svg viewBox=${`0 0 ${size} ${size}`} role="img" aria-label=${'Character build: ' + attrs.map(a => `${a.name} level ${a.level}`).join(', ')}>
      ${[0.25, 0.5, 0.75, 1].map(f => html`<polygon class="radar-ring" points=${ring(f)} />`)}
      ${attrs.map((_, i) => {
        const [x, y] = point(i, R);
        return html`<line class="radar-spoke" x1=${c} y1=${c} x2=${x} y2=${y} />`;
      })}
      ${showAgo && html`<polygon class="radar-ago" points=${shape(ago)} />`}
      <polygon class="radar-now" points=${shape(attrs)} />
      ${attrs.map((a, i) => {
        const [x, y] = point(i, R * Math.max(0.06, value(a) / max));
        return html`<circle class="radar-dot" cx=${x} cy=${y} r="4" style=${{ fill: a.color }} />`;
      })}
      ${attrs.map((a, i) => {
        const [x, y] = point(i, R + 26);
        return html`<g class="radar-label" transform=${`translate(${x} ${y})`}>
          <text text-anchor="middle" y="-3" style=${{ fill: a.color }}>${a.name}</text>
          <text text-anchor="middle" y="13" class="radar-lv">Lv ${a.level}</text>
        </g>`;
      })}
    </svg>
    <div class="radar-legend tiny muted">
      <span><i class="key now"></i>Now</span>
      ${showAgo ? html`<span><i class="key ago"></i>4 weeks ago</span>` : html`<span>Check back in a few weeks to see how your build changed</span>`}
    </div>
  </div>`;
}
