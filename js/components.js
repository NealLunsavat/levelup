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

export function PlayerCard({ compact }) {
  const { game, data } = useApp();
  const o = game.overall;
  return html`<div class=${'player' + (compact ? ' compact' : '')}>
    <div class="player-row">
      <div class="avatar"><span class="lv-label">LV</span><span class="lv-num">${o.level}</span></div>
      <div class="player-info">
        <div class="player-name">${data.settings.name || 'Player'}</div>
        <div class="player-title">${game.title}</div>
        <${Bar} pct=${o.pct} color="var(--xp)" />
        <div class="xp-text">${fmtNum(o.into)} / ${fmtNum(o.need)} XP to Lv ${o.level + 1}</div>
      </div>
    </div>
    ${!compact && html`<div class="chips">
      <span class="chip fire">🔥 ${game.streak}-day streak</span>
      <span class="chip">⚡ +${fmtNum(game.todayXP)} XP today</span>
      <span class="chip">✨ ${fmtNum(game.total)} total XP</span>
    </div>`}
  </div>`;
}

export function SkillGrid() {
  const { skills, game } = useApp();
  return html`<div class="skill-grid">
    ${skills.map(s => {
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
    case 'study':
    case 'activity':
      parts.push(fmtMinutes(l.minutes), l.topic, l.note);
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
        <span class="log-meta"><span class="xp">+${logXP(l)}</span><span class="tiny muted">${fmtDate(l.date)}</span></span>
      </button>`;
    })}
  </div>`;
}
