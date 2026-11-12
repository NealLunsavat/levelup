// App shell: routing, layout, toasts and level-up celebrations.
import { html, render, useCallback, useEffect, useMemo, useRef, useState } from '../vendor/preact-htm.js';
import { all, changeSource, get, subscribe } from './store.js';
import { BONUS, SKILLS, buildGame } from './game.js';
import { Ctx, PlayerCard } from './components.js';
import { LogSheet } from './logsheet.js';
import { Home, SkillPage, SkillsPage, Stats } from './pages.js';
import { Settings } from './settings.js';
import { todayStr } from './util.js';
import * as sync from './sync.js';

function snapshot() {
  return {
    logs: all('log').sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    quests: all('quest').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    debts: all('debt'),
    customSkills: all('skill').sort((a, b) => a.updatedAt - b.updatedAt),
    settings: get('settings') ?? {},
  };
}

function useRoute() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => {
      setHash(location.hash || '#/');
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash.slice(1);
}

// Re-render when the date rolls over (e.g. the app was left open overnight).
function useToday() {
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const check = () => setToday(todayStr());
    const id = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  skills: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  stats: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};
const Icon = ({ name }) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICONS[name]} /></svg>`;

const NAV = [
  { href: '#/', label: 'Home', icon: 'home', match: r => r === '/' || r === '' },
  { href: '#/skills', label: 'Skills', icon: 'skills', match: r => r.startsWith('/skill') },
  { href: '#/stats', label: 'Stats', icon: 'stats', match: r => r === '/stats' },
  { href: '#/settings', label: 'Settings', icon: 'settings', match: r => r === '/settings' },
];

function App() {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribe(() => setVersion(v => v + 1)), []);
  const route = useRoute();
  const today = useToday();

  const data = useMemo(snapshot, [version]);
  const skills = useMemo(() => [
    ...SKILLS,
    ...data.customSkills.map(s => ({ id: s.id, name: s.name, icon: s.icon || '⭐', color: s.color || '#9b8cff', custom: true })),
  ], [data]);
  const skillMap = useMemo(() => Object.fromEntries(skills.map(s => [s.id, s])), [skills]);
  const game = useMemo(() => buildGame({ ...data, skills }, today), [data, skills, today]);

  const [toasts, setToasts] = useState([]);
  const toast = useCallback(text => {
    const id = Math.random();
    setToasts(t => [...t, { id, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);
  const [logSheet, setLogSheet] = useState(null);
  const [levelUp, setLevelUp] = useState(null);

  // Celebrate level-ups, cleared quests and defeated bosses (only for changes made on this device).
  const prev = useRef(null);
  useEffect(() => {
    const snap = {
      today,
      level: game.overall.level,
      skills: game.skillLevels,
      allClear: game.allClear,
      defeated: game.bosses.filter(b => b.defeatedOn).length,
    };
    const p = prev.current;
    prev.current = snap;
    if (!p || p.today !== today || changeSource() !== 'local') return;
    if (snap.level > p.level) setLevelUp({ level: snap.level, title: game.title });
    for (const s of skills) {
      if (p.skills[s.id] && snap.skills[s.id].level > p.skills[s.id].level) toast(`${s.icon} ${s.name} reached Lv ${snap.skills[s.id].level}!`);
    }
    if (snap.allClear && !p.allClear) toast(`🎉 All daily quests cleared! +${BONUS.allQuests} XP`);
    if (snap.defeated > p.defeated) toast(`⚔️ Debt boss defeated! +${BONUS.boss} XP`);
  }, [game]);

  const ctx = { data, game, skills, skillMap, toast, openLog: opts => setLogSheet(opts ?? {}) };

  let page;
  if (route.startsWith('/skill/')) page = html`<${SkillPage} id=${decodeURIComponent(route.slice(7))} />`;
  else if (route === '/skills') page = html`<${SkillsPage} />`;
  else if (route === '/stats') page = html`<${Stats} />`;
  else if (route === '/settings') page = html`<${Settings} />`;
  else page = html`<${Home} />`;

  return html`<${Ctx.Provider} value=${ctx}>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><img src="icons/icon.svg" alt="" /> LevelUp</div>
        <${PlayerCard} compact />
        <button class="btn primary log-btn" onClick=${() => ctx.openLog()}>+ Log activity</button>
        <nav class="side-nav">
          ${NAV.map(n => html`<a href=${n.href} class=${n.match(route) ? 'active' : ''}><${Icon} name=${n.icon} />${n.label}</a>`)}
        </nav>
        <div class="side-foot muted tiny">🔥 ${game.streak}-day streak · +${game.todayXP} XP today</div>
      </aside>
      <main class="main">${page}</main>
      <nav class="tabbar">
        ${NAV.slice(0, 2).map(n => html`<a href=${n.href} class=${'tab' + (n.match(route) ? ' active' : '')}><${Icon} name=${n.icon} />${n.label}</a>`)}
        <button class="tab-log" onClick=${() => ctx.openLog()} aria-label="Log activity">+</button>
        ${NAV.slice(2).map(n => html`<a href=${n.href} class=${'tab' + (n.match(route) ? ' active' : '')}><${Icon} name=${n.icon} />${n.label}</a>`)}
      </nav>
    </div>
    ${logSheet && html`<${LogSheet} initial=${logSheet} onClose=${() => setLogSheet(null)} />`}
    ${levelUp && html`<div class="levelup" onClick=${() => setLevelUp(null)}>
      <div class="levelup-card">
        <div class="levelup-rays"></div>
        <div class="levelup-kicker">LEVEL UP!</div>
        <div class="levelup-num">${levelUp.level}</div>
        <div class="levelup-title">${levelUp.title}</div>
        <button class="btn primary">Let's go</button>
      </div>
    </div>`}
    <div class="toasts" aria-live="polite">${toasts.map(t => html`<div class="toast" key=${t.id}>${t.text}</div>`)}</div>
  <//>`;
}

render(html`<${App} />`, document.getElementById('app'));

// Sync: start up, then push changes a moment after you make them and pull when the app comes back.
sync.init();
let pushTimer;
subscribe(source => {
  if (source !== 'local') return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(sync.syncNow, 2000);
});
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sync.syncNow());
setInterval(() => document.visibilityState === 'visible' && sync.syncNow(), 5 * 60000);

// Offline support. Skipped on localhost so edits show up immediately while developing.
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js');
  // A new version finished installing: reload once to use it.
  navigator.serviceWorker.addEventListener('controllerchange', () => hadController && location.reload());
}
