// App shell: routing, layout, toasts and level-up celebrations.
import { html, render, useCallback, useEffect, useMemo, useRef, useState } from '../vendor/preact-htm.js';
import { all, changeSource, get, subscribe } from './store.js';
import { BONUS, KINDS, SKILLS, buildGame } from './game.js';
import { Ctx, PlayerCard, Sheet, celebrate } from './components.js';
import * as fx from './fx.js';
import { THEMES, applyTheme, getThemePref, resolveTheme, setThemePref } from './theme.js';
import { Ambush } from './ambush.js';
import { CareerPage } from './skilltree.js';
import { Shop } from './shop.js';
import { GoalsPage } from './goalspage.js';
import { OPERATION_XP, PRIME_BONUS_XP, TARGET_XP } from './rpgMath.js';
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
    loot: all('loot'),
    ambushes: all('ambush'),
    goals: all('goal').sort((a, b) => a.createdAt - b.createdAt),
    targets: all('target'),
    career: get('career') ?? {},
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

// A clock that ticks every 30 seconds, so time-gated quests lock and unlock on their own.
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  skills: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  stats: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  goals: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 1v6M12 17v6M1 12h6M17 12h6',
  career: 'M12 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM5 17.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM19 17.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 6.5v5M12 11.5l-6.2 6.2M12 11.5l6.2 6.2',
  shop: 'M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8zM9 8V6a3 3 0 0 1 6 0v2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};
const Icon = ({ name }) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICONS[name]} /></svg>`;

const NAV = [
  { href: '#/', label: 'Home', icon: 'home', match: r => r === '/' || r === '', tab: true },
  { href: '#/goals', label: 'Goals', icon: 'goals', match: r => r === '/goals', tabMatch: r => r === '/goals' || r === '/career', tab: true },
  { href: '#/career', label: 'Career', icon: 'career', match: r => r === '/career' },
  { href: '#/skills', label: 'Skills', icon: 'skills', match: r => r.startsWith('/skill') },
  { href: '#/shop', label: 'Loot Shop', short: 'Shop', icon: 'shop', match: r => r === '/shop', tab: true },
  { href: '#/stats', label: 'Stats', icon: 'stats', match: r => r === '/stats', tab: true },
  { href: '#/settings', label: 'Settings', icon: 'settings', match: r => r === '/settings' },
];
const TABS = NAV.filter(n => n.tab);

// Keyboard shortcuts for the Mac. Number keys work alone or with ⌘/Ctrl (browsers keep ⌘1–9 for
// switching tabs, but the app added to the Dock has no tabs, so ⌘ works there).
const SHORTCUTS = [
  ['1', 'Quest board (Home)', '#/'],
  ['2', 'Loot Shop', '#/shop'],
  ['3', 'Skill tree (Career)', '#/career'],
  ['4', 'Stats', '#/stats'],
  ['5', 'Skills', '#/skills'],
  ['6', 'Goals (hit list)', '#/goals'],
  ['0', 'Settings', '#/settings'],
];

function useShortcuts(openLog, toggleHelp) {
  useEffect(() => {
    const onKey = e => {
      if (e.altKey || e.target.closest?.('input, select, textarea, [contenteditable]')) return;
      const sheetOpen = !!document.querySelector('.overlay');
      const go = SHORTCUTS.find(([key]) => key === e.key);
      if (go) {
        if (sheetOpen) return;
        e.preventDefault();
        location.hash = go[2];
        fx.play('tap');
      } else if (!e.metaKey && !e.ctrlKey && (e.key === 'n' || e.key === 'l') && !sheetOpen) {
        e.preventDefault();
        openLog();
      } else if (e.key === '?') {
        e.preventDefault();
        toggleHelp();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}

function ShortcutHelp({ onClose }) {
  const row = (label, key) => html`<div class="mini-row"><span>${label}</span><span></span><kbd>${key}</kbd></div>`;
  return html`<${Sheet} title="Keyboard shortcuts" onClose=${onClose}>
    <div class="mini-table">
      ${SHORTCUTS.map(([key, label]) => row(label, key))}
      ${row('Log activity', 'N')}
      ${row('Close a sheet', 'Esc')}
      ${row('Show this list', '?')}
    </div>
    <p class="muted small">Number keys work on their own or with ⌘. In a regular browser tab ⌘1–9 switches tabs, so use the plain numbers there.</p>
  <//>`;
}

