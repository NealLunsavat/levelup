// Shared UI pieces used across pages.
import { html, createContext, useContext, useEffect } from '../vendor/preact-htm.js';
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

// Confetti burst for big moments (purchases, unlocks, level-ups).
export function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#ffcc4d', '#8b7bff', '#4cd18a', '#ff6fb5', '#4fd1ff', '#ff7a45'];
  for (let i = 0; i < 140; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
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
  const stressColor = game.stress >= 75 ? 'var(--danger)' : game.stress >= 40 ? 'var(--gold)' : '#b49cff';
  return html`<div class=${'player' + (compact ? ' compact' : '') + (game.cyberpsychosis ? ' psycho' : '')}>
    ${!compact && html`<a class="player-gear" href="#/settings" aria-label="Settings">⚙️</a>`}
    <div class="player-row">
      <div class="avatar"><span class="lv-label">LV</span><span class="lv-num">${o.level}</span></div>
      <div class="player-info">
        <div class="player-name">${data.settings.name || 'Player'}</div>
        <div class="player-title">${game.title}</div>
        <${Bar} pct=${o.pct} color="var(--xp)" />
        <div class="xp-text">${fmtNum(o.into)} / ${fmtNum(o.need)} XP to Lv ${o.level + 1}</div>
      </div>
    </div>
    <div class="vitals">
      <div class="hp">
        <span class="hp-label">❤️ HP</span>
        <${Bar} pct=${game.hp / game.maxHp} color=${game.hp > 60 ? 'var(--good)' : game.hp > 30 ? 'var(--gold)' : 'var(--danger)'} />
        <span class="hp-num">${game.hp}/${game.maxHp}</span>
      </div>
      <a class="gold" href="#/shop" title="Gold: spend it in the Loot Shop">🪙 ${fmtNum(game.gold)}</a>
      <div class="hp">
        <span class="hp-label">🧠 STRESS</span>
        <${Bar} pct=${game.stress / game.maxStress} color=${stressColor} />
        <span class="hp-num">${game.stress}%</span>
      </div>
    </div>
    ${!compact && html`<div class="chips">
      ${game.buffs.map(b => html`<span class=${'chip ' + (b.bad ? 'debuff' : 'buff')} title=${b.desc}>${b.icon} ${b.name} · ${b.desc}</span>`)}
      <span class="chip fire">🔥 ${game.streak}-day streak</span>
      <span class="chip">⚡ +${fmtNum(game.todayXP)} XP today</span>
      <span class="chip">✨ ${fmtNum(game.total)} total XP</span>
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