// A short terminal-style boot screen, once per app launch. Tap to skip.
function Boot({ name }) {
  const [show, setShow] = useState(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      if (sessionStorage.getItem('levelup:booted')) return false;
      sessionStorage.setItem('levelup:booted', '1');
    } catch {}
    return true;
  });
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setShow(false), 1950);
    return () => clearTimeout(id);
  }, []);
  if (!show) return null;
  const lines = [
    ['> LEVELUP//OS v3.0'],
    ['> NEURAL LINK .......', true],
    ['> DAILY DUNGEON .....', true],
    ['> GOLD LEDGER .......', true],
    [`> WELCOME BACK, ${(name || 'PLAYER').toUpperCase()}`],
  ];
  return html`<div class="boot" onClick=${() => setShow(false)} aria-hidden="true">
    <div class="boot-logo">LEVEL<span>UP</span></div>
    ${lines.map(([text, ok]) => html`<div class="boot-line" style=${{ '--w': `${text.length + (ok ? 5 : 0)}ch` }}>${text}${ok && html` <span class="ok">[OK]</span>`}</div>`)}
    <div class="boot-bar"></div>
  </div>`;
}

function App() {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribe(() => setVersion(v => v + 1)), []);
  const route = useRoute();
  const tick = useNow();

  const data = useMemo(snapshot, [version]);
  const skills = useMemo(() => [
    ...SKILLS,
    ...data.customSkills.map(s => ({ id: s.id, name: s.name, icon: s.icon || '⭐', color: s.color || '#9b8cff', custom: true })),
  ], [data]);
  const skillMap = useMemo(() => Object.fromEntries(skills.map(s => [s.id, s])), [skills]);
  // Always score against the current time, so something logged a second ago counts right away.
  const game = useMemo(() => {
    const now = Date.now();
    return buildGame({ ...data, skills }, todayStr(new Date(now)), now);
  }, [data, skills, tick]);
  const today = game.today;

  const [toasts, setToasts] = useState([]);
  const toast = useCallback(text => {
    const id = Math.random();
    setToasts(t => [...t, { id, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);
  // A link like ?log=shift (used by the app's shortcut menu on Mac and Android) opens that log form.
  const [logSheet, setLogSheet] = useState(() => {
    const kind = new URLSearchParams(location.search).get('log');
    if (kind) history.replaceState(null, '', location.pathname + location.hash);
    return kind && KINDS[kind] ? { kind } : null;
  });
  const [levelUp, setLevelUp] = useState(null);
  const [opDone, setOpDone] = useState(null);
  const [help, setHelp] = useState(false);
  useShortcuts(() => setLogSheet({}), () => setHelp(h => !h));

  // Time-responsive theme: follows the clock on Auto, announced when it changes on its own.
  const [themePref, setThemePrefState] = useState(getThemePref);
  const theme = resolveTheme(themePref, new Date(game.now));
  const lastTheme = useRef(theme);
  useEffect(() => {
    applyTheme(theme);
    if (lastTheme.current !== theme && themePref === 'auto') {
      toast(`${THEMES[theme].icon} ${THEMES[theme].name} mode`);
      fx.play('shift');
    }
    lastTheme.current = theme;
  }, [theme]);

  // Sound the alarm when a NASM Ambush appears.
  const lastAmbush = useRef(game.pendingAmbush?.id);
  useEffect(() => {
    const id = game.pendingAmbush?.id;
    if (id && id !== lastAmbush.current) fx.feedback('alarm', 'heavy');
    lastAmbush.current = id;
  }, [game.pendingAmbush?.id]);

  // Celebrate level-ups, cleared quests and defeated bosses (only for changes made on this device),
  // and warn when a dungeon quest's window closes unfinished.
  const prev = useRef(null);
  useEffect(() => {
    const snap = {
      today,
      level: game.overall.level,
      skills: game.skillLevels,
      allClear: game.allClear,
      defeated: game.bosses.filter(b => b.defeatedOn).length,
      cleared: new Set(game.goals.flatMap(op => op.cleared.map(t => t.id))),
      opsDone: new Set(game.goals.filter(op => op.complete).map(op => op.id)),
      dungeon: Object.fromEntries(game.dungeonToday.map(q => [q.id, q.status])),
    };
    const p = prev.current;
    prev.current = snap;
    if (!p || p.today !== today) return;
    // Only the biggest moment gets a sound, so effects don't pile on top of each other.
    const moments = [];
    for (const q of game.dungeonToday) {
      if (p.dungeon[q.id] === q.status) continue;
      if (q.status === 'complete') {
        toast(`${q.icon} ${q.name} cleared!`);
        moments.push(['quest', 'double', 2]);
      }
      if (q.status === 'missed') {
        toast(`💔 ${q.name} missed${q.penalty ? ` · −${q.penalty} HP` : ''}`);
        moments.push(['hit', 'heavy', 1]);
      }
    }
    if (changeSource() === 'local') {
      if (snap.level > p.level) {
        setLevelUp({ level: snap.level, title: game.title });
        celebrate();
        moments.push(['levelup', 'heavy', 5]);
      }
      for (const s of skills) {
        if (p.skills[s.id] && snap.skills[s.id].level > p.skills[s.id].level) {
          toast(`${s.icon} ${s.name} reached Lv ${snap.skills[s.id].level}!`);
          moments.push(['tick', 'double', 1]);
        }
      }
      if (snap.allClear && !p.allClear) {
        toast(`🎉 All daily quests cleared! +${BONUS.allQuests} XP`);
        moments.push(['quest', 'double', 3]);
      }
      for (const op of game.goals) {
        for (const t of op.cleared) {
          if (p.cleared.has(t.id)) continue;
          toast(`🎯 Target eliminated: ${t.title} · +${TARGET_XP + (t.inOrder ? PRIME_BONUS_XP : 0)} XP`);
          moments.push(['win', 'double', 3]);
          if (op.prime) toast(`🔒 New prime target: ${op.prime.title}`);
        }
        if (op.complete && !p.opsDone.has(op.id)) {
          setOpDone({ title: op.title, reward: op.reward });
          celebrate();
          moments.push(['levelup', 'heavy', 6]);
        }
      }
      if (snap.defeated > p.defeated) {
        toast(`⚔️ Debt boss defeated! +${BONUS.boss} XP`);
        moments.push(['levelup', 'heavy', 4]);
      }
    }
    const top = moments.sort((a, b) => b[2] - a[2])[0];
    if (top) setTimeout(() => fx.feedback(top[0], top[1]), 150);
  }, [game]);

  const ctx = {
    data, game, skills, skillMap, toast, themePref,
    openLog: opts => setLogSheet(opts ?? {}),
    setThemePref: pref => {
      setThemePref(pref);
      setThemePrefState(pref);
    },
  };

  let page;
  if (route.startsWith('/skill/')) page = html`<${SkillPage} id=${decodeURIComponent(route.slice(7))} />`;
  else if (route === '/skills') page = html`<${SkillsPage} />`;
  else if (route === '/stats') page = html`<${Stats} />`;
  else if (route === '/career') page = html`<${CareerPage} />`;
  else if (route === '/shop') page = html`<${Shop} />`;
  else if (route === '/goals') page = html`<${GoalsPage} />`;
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
        <div class="side-foot muted tiny">
          <div>🔥 ${game.streak}-day streak · +${game.todayXP} XP today</div>
          <button class="link tiny" onClick=${() => setHelp(true)}>⌨ Keyboard shortcuts (?)</button>
        </div>
      </aside>
      <main class="main">${page}</main>
      <nav class="tabbar">
        ${TABS.slice(0, 2).map(n => html`<a href=${n.href} onClick=${() => fx.haptic()} class=${'tab' + ((n.tabMatch ?? n.match)(route) ? ' active' : '')}><${Icon} name=${n.icon} />${n.short ?? n.label}</a>`)}
        <button class="tab-log" onClick=${() => { fx.feedback('tap'); ctx.openLog(); }} aria-label="Log activity"><span class="tab-log-hex">+</span></button>
        ${TABS.slice(2).map(n => html`<a href=${n.href} onClick=${() => fx.haptic()} class=${'tab' + ((n.tabMatch ?? n.match)(route) ? ' active' : '')}><${Icon} name=${n.icon} />${n.short ?? n.label}</a>`)}
      </nav>
    </div>
    ${logSheet && html`<${LogSheet} initial=${logSheet} onClose=${() => setLogSheet(null)} />`}
    <${Ambush} />
    ${help && html`<${ShortcutHelp} onClose=${() => setHelp(false)} />`}
    ${opDone && html`<div class="levelup" onClick=${() => setOpDone(null)}>
      <div class="levelup-card granted">
        <div class="levelup-rays"></div>
        <div class="levelup-kicker">OPERATION COMPLETE</div>
        <div class="granted-icon">🏁</div>
        <div class="granted-name">${opDone.title}</div>
        <p class="granted-text">+${OPERATION_XP.toLocaleString()} XP${opDone.reward ? ` · 🎁 You earned: ${opDone.reward}` : ''}</p>
        <button class="btn primary">Mission accomplished</button>
      </div>
    </div>`}
    ${levelUp && html`<div class="levelup" onClick=${() => setLevelUp(null)}>
      <div class="levelup-card">
        <div class="levelup-rays"></div>
        <div class="levelup-kicker">LEVEL UP!</div>
        <div class="levelup-num">${levelUp.level}</div>
        <div class="levelup-title">${levelUp.title}</div>
        <button class="btn primary">Let's go</button>
      </div>
    </div>`}
    <${Boot} name=${data.settings.name} />
    <div class="toasts" aria-live="polite">${toasts.map(t => html`<div class="toast" key=${t.id}>${t.text}</div>`)}</div>
  <//>`;
}

applyTheme(resolveTheme(getThemePref()));
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
